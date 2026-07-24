/** @vitest-environment happy-dom */
/**
 * AmbientOverviewSheet — the Ambient v2 room in the composer's <xl (mobile/tablet) thread header.
 *
 * The regression this locks: `AMBIENT_V2_ENABLED` used to swap ONLY the ≥xl rail, so a phone kept
 * rendering the retired `AudiencePresence` room — a constellation crown, "General · N people ready"
 * and a "say hi →" cast — while desktop showed the ranked v2 board. These tests assert the mobile
 * surface is the SAME v2 board on the SAME real inputs (identical `AmbientOverviewRail`), only
 * presented as a sheet: no rail chrome, no second copy of the audience's name.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AmbientOverviewSheet } from "../AmbientOverviewSheet";
import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  { id: "hook-0", kind: "hook", conceptText: "Nobody tells you the first 10k…", fraction: "3/10 stop", scrollQuote: "" },
  { id: "idea-1", kind: "idea", conceptText: "I quit my 9-5 with $400…", fraction: "9/10 stop", scrollQuote: "" },
];

const noop = () => {};

describe("AmbientOverviewSheet", () => {
  it("opens onto the v2 ranked board — the SAME projected ledger the desktop rail shows", () => {
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
      />,
    );
    expect(screen.getByTestId("ambient-overview")).toBeTruthy();
    expect(screen.getByText(/Nobody tells you the first 10k/)).toBeTruthy();
    expect(screen.getByText(/I quit my 9-5 with \$400/)).toBeTruthy();
  });

  it("is NOT the retired room — no constellation readiness line, no 'say hi' cast", () => {
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
      />,
    );
    // The two strings that gave the old mobile room away (audience-presence's idle panel).
    expect(screen.queryByText(/people ready/i)).toBeNull();
    expect(screen.queryByText(/say hi/i)).toBeNull();
    expect(screen.queryByTestId("audience-presence")).toBeNull();
  });

  it("opens FULL SCREEN — fixed to the viewport, not a capped dropdown off the bar", () => {
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
      />,
    );
    const panel = screen.getByTestId("ambient-sheet-panel");
    expect(panel.className).toMatch(/fixed/);
    expect(panel.className).toMatch(/inset-0/);
    // the tall v2 surfaces get the whole column — no height cap, no anchor to the bar
    expect(panel.className).not.toMatch(/max-h-/);
    expect(panel.className).not.toMatch(/top-full/);
    expect(panel.getAttribute("aria-modal")).toBe("true");
    // portalled to <body>, because a fixed overlay inside the transformed thread would be trapped
    expect(panel.closest("[data-testid=ambient-overview-sheet]")).toBeNull();
    expect(panel.parentElement).toBe(document.body);
  });

  it("full screen, the board carries its OWN header — the bar that opened it is covered", () => {
    const onOpenChange = vi.fn();
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={onOpenChange}
      />,
    );
    // the identity is inside the board itself now (the bar underneath is off-screen)
    expect(screen.getByTestId("ambient-overview").textContent).toMatch(/Your audience/);
    // and its caret is the way OUT — the only exit from a full-screen room
    const close = screen.getByRole("button", { name: /close your audience/i });
    fireEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes the full-screen room and the page behind it cannot scroll", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={onOpenChange}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
    expect(document.body.style.overflow).toBe(""); // restored, never left locked
  });

  it("renders the board in `sheet` presentation — the host owns the ground, cap and rounding", () => {
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
      />,
    );
    const board = screen.getByTestId("ambient-overview");
    expect(board.dataset.presentation).toBe("sheet");
    // the rail chrome is dropped: no 440 width cap, no left hairline, no own #181817 ground
    expect(board.className).not.toMatch(/max-w-\[440px\]/);
    expect(board.getAttribute("style") ?? "").not.toMatch(/border-left|background/i);
  });

  // The contrast case — without it the `not.toMatch(max-w-[440px])` guards above are unfalsifiable
  // (a selector that never matched anything passes a negation for free). Rail mode MUST still carry
  // the chrome that sheet mode drops, or the presentation switch is a no-op in both directions.
  it("rail mode still carries the rail chrome it drops in a sheet (the guards above can fail)", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    const board = screen.getByTestId("ambient-overview");
    expect(board.dataset.presentation).toBe("rail");
    expect(board.className).toMatch(/max-w-\[440px\]/);
    expect(board.getAttribute("style") ?? "").toMatch(/border-left/i);
    // the rail's header caret is the inert SWITCH, never a dismiss (there is nothing to dismiss)
    expect(screen.getByRole("button", { name: /switch audience/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /close your audience/i })).toBeNull();
  });

  it("the collapsed bar states the room: name · calibration · how many are ranked", () => {
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open={false}
        onOpenChange={noop}
      />,
    );
    expect(screen.getByText("Your audience")).toBeTruthy();
    expect(screen.getByText(/baseline/i)).toBeTruthy(); // General ⇒ the honest baseline badge
    expect(screen.getByText(/2 ranked/)).toBeTruthy(); // the real descriptor count, never invented
    // closed ⇒ the board is unmounted, not merely hidden (no timers running behind the bar)
    expect(screen.queryByTestId("ambient-sheet-panel")).toBeNull();
    expect(screen.queryByTestId("ambient-overview")).toBeNull();
  });

  it("the bar toggles the sheet", () => {
    const onOpenChange = vi.fn();
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open={false}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open your audience/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("drills a SEALED row into the depth IN the sheet — the mobile room is not a lesser room", () => {
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
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
        persistedSeals={{
          "I quit my 9-5 with $400…": {
            pct: 80,
            band: "Strong",
            at: "",
            population,
            personas: [{ archetype: "builder", verdict: "stop" as const, quote: "that detail made me stay" }],
            scrollQuote: "",
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    const detail = screen.getByTestId("ambient-detail");
    expect(detail.dataset.presentation).toBe("sheet");
    expect(detail.className).not.toMatch(/max-w-\[440px\]/);
  });

  it("the ARM panel opens in the sheet too — a queued row still configures before it runs", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AmbientOverviewSheet
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        open
        onOpenChange={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    const arm = screen.getByTestId("ambient-simulate");
    expect(arm.dataset.presentation).toBe("sheet");
    expect(arm.className).not.toMatch(/max-w-\[440px\]/);
    expect(fetchMock).not.toHaveBeenCalled(); // config first — the sheet must not fire on a tap
  });
});
