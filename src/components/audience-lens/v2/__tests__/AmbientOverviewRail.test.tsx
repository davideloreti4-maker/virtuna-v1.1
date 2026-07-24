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
        persistedSeals={{ "I quit my 9-5 with $400…": { pct: 80, band: "Strong", at: "" } }}
      />,
    );
    // the persisted verdict shows as a sealed 80.0% row without any network call
    expect(screen.getByText(/80\.0%/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drills a SEALED text row into the real depth — brain-first attention-scrubber (real top-reason synthesis) + the Population tab", () => {
    const population = {
      total: 1000,
      stop: 800,
      scroll: 200,
      stopPct: 80,
      segments: [
        { archetype: "builder", displayName: "builders", share: 0.6, total: 600, stop: 540, stopPct: 90 },
        { archetype: "skeptic", displayName: "skeptics", share: 0.4, total: 400, stop: 260, stopPct: 65 },
      ],
      reasons: [
        { reason: "strong-hook", count: 520 },
        { reason: "too-slow", count: 120 },
      ],
    };
    const personas = [{ archetype: "builder", verdict: "stop" as const, quote: "that detail made me stay" }];
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{
          "I quit my 9-5 with $400…": { pct: 80, band: "Strong", at: "", population, personas, scrollQuote: "" },
        }}
      />,
    );
    // tapping the SEALED row opens the depth drill (not Simulate) — it has a real population
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
    // opens BRAIN-first (owner call 2026-07-24: text sim = full video Brain parity). The text brain is
    // the SAME attention-scrubber the video draws (modeled retention curve + real transcript), headed by
    // the REAL top-reason synthesis — the friction (loss) reason, humanized + coral. This REVERSED the
    // old reason-bars stance, so "What carried the stop" must NOT render; and it is NEVER the "text
    // concept sim — unavailable" paused state. (textContent matcher tolerates the synthesis' spans.)
    const bodyHas = (re: RegExp) =>
      screen.getAllByText((_content, el) => !!el && re.test(el.textContent ?? "")).length > 0;
    expect(bodyHas(/Most who stalled did so on/i)).toBe(true); // the real "why they stopped" synthesis
    expect(bodyHas(/too slow/i)).toBe(true); // the friction (loss) reason leads it (520 vs 120: loss wins)
    expect(screen.queryByText(/What carried the stop/i)).toBeNull(); // the reversed-away reason-bars header
    expect(screen.queryByText(/text concept sim/i)).toBeNull(); // never the unavailable fallback
    // the Population tab is still reachable — the same sim's REAL districts render there
    fireEvent.click(screen.getByRole("button", { name: /The audience/ }));
    expect(screen.getAllByText(/builders/).length).toBeGreaterThan(0);
  });

  it("a tested VIDEO shows its viral score + Simulate; a tap reveals the % then drills into Brain depth", () => {
    const videoSeal = {
      pct: 62,
      band: null,
      at: "",
      video: {
        analysisId: "an-1",
        stopPct: 62,
        craftScore: 84, // the native viral score — shown before any sim
        heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
        videoSignals: null,
        verbatim: { hook: { spoken_words: "Here is the money truth" } },
      },
    };
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{ "an-1": videoSeal as never }}
      />,
    );
    // the video is a QUEUED row: its real opening words as the label, its viral score, NO attention %
    const row = screen.getByRole("button", { name: /Here is the money truth/ });
    expect(row).toBeTruthy();
    expect(screen.getByText(/84/)).toBeTruthy();
    expect(screen.getByText(/viral/)).toBeTruthy();
    expect(screen.queryByText(/62\.0%/)).toBeNull(); // withheld until Simulate

    // tap 1 → reveal the already-measured attention % (no network — the Test analysis produced it)
    fireEvent.click(row);
    expect(screen.getByText(/62\.0%/)).toBeTruthy();
    expect(screen.getByText(/84 viral/)).toBeTruthy(); // native score stays in view

    // tap 2 → drill into the real Brain depth (brain-first for a video)
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ }));
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
  });

  it("tapping a queued row opens the ARM config FIRST, then its Simulate fires the react route (config→run)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fraction: "8/10 stop" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // tapping a queued row opens the ARM panel — it must NOT fire the sim yet (config comes first)
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    // the develop/ARM surface is now up (its Simulate control is present)
    const armSimulate = screen.getByRole("button", { name: /^Simulate/ });

    // NOW the run fires — from inside the ARM panel
    fireEvent.click(armSimulate);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/react",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody.text).toMatch(/I quit my 9-5/);
    expect(sentBody.pin).toBe(true); // a deliberate sim captures the flywheel vector (Phase D)

    // 8/10 stop → a sealed 80.0% would-stop row (measured, not the projection)
    expect(await screen.findByText(/80\.0%/)).toBeTruthy();
  });

  it("does NOT seal the row when the react route (fired from the ARM panel) fails — queued state holds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    // wrap in act so the rejected fetch + the watcher-clear state update settle inside React
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Simulate/ }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalled();
    // no fabricated seal — no "%.0%" sealed value appears
    expect(screen.queryByText(/\d+\.\d%/)).toBeNull();
  });
});
