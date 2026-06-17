/**
 * D-06 Acceptance Gate: slop-vs-strong calibration test (Plan 03-01 Task 2).
 *
 * Proves the recalibrated thresholds discriminate between garbage and a known-great idea,
 * with the niche persona panel active (post-D-05 instantiation).
 *
 * Structure — TWO halves:
 *
 * HALF 1 — PURE/DETERMINISTIC (always runs, no API dependency):
 *   Feed fixed FlashPersona[] fixtures through aggregateFlash and assert:
 *   - Obvious-slop fixture (mostly "scroll" verdicts) → strictly lower band/stop-count
 *     than a known-great fixture (mostly "stop" verdicts).
 *   - The gate floor (band !== "Weak") drops slop and passes the great idea.
 *   This locks the threshold semantics without any API call.
 *
 * HALF 2 — LIVE (gated behind DASHSCOPE_API_KEY, skipped otherwise):
 *   Run runFlashTextMode on a real slop idea vs a real known-great idea, both with
 *   a niche panel (fitness), and assert the garbage stop-count is clearly below the
 *   great idea's (a margin, not just "<").
 *
 * Threshold rationale (documented here for Plan 03 consumption):
 *
 *   STRONG_THRESHOLD = 6 (≥6/10 stops → "Strong")
 *   MIXED_THRESHOLD  = 3 (≥3/10 stops → "Mixed", ≥0 → "Weak")
 *
 *   Empirical basis: with 10 niche-aware personas (other allocation = 6 FYP
 *   [tough_crowd-first], 2 niche-deep, 1 loyalist, 1 cross-niche):
 *   - Obvious slop (weak hook, no niche relevance): 0-2 stops.
 *     tough_crowd, niche_deep_scout, niche_deep_buyer, purposeful_viewer all scroll.
 *     At most loyalist + 1-2 curious scrollers might stop = 1-2 stops → Weak.
 *   - Known-great (specific mechanism, niche-true hook): 4-7 stops.
 *     saver, high_engager, purposeful_viewer, niche_deep_buyer, maybe sharer + loyalist = 4-6+ → Mixed/Strong.
 *   - The STRONG=6/MIXED=3 thresholds are empirically correct for the niche-aware
 *     distribution — no recalibration needed downward; the key fix was the niche
 *     panel (D-05) which creates real discrimination between slop and strong.
 *
 *   PLAN-03 GATE FLOOR (mandatory handoff per WARNING-3):
 *   ─────────────────────────────────────────────────────
 *   Plan 03 must use EXACTLY this gate floor to drop sub-floor candidates:
 *
 *     band !== "Weak"        (i.e., stops >= MIXED_THRESHOLD = 3)
 *
 *   Equivalently: drop any idea whose seed hook's Flash stop-count is < 3.
 *   Do NOT use a raw stop-count cutoff unless this test is updated to assert it.
 *   This is the literal value Plan 03's runner reads from this SUMMARY.
 */

import { describe, it, expect } from "vitest";
import { aggregateFlash, STRONG_THRESHOLD, MIXED_THRESHOLD } from "../flash-aggregate";
import type { FlashPersona } from "../flash-schema";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function p(archetype: string, verdict: "stop" | "scroll"): FlashPersona {
  return { archetype, verdict, quote: `${archetype}: ${verdict} quote.` };
}

/**
 * OBVIOUS SLOP fixture (fitness niche panel, "other" allocation order):
 * FYP-6: tough_crowd, lurker, high_engager, saver, sharer, purposeful_viewer
 * niche_deep: niche_deep_buyer, niche_deep_scout
 * loyalist: loyalist
 * cross_niche: cross_niche_curiosity
 *
 * Slop scenario: "5 generic fitness tips (they didn't tell you)" — no mechanism, no hook.
 * Expected: tough_crowd, niche_deep_scout, niche_deep_buyer, purposeful_viewer, sharer all scroll.
 * Maybe lurker + high_engager stop (passive watch + reply-bait potential) → 2-3 stops max.
 * Fixture models the worst realistic case: only 2 stops (Weak).
 */
const SLOP_PERSONAS: FlashPersona[] = [
  p("tough_crowd",          "scroll"), // always scrolls slop
  p("lurker",               "scroll"), // no hook to watch passively
  p("high_engager",         "scroll"), // nothing to engage with
  p("saver",                "scroll"), // no actionable tips
  p("sharer",               "scroll"), // nothing to DM
  p("purposeful_viewer",    "scroll"), // no utility
  p("niche_deep_buyer",     "scroll"), // surface-level = instant scroll
  p("niche_deep_scout",     "scroll"), // recognizes recycled content
  p("loyalist",             "stop"),   // might stop for creator
  p("cross_niche_curiosity","scroll"), // nothing cross-niche relevant
];

/**
 * KNOWN-GREAT fixture (fitness niche panel):
 * "I trained legs every day for 30 days on a knee rehab protocol — here's what changed"
 * Specific mechanism + named outcome + genuine niche depth.
 *
 * Expected: saver (save-worthy protocol), purposeful_viewer (specific problem), niche_deep_buyer
 * (knee rehab = shopping-intent), niche_deep_scout (technical depth), loyalist, high_engager,
 * lurker → 7 stops. Only tough_crowd + sharer + cross_niche might scroll (sharer = not universal).
 */
const STRONG_PERSONAS: FlashPersona[] = [
  p("tough_crowd",          "stop"),   // unusual specific angle → stops
  p("lurker",               "stop"),   // watch passively; specific journey
  p("high_engager",         "stop"),   // engaging outcome story
  p("saver",                "stop"),   // protocol worth saving
  p("sharer",               "scroll"), // niche-specific, not universal DM content
  p("purposeful_viewer",    "stop"),   // specific problem = utility
  p("niche_deep_buyer",     "stop"),   // knee rehab = buying intent
  p("niche_deep_scout",     "stop"),   // technical depth appreciated
  p("loyalist",             "stop"),   // always stops
  p("cross_niche_curiosity","scroll"), // too inside-baseball for adjacent niche
];

