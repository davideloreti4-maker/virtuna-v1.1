/**
 * SIM-1 Flash — Predict per-analyst schema + coercion (Plan 06-01 Task 1).
 *
 * This is a PARALLEL SIBLING of `flash-schema.ts`, NOT a widening of it. The binary persona /
 * result schemas there (verdict: stop|scroll) are regression-locked by
 * hooks/ideas/script/remix/simulate + `aggregateFlash` (PACK-04 byte-identical gate) and are
 * NEVER edited here. Predict needs an ORDINAL per-analyst output (a graded `lean` + a named
 * `factor`) because a binary stop/scroll vote yields only a single fraction — it cannot
 * produce D-01's panel-spread range, D-05's tightness-confidence, or D-04's named factors.
 *
 * PredictAnalyst: { archetype, lean (5-point ordinal), factor (the named driver / receipt),
 *                   factorDirection (for|against), reasoning } — `.strict()` so a model that
 *                   smuggles a per-analyst number/probability/score fails Zod (D-01/T-06-01).
 * PredictPanelResult: { analysts[] } — `.min(2)` not `.length(4)` (custom panels vary, A4);
 *                   `.strict()` so the panel response carries NO top-level
 *                   probability/range/confidence key — the D-01 honesty guard made STRUCTURAL.
 *                   The range/band/confidence are DERIVED downstream (06-02 aggregatePredict),
 *                   never echoed from the model.
 * coercePredictResponse: salvages small-model FORMAT sloppiness (bare array, fences, casing)
 *                   BEFORE Zod — never fabricates signal. An unknown/unparseable `lean` is
 *                   salvaged to the neutral `"toss_up"` (documented) rather than dropped, so a
 *                   single noisy enum cannot nuke the whole panel; Zod still gates after.
 *
 * Isolation: imports ONLY zod + the shared strip util. No engine (pipeline/aggregator/version/
 * wave3/fold) imports, and — critically — NO `flash-schema` import (the binary is untouched).
 */

import { z } from "zod";
import { stripModelOutput } from "../utils/strip";

// ─── Ordinal lean scale ─────────────────────────────────────────────────────────
// A 5-point ordinal lean per analyst. Displayed as a WORD in the UI (never a per-analyst
// number — UI-SPEC F-01); the numeric position lives ONLY in predict-aggregate.ts (06-02).
// Ordered low→high likelihood so a downstream LEAN_POS map is monotonic.

export const LEANS = ["strongly_no", "lean_no", "toss_up", "lean_yes", "strongly_yes"] as const;

export type Lean = (typeof LEANS)[number];

// ─── Per-analyst schema ─────────────────────────────────────────────────────────
// .strict() rejects a smuggled per-analyst number/probability/score (D-01 / T-06-01).
// factor: the named driver (the "receipt") — 1..160 chars (one readable phrase, fits the chip).
// reasoning: 1..240 chars (the panel-drill quote).

export const PredictAnalystSchema = z
  .object({
    archetype: z.string(),
    lean: z.enum(LEANS),
    factor: z.string().min(1).max(160),
    factorDirection: z.enum(["for", "against"]),
    reasoning: z.string().min(1).max(240),
  })
  .strict();

export type PredictAnalyst = z.infer<typeof PredictAnalystSchema>;

// ─── Panel result schema ────────────────────────────────────────────────────────
// .min(2) (NOT .length(4)) — template-analyst has 4 personas but custom panels vary (A4).
// .strict() ⇒ NO top-level probability/range/confidence/score key — the structural D-01 guard:
// the range/band/confidence are DERIVED by aggregatePredict (06-02), never model-emitted.

export const PredictPanelResultSchema = z
  .object({
    analysts: z.array(PredictAnalystSchema).min(2),
  })
  .strict();

export type PredictPanelResult = z.infer<typeof PredictPanelResultSchema>;

// ─── Coercion layer ─────────────────────────────────────────────────────────────
// Mirrors coerceFlashResponse (flash-schema.ts:82-112): salvages FORMAT sloppiness WITHOUT
// fabricating signal. Zod enforces the hard contract AFTER this.
//
// Handles:
//  1. Fenced/`<think>` JSON string → stripModelOutput → JSON.parse → recurse
//  2. Bare top-level array of analysts → { analysts: [...] }
//  3. lean casing variants ("LEAN_YES", "Lean Yes") → lowercase + underscore-normalize
//  4. factorDirection casing variants ("For", "AGAINST") → lowercase
//
// An unknown/unparseable lean salvages to the NEUTRAL "toss_up" (documented — never a
// fabricated yes/no signal). Coercion NEVER bypasses the Zod gate (T-06-02).

/** Lowercase + collapse whitespace/hyphens to underscores; map an unknown lean to "toss_up". */
function normalizeLean(v: unknown): string {
  if (typeof v !== "string") return "toss_up";
  const norm = v.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (LEANS as readonly string[]).includes(norm) ? norm : "toss_up";
}

/** Lowercase + trim the for/against direction; leave an unknown value for Zod to reject. */
function normalizeDirection(v: unknown): string {
  if (typeof v !== "string") return String(v ?? "");
  return v.toLowerCase().trim();
}

/**
 * Coerce a raw model response into PredictPanelResultSchema-compatible shape.
 * Accepts: object with an `analysts` array, a bare array, or a fenced JSON string.
 * Returns a plain object suitable for PredictPanelResultSchema.safeParse — does NOT
 * add any aggregate field (range/band/confidence are derived downstream, not here).
 */
export function coercePredictResponse(raw: unknown): unknown {
  // Handle fenced/`<think>` JSON string — strip + parse + recurse.
  if (typeof raw === "string") {
    const stripped = stripModelOutput(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Not valid JSON after stripping — return empty analysts (fails Zod via .min(2)).
      return { analysts: [] };
    }
    return coercePredictResponse(parsed);
  }

  // The model sometimes returns a bare array of analysts instead of { analysts: [...] }.
  const obj = Array.isArray(raw)
    ? { analysts: raw }
    : (raw as { analysts?: unknown } | null);

  const analysts = Array.isArray(obj?.analysts) ? obj.analysts : [];

  return {
    analysts: analysts.map((a) => {
      const aa = (a ?? {}) as Record<string, unknown>;
      return {
        archetype: String(aa.archetype ?? ""),
        lean: normalizeLean(aa.lean),
        factor: String(aa.factor ?? ""),
        factorDirection: normalizeDirection(aa.factorDirection),
        reasoning: String(aa.reasoning ?? ""),
      };
    }),
  };
}
