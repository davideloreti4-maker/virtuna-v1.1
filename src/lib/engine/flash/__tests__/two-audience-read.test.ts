/**
 * two-audience-read.test.ts — runTwoAudienceRead unit tests (Plan 08-06, Task 1, W4).
 *
 * The killer feature (D-08/D-09): score ONE concept against TWO audiences side by
 * side, defaulting to the active calibrated audience vs General, with the DELTA as
 * a one-line Read + Lever (wins for X, bombs for Y). This is the moat headline.
 *
 * Honesty spine (Pitfall 5 / D-11): each entry carries a band + fraction string ONLY —
 * NEVER a numeric 0-100 score. The delta interpretation + Lever are DERIVED from the
 * two aggregates (pure, no extra model call) — never fabricated.
 *
 * Tests (tagged "runner"):
 *   - returns exactly 2 per-audience entries (capped at 2 for v1 legibility, D-09)
 *   - each entry carries a band + fraction (NO numeric score) — bands-only spine
 *   - a delta interpretation line + Lever are present (the foresight payoff, D-08)
 *   - the default pair is active-calibrated-audience vs General (D-09)
 *   - resolveAudienceWeights is called once PER audience (the second resolve is real)
 *   - per-audience who-not-for falls out of the compare (the scrolls-past segment)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Qwen client (transitively imported by run-flash-text-mode) ─────────────
vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_FAST_MODEL: "qwen3.6-flash",
  QWEN_REASONING_MODEL: "qwen3.7-plus",
}));

// ─── Mock runFlashTextMode — the per-audience Flash run ──────────────────────────
vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Spy resolveAudienceWeights — assert the SECOND resolve is real (per audience) ──
vi.mock("@/lib/audience/resolve-audience-weights", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audience/resolve-audience-weights")>();
  return {
    ...actual,
    resolveAudienceWeights: vi.fn(actual.resolveAudienceWeights),
  };
});

import { runTwoAudienceRead } from "../two-audience-read";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** N stop, rest scroll → drive the band (8 stop → Strong, 2 stop → Weak). */
function makePersonas(stops: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: `Quote ${i}`,
  }));
}

/** A calibrated audience with cold scroll-prone dispositions (drives who-not-for). */
function makeCalibratedAudience(): Audience {
  const personas: CalibratedPersona[] = [
    { archetype: "tough_crowd", repaint: "Hard sell crowd", temperature: "cold", disposition: "skeptic", share: 0.3 },
    { archetype: "lurker", repaint: "Silent watchers", temperature: "cold", disposition: "lurker", share: 0.2 },
    { archetype: "saver", repaint: "Collectors", temperature: "hot", disposition: "collector", share: 0.5 },
  ];
  return {
    ...GENERAL_AUDIENCE,
    id: "aud-growth",
    name: "Growth",
    is_general: false,
    is_preset: false,
    personas,
  };
}

describe("runTwoAudienceRead (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a multi-audience-read block with exactly 2 per-audience entries (D-09)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonas(8) }, warnings: [] }) // audA Strong
      .mockResolvedValueOnce({ result: { personas: makePersonas(2) }, warnings: [] }); // audB Weak

    const block = await runTwoAudienceRead("A bold concept hook", [
      makeCalibratedAudience(),
      GENERAL_AUDIENCE,
    ]);

    expect(block.type).toBe("multi-audience-read");
    expect(block.props.audiences).toHaveLength(2);
    expect(block.props.model).toBe("sim1-flash");
  });

  it("each entry carries a band + fraction and NO numeric score (bands-only spine)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonas(8) }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonas(2) }, warnings: [] });

    const block = await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    for (const entry of block.props.audiences) {
      expect(["Strong", "Mixed", "Weak"]).toContain(entry.band);
      expect(entry.fraction).toMatch(/^\d+\/\d+ stop$/);
      // honesty spine: no smuggled numeric 0-100 score field
      expect("score" in (entry as Record<string, unknown>)).toBe(false);
    }
    // the two bands actually differ (real discrimination — wins for X, bombs for Y)
    expect(block.props.audiences[0]!.band).toBe("Strong");
    expect(block.props.audiences[1]!.band).toBe("Weak");
  });

  it("produces a delta interpretation line + Lever for each entry (the foresight payoff, D-08)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonas(8) }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonas(2) }, warnings: [] });

    const block = await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    for (const entry of block.props.audiences) {
      expect(entry.interpretation.length).toBeGreaterThan(0);
      expect(entry.lever.length).toBeGreaterThan(0);
    }
    // the delta framing references BOTH audiences by name (wins for X, bombs for Y)
    expect(block.props.audiences[0]!.interpretation).toContain("Growth");
    expect(block.props.audiences[0]!.interpretation).toContain("General");
  });

  it("defaults the pair to the active calibrated audience vs General (D-09)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    // pass ONLY the active calibrated audience → the function fills General as the pair
    const block = await runTwoAudienceRead("hook", [makeCalibratedAudience()]);

    expect(block.props.audiences).toHaveLength(2);
    expect(block.props.audiences[0]!.name).toBe("Growth");
    expect(block.props.audiences[1]!.name).toBe("General");
  });

  it("calls resolveAudienceWeights once PER audience (the second resolve is real)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { resolveAudienceWeights } = await import("@/lib/audience/resolve-audience-weights");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    expect(resolveAudienceWeights).toHaveBeenCalledTimes(2);
  });

  it("derives a per-audience who-not-for from cold scroll-prone dispositions (D-10)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    const block = await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    // calibrated audience has skeptic + lurker → "Skeptics, Lurkers"
    expect(block.props.audiences[0]!.whoNotFor).toContain("Skeptics");
    expect(block.props.audiences[0]!.whoNotFor).toContain("Lurkers");
    // General has no calibrated personas → empty who-not-for (no fabrication)
    expect(block.props.audiences[1]!.whoNotFor).toBe("");
  });

  it("caps the pick at 2 audiences for v1 legibility (D-09)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    const third = { ...makeCalibratedAudience(), id: "aud-3", name: "Buyers" };
    const block = await runTwoAudienceRead("hook", [
      makeCalibratedAudience(),
      GENERAL_AUDIENCE,
      third as Audience,
    ]);

    expect(block.props.audiences).toHaveLength(2);
  });
});