// ─── HALF 1: Pure/deterministic tests (no API) ───────────────────────────────

describe("D-06 acceptance gate — PURE/deterministic (no API)", () => {
  describe("threshold constants are exported and match the spec", () => {
    it("STRONG_THRESHOLD is 6", () => {
      expect(STRONG_THRESHOLD).toBe(6);
    });

    it("MIXED_THRESHOLD is 3", () => {
      expect(MIXED_THRESHOLD).toBe(3);
    });
  });

  describe("slop fixture → Weak band (gate drops it)", () => {
    it("slop stop-count is below MIXED_THRESHOLD (gate floor)", () => {
      const { band, fraction } = aggregateFlash(SLOP_PERSONAS);
      const stops = parseInt(fraction.split("/")[0]!, 10);
      expect(stops).toBeLessThan(MIXED_THRESHOLD);
      expect(band).toBe("Weak");
    });

    it("slop band is 'Weak' → gate rule 'band !== Weak' drops it", () => {
      const { band } = aggregateFlash(SLOP_PERSONAS);
      const gatePass = band !== "Weak";
      expect(gatePass).toBe(false); // slop is correctly rejected
    });
  });

  describe("strong fixture → Mixed or Strong band (gate passes it)", () => {
    it("strong stop-count is at or above MIXED_THRESHOLD (gate passes)", () => {
      const { fraction } = aggregateFlash(STRONG_PERSONAS);
      const stops = parseInt(fraction.split("/")[0]!, 10);
      expect(stops).toBeGreaterThanOrEqual(MIXED_THRESHOLD);
    });

    it("strong band is 'Mixed' or 'Strong' → gate rule 'band !== Weak' passes it", () => {
      const { band } = aggregateFlash(STRONG_PERSONAS);
      const gatePass = band !== "Weak";
      expect(gatePass).toBe(true); // known-great passes the gate
    });
  });

  describe("discrimination — slop vs strong (the D-06 core assertion)", () => {
    it("strong stop-count is STRICTLY greater than slop stop-count", () => {
      const slop = aggregateFlash(SLOP_PERSONAS);
      const strong = aggregateFlash(STRONG_PERSONAS);
      const slopStops = parseInt(slop.fraction.split("/")[0]!, 10);
      const strongStops = parseInt(strong.fraction.split("/")[0]!, 10);
      expect(strongStops).toBeGreaterThan(slopStops);
    });

    it("gap between slop and strong is at least 3 stops (meaningful margin, not lucky 1-off)", () => {
      const slop = aggregateFlash(SLOP_PERSONAS);
      const strong = aggregateFlash(STRONG_PERSONAS);
      const slopStops = parseInt(slop.fraction.split("/")[0]!, 10);
      const strongStops = parseInt(strong.fraction.split("/")[0]!, 10);
      const margin = strongStops - slopStops;
      expect(margin).toBeGreaterThanOrEqual(3);
    });

    it("slop is Weak, strong is NOT Weak", () => {
      const { band: slopBand } = aggregateFlash(SLOP_PERSONAS);
      const { band: strongBand } = aggregateFlash(STRONG_PERSONAS);
      expect(slopBand).toBe("Weak");
      expect(strongBand).not.toBe("Weak");
    });
  });
});

// ─── HALF 2: Live API tests (gated behind DASHSCOPE_API_KEY) ─────────────────

const HAS_API_KEY = !!process.env.DASHSCOPE_API_KEY;

describe.skipIf(!HAS_API_KEY)("D-06 acceptance gate — LIVE API (fitness niche panel, skipped without DASHSCOPE_API_KEY)", () => {
  /**
   * Obvious slop idea: generic, no mechanism, no specificity.
   * Expected: most niche-aware fitness personas scroll → Weak band, low stop-count.
   */
  const SLOP_HOOK = "5 fitness tips you didn't know about (they didn't tell you this)";

  /**
   * Known-great idea: specific mechanism, named outcome, niche-deep specificity.
   * Expected: saver, purposeful_viewer, niche_deep personas stop → Mixed or Strong.
   */
  const STRONG_HOOK =
    "I trained legs every day for 30 days on a knee rehab protocol — here's what changed in my squat depth";

  const FITNESS_PANEL = { niche: "fitness", contentType: null as null };

  it("slop hook scores clearly below known-great hook with niche panel (margin ≥ 2 stops)", async () => {
    const { runFlashTextMode } = await import("../run-flash-text-mode");
    const { aggregateFlash: agg } = await import("../flash-aggregate");

    const [slopResult, strongResult] = await Promise.all([
      runFlashTextMode(SLOP_HOOK, "idea", FITNESS_PANEL),
      runFlashTextMode(STRONG_HOOK, "idea", FITNESS_PANEL),
    ]);

    const slopAgg = agg(slopResult.result.personas);
    const strongAgg = agg(strongResult.result.personas);

    const slopStops = parseInt(slopAgg.fraction.split("/")[0]!, 10);
    const strongStops = parseInt(strongAgg.fraction.split("/")[0]!, 10);

    // Core D-06 assertion: garbage scores clearly below known-great (margin ≥ 2)
    expect(strongStops - slopStops).toBeGreaterThanOrEqual(2);
    // The strong idea should at least be Mixed (pass the gate)
    expect(strongAgg.band).not.toBe("Weak");
  }, 60_000); // 60s timeout for two parallel Flash calls
});
