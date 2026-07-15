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
  // 03-07: the run-level TrustBadge wiring pulls resolveTier → SOCIALS_PACK →
  // scoring pipeline → deepseek, which references QWEN_APOLLO_MODEL at module load.
  // The pack's static `calibration` field is the only thing read (no scorer call).
  QWEN_APOLLO_MODEL: "qwen3.7-plus",
}));

// ─── Mock runFlashTextMode — the per-audience Flash run ──────────────────────────
vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Spy aggregateFlash — assert the audience's WEIGHTS reach the band math (MODE-01) ──
// Wraps the real implementation (band math must stay real — the honesty spine forbids
// re-rolling it), and records the weighting argument the Read now passes.
vi.mock("@/lib/engine/flash/flash-aggregate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/flash/flash-aggregate")>();
  return { ...actual, aggregateFlash: vi.fn(actual.aggregateFlash) };
});

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

/** A `mode: 'general'` audience — an analyst panel. NOT a crowd on a feed (MODE-01). */
function makeGeneralModeAudience(): Audience {
  const personas: CalibratedPersona[] = [
    { archetype: "tough_crowd", repaint: "The Skeptic — pressure-tests every claim.", temperature: "warm", disposition: "skeptic", share: 0.5 },
    { archetype: "niche_deep_scout", repaint: "The Researcher — hunts the missing evidence.", temperature: "warm", disposition: "scanner", share: 0.5 },
  ];
  return {
    ...makeCalibratedAudience(),
    id: "template-analyst",
    name: "Analyst Panel",
    mode: "general",
    platform: "custom",
    personas,
  };
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

  // ─── MODE-01: the audience must actually REACH the model ────────────────────────
  // The bug these pin: readForAudience built the repaint map and passed `niche: null`,
  // but the generic prompt path ignored the repaint — so every audience ran the identical
  // General prompt and the "two-audience Read" compared General to General with one side
  // relabelled (live-verified before the fix: 10/10 identical verdicts, calibrated vs General).
  // The weights were computed and then discarded outright (`void resolved`).

  it("passes the calibrated audience's REPAINT to Flash — the steer reaches the model", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    const calls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);

    // 4th arg = audienceRepaint. The calibrated audience's stored repaints must be there…
    expect(calls[0]![3]).toEqual({
      tough_crowd: "Hard sell crowd",
      lurker: "Silent watchers",
      saver: "Collectors",
    });
    // …and General must still steer NOTHING (the regression gate: byte-identical no-op).
    expect(calls[1]![3]).toBeUndefined();
  });

  it("weights the BAND by the audience's persona_weights (the mix sliders move a Read)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { aggregateFlash } = await import("@/lib/engine/flash/flash-aggregate");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    const block = await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);

    // 2nd arg = the FlashWeighting. It was never passed before MODE-01 (the weights were
    // resolved and then dropped with `void resolved`), so the /audience mix sliders moved
    // every other skill's band but were inert on the Read.
    const aggCalls = (aggregateFlash as ReturnType<typeof vi.fn>).mock.calls;
    expect(aggCalls).toHaveLength(2);
    expect(aggCalls[0]![1]).toMatchObject({
      weights: { fyp: expect.any(Number), niche: expect.any(Number) },
    });
    // General NEVER weights — that identity IS the regression gate (persona-weighting.ts:51).
    expect(aggCalls[1]![1]).toBeUndefined();

    // The fraction stays the honest raw count either way; weighting moves only the band.
    expect(block.props.audiences[0]!.fraction).toBe("6/10 stop");
  });

  it("sends the SOCIALS frame for a socials audience and the GENERAL frame for a panel", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    await runTwoAudienceRead("hook", [makeCalibratedAudience(), GENERAL_AUDIENCE]);
    const socialsCalls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    // 6th arg = domain lens.
    expect(socialsCalls[0]![5]).toBe("socials");
    expect(socialsCalls[1]![5]).toBe("socials");

    (runFlashTextMode as ReturnType<typeof vi.fn>).mockClear();
    await runTwoAudienceRead("hook", [makeGeneralModeAudience(), GENERAL_AUDIENCE]);
    const generalCalls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    // A panel is NOT asked the FYP stop-or-scroll question.
    expect(generalCalls[0]![5]).toBe("general");
  });

  // ─── MODE-01: the control rule ──────────────────────────────────────────────────

  // The route ALWAYS hands the runner a 2-element [active, second] array — `second` defaults to
  // GENERAL_AUDIENCE. So this is the shape that matters, and a `[general]`-only fixture would
  // pass while the real path stayed broken. (It did: the first cut of this fix guarded the
  // length-1 branch, the unit test went green, and the live Read still returned
  // "Marcus Reyes … — General …". Test the shape the caller sends.)
  it("NEVER pairs a mode:'general' audience against GENERAL_AUDIENCE (a TikTok crowd)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    // EXACTLY what the route passes: the pinned panel + the defaulted General control.
    const block = await runTwoAudienceRead("hook", [makeGeneralModeAudience(), GENERAL_AUDIENCE]);

    // ONE entry — a single-audience Read. Not a pair, and above all not a pair against a
    // TikTok crowd ("Both Marcus Reyes and General land the same" was the shipped bug).
    expect(block.props.audiences).toHaveLength(1);
    expect(block.props.audiences[0]!.name).toBe("Analyst Panel");
    expect(block.props.audiences.some((a) => a.name === "General")).toBe(false);
    // Exactly ONE Flash call — the phantom control is not run, so it is not billed either.
    expect((runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("still compares two SAME-MODE panels (the control rule drops the crowd, not the compare)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(6) }, warnings: [] });

    const hiring: Audience = { ...makeGeneralModeAudience(), id: "template-hiring", name: "Hiring Panel" };
    const block = await runTwoAudienceRead("hook", [makeGeneralModeAudience(), hiring]);

    // Panel-vs-panel is a real comparison — both sides answer the SAME question.
    expect(block.props.audiences).toHaveLength(2);
    expect(block.props.audiences.map((a) => a.name)).toEqual(["Analyst Panel", "Hiring Panel"]);
  });

  it("frames the single-audience panel Read in panel language, not feed language", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ result: { personas: makePersonas(8) }, warnings: [] });

    const block = await runTwoAudienceRead("hook", [makeGeneralModeAudience(), GENERAL_AUDIENCE]);
    const entry = block.props.audiences[0]!;

    // "wins/splits/bombs" and "sharpen the hook" are FYP copy — wrong for an analyst panel.
    expect(entry.interpretation).toContain("is convinced");
    expect(entry.interpretation).not.toContain("wins");
    expect(entry.lever).not.toMatch(/hook|opener|scroll/i);
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

  // CR-02: the route ALWAYS passes [active, second]. The default (no calibrated
  // audience, no explicit second) is [General, General]. That self-pair must
  // collapse to a SINGLE-audience Read, not a degenerate General-vs-General compare.
  it("collapses a General-vs-General default to a single-audience Read (CR-02)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(8) },
      warnings: [],
    });

    // Mirrors the route's default: [GENERAL, GENERAL] (same identity).
    const block = await runTwoAudienceRead("hook", [GENERAL_AUDIENCE, GENERAL_AUDIENCE]);

    // Single entry — NOT a 2-element self-compare.
    expect(block.props.audiences).toHaveLength(1);
    const only = block.props.audiences[0]!;
    expect(only.name).toBe("General");
    // No degenerate "Both General and General land the same" lever.
    expect(only.lever).not.toContain("Both General and General");
    expect(only.interpretation).not.toContain("General wins (Strong) — General");
    // Flash ran once (one audience), not twice.
    expect(runFlashTextMode).toHaveBeenCalledTimes(1);
  });

  // A duplicate CALIBRATED pair dedupes to one distinct calibrated audience, which
  // then defaults to the D-09 compare (calibrated vs General) — NOT a self-compare.
  it("dedupes a duplicate calibrated pair to calibrated-vs-General (CR-02)", async () => {
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) },
      warnings: [],
    });

    const aud = makeCalibratedAudience(); // same id on both sides
    const block = await runTwoAudienceRead("hook", [aud, aud]);

    // Distinct ids = 1 → defaults to [Growth, General], a genuine compare.
    expect(block.props.audiences).toHaveLength(2);
    expect(block.props.audiences[0]!.name).toBe("Growth");
    expect(block.props.audiences[1]!.name).toBe("General");
    // Never a "Growth vs Growth" self-compare.
    expect(block.props.audiences[1]!.name).not.toBe("Growth");
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
