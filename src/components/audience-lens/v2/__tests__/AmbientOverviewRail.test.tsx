/** @vitest-environment happy-dom */
/**
 * AmbientOverviewRail — the parallel-run mount of the Ambient v2 surfaces in the composer rail.
 *
 * The integration this locks: a live `Audience` + the thread's projected-card ledger flow through
 * `audienceToMeta` → `buildOverviewData` → the rendered Overview, so the ranked list shows the REAL
 * projected stimuli under the REAL audience name — no fixture, no fabrication. (The pure segment/cast
 * derivation is unit-tested in `ambient-v2-adapters.test.ts`; this proves the glue renders.)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  { id: "hook-0", kind: "hook", conceptText: "Nobody tells you the first 10k…", fraction: "3/10 stop", scrollQuote: "" },
  { id: "idea-1", kind: "idea", conceptText: "I quit my 9-5 with $400…", fraction: "9/10 stop", scrollQuote: "" },
];

describe("AmbientOverviewRail", () => {
  it("renders the real audience + the projected ledger as the ranked Overview", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // the real audience name (mapped via audienceToMeta)
    expect(screen.getByText("Your audience")).toBeTruthy();
    // both projected stimuli render as ranked rows (real data, not a fixture)
    expect(screen.getByText(/Nobody tells you the first 10k/)).toBeTruthy();
    expect(screen.getByText(/I quit my 9-5 with \$400/)).toBeTruthy();
  });

  it("renders the Overview (not Simulate) at rest — the develop surface is gated behind a rank tap", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    expect(screen.getByTestId("ambient-overview")).toBeTruthy();
  });

  it("re-seals a row from persistedSeals on mount — no fire needed (survives reload, Phase D)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        // keyed by the trimmed concept text (matches the persisted store)
        persistedSeals={{ "I quit my 9-5 with $400…": 80 }}
      />,
    );
    // the persisted verdict shows as a sealed 80.0% row without any network call
    expect(screen.getByText(/80\.0%/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quick-sim fires the real react route and SEALS the row with the measured fraction (Phase D)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fraction: "8/10 stop" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // the whole queued row is the quick-sim door — tap it to fire the sealed sim
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));

    // it hit the REAL react route with the concept text (not the General-only /simulate verb)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/react",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody.text).toMatch(/I quit my 9-5/);
    expect(sentBody.framing).toBe("idea"); // idea kind → the "would they want it" framing
    expect(sentBody.pin).toBe(true); // a deliberate sim captures the flywheel vector (Phase D)

    // 8/10 stop → a sealed 80.0% would-stop row (measured, not the projection)
    expect(await screen.findByText(/80\.0%/)).toBeTruthy();
  });

  it("does NOT seal the row when the react route fails — the honest queued state holds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // wrap in act so the rejected fetch + the watcher-clear state update settle inside React
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalled();
    // no fabricated seal — no "%.0%" sealed value appears
    expect(screen.queryByText(/\d+\.\d%/)).toBeNull();
  });
});
