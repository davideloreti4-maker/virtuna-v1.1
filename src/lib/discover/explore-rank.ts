/**
 * explore-rank.ts — Phase 11, Plan 01, Task 1 (EXPLORE-03 / D-01 / D-02 / D-03).
 *
 * The audience-relative fit re-rank: turns P8's measured `RankedOutlier[]`
 * (outlier-compute.ts) into fit-annotated tiles for the in-thread Explore grid.
 *
 * PURE DETERMINISTIC MATH. NO SIM call, NO fabricated reaction, NO persona voice,
 * NO network, NO Supabase, NO engine scoring (D-02/D-03). This module lives at the
 * runner/route layer — NEVER inside any engine scoring function (RESEARCH Pitfall 6):
 * Explore makes zero video-scoring calls, so `ENGINE_VERSION` stays "3.19.0" and the
 * SIM-1 Max regression gate is untouched. The same honest-math family as
 * `rankOutliers`' "vs niche" baseline (D-01): a deterministic relative measure
 * (tile signature · audience calibration) blended into the sort — no model inference,
 * no invented data.
 *
 * Honesty hard-bind (D-02): the only signal this adds is a quantized level WORD
 * (Strong | Fair | Weak). It returns NO number, NO quote, NO verdict. The real
 * persona reaction is produced lazily, on tap, by the P9 reaction primitive on the
 * remix-card — never here on the grid. When no calibrated signal exists (General /
 * preset / thin), fit is omitted entirely (`fit: null`) and P8's measured ranking is
 * preserved exactly — the honest degrade gate.
 */
import type { RankedOutlier } from "@/lib/discover/outlier-compute";
import type { Audience, Temperature } from "@/lib/audience/audience-types";

// ─── Tunable constants ───────────────────────────────────────────────────────────
// [ASSUMED A2 — tune in UAT like the Flash thresholds]
const STRONG_THRESHOLD = 0.66; // fitScore >= → "Strong"
const FAIR_THRESHOLD = 0.4; // fitScore >= → "Fair" (else "Weak")
const RERANK_ALPHA = 0.5; // blend weight: rankKey * (1 + α·fitScore). Measured stays primary.
const MIN_TOKEN_LEN = 3; // drop tokens shorter than this from the niche vocabulary
const NEUTRAL_FIT = 0.5; // calibration-fit fallback when the audience mix is empty

// ─── Public types ────────────────────────────────────────────────────────────────

/** Quantized audience-fit estimate level. Level WORD only (D-02) — never a number. */
export type FitLevel = "Strong" | "Fair" | "Weak";

/**
 * A fit-annotated ranked outlier.
 * `fit: { level }` on a calibrated audience; `fit: null` on the honest degrade
 * (General / preset / thin) → the renderer omits the fit bar entirely (D-02).
 */
export interface FitRankedOutlier extends RankedOutlier {
  fit: { level: FitLevel } | null;
}

// ─── Degrade gate (D-02) ─────────────────────────────────────────────────────────

/**
 * The honesty degrade gate (D-02): true only when a real calibrated audience signal
 * exists. General / preset / thin-calibration / no-personas → false → fit omitted.
 */
function hasFitSignal(a: Audience): boolean {
  return (
    !a.is_general &&
    !a.is_preset &&
    !a.calibration?.thin &&
    Array.isArray(a.personas) &&
    a.personas.length > 0
  );
}

// ─── Tokenization (niche-match) ────────────────────────────────────────────────

/**
 * Lowercase, strip punctuation, split on whitespace, drop tokens shorter than
 * MIN_TOKEN_LEN. Returns a Set for O(1) intersection.
 */
function tokenize(...parts: Array<string | null | undefined>): Set<string> {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/\s+/)) {
      const token = raw.replace(/[^a-z0-9]/g, "");
      if (token.length >= MIN_TOKEN_LEN) tokens.add(token);
    }
  }
  return tokens;
}

/**
 * (a) Niche-match: Jaccard overlap (|∩| / |∪|) between the tile vocabulary
 * (caption words + hashtags) and the audience niche vocabulary (name + goal_label).
 * Guard: an empty union → 0. Range 0..1.
 */
function nicheMatch(tile: RankedOutlier, audience: Audience): number {
  const tileTokens = tokenize(tile.caption, ...tile.hashtags);
  const audienceTokens = tokenize(audience.name, audience.goal_label ?? "");
  if (tileTokens.size === 0 || audienceTokens.size === 0) return 0;

  let intersection = 0;
  for (const t of tileTokens) {
    if (audienceTokens.has(t)) intersection += 1;
  }
  const union = tileTokens.size + audienceTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Temperature vectors (calibration-fit) ────────────────────────────────────

type TempVector = Record<Temperature, number>;

/** L1-normalize a temperature vector. Returns null when the total is 0 (empty mix). */
function normalize(vec: TempVector): TempVector | null {
  const total = vec.cold + vec.warm + vec.hot;
  if (total <= 0) return null;
  return { cold: vec.cold / total, warm: vec.warm / total, hot: vec.hot / total };
}

/**
 * The audience temperature mix: prefer the derived `profile.temperature_mix`;
 * otherwise sum persona `share` by `temperature`. Either source → a cold/warm/hot
 * vector that `normalize` reduces to a distribution.
 */
function audienceTempMix(audience: Audience): TempVector {
  if (audience.profile?.temperature_mix) {
    const mix = audience.profile.temperature_mix;
    return { cold: mix.cold ?? 0, warm: mix.warm ?? 0, hot: mix.hot ?? 0 };
  }
  const vec: TempVector = { cold: 0, warm: 0, hot: 0 };
  for (const p of audience.personas) {
    vec[p.temperature] += p.share;
  }
  return vec;
}

/**
 * The tile's measured "temperature demand", derived from already-present
 * `RankedOutlier` fields:
 *   - high `multiplier` (broad FYP reach) → cold-leaning;
 *   - high `saves/views` and `shares/views` (loyalist / save play) → warm/hot-leaning.
 * The raw signals are squashed into 0..1 weights, then assembled into a cold/warm/hot
 * vector. Divide-by-zero on views is guarded (|| 1).
 */
function tileTempDemand(tile: RankedOutlier): TempVector {
  const views = tile.views || 1;
  const saveRate = tile.saves / views; // typically 0..~0.3
  const shareRate = tile.shares / views;

  // Squash each signal into 0..1 so no single raw magnitude dominates.
  const coldPull = tile.multiplier / (1 + tile.multiplier); // monotonic, →1 as multiplier grows
  const warmPull = saveRate / (saveRate + 0.05); // saves → warm loyalist demand
  const hotPull = shareRate / (shareRate + 0.05); // shares → hot advocacy demand

  return { cold: coldPull, warm: warmPull, hot: hotPull };
}

/**
 * (b) Calibration-fit: how well the tile's temperature demand matches the audience
 * temperature mix. Dot-product of the two L1-normalized vectors → 0..1. Guard: an
 * empty/zero audience mix → NEUTRAL_FIT (0.5).
 */
function calibrationFit(tile: RankedOutlier, audience: Audience): number {
  const mix = normalize(audienceTempMix(audience));
  if (!mix) return NEUTRAL_FIT;
  const demand = normalize(tileTempDemand(tile));
  if (!demand) return NEUTRAL_FIT;
  return mix.cold * demand.cold + mix.warm * demand.warm + mix.hot * demand.hot;
}

// ─── The re-rank ─────────────────────────────────────────────────────────────────

/**
 * Annotate each measured outlier with a quantized audience-fit level and re-rank so
 * tiles that fit YOUR audience float up — while the measured signal stays primary
 * (α small). Pure, deterministic, no side effects (the input array is never mutated).
 *
 * @param ranked       P8 `rankOutliers` output (measured, honest base).
 * @param audience     the active calibrated audience (from `active_audience_id`).
 * @param serendipity  0 = on-niche, 1 = widen beyond niche (the valve, D-06).
 *                     Down-weights niche-match only; fabricates nothing.
 */
export function rankWithAudienceFit(
  ranked: RankedOutlier[],
  audience: Audience,
  serendipity: number,
): FitRankedOutlier[] {
  // Honest degrade (D-02): no calibrated signal → no fit, keep P8's exact order.
  if (!hasFitSignal(audience)) {
    return ranked.map((t) => ({ ...t, fit: null }));
  }

  const clampedSerendipity = Math.min(1, Math.max(0, serendipity));
  const nicheWeight = 1 - clampedSerendipity; // slide right → niche matters less

  const scored = ranked.map((t) => {
    const nm = nicheMatch(t, audience); // 0..1
    const cf = calibrationFit(t, audience); // 0..1
    const fitScore = nicheWeight * nm + (1 - nicheWeight) * cf; // 0..1 continuous
    const level: FitLevel =
      fitScore >= STRONG_THRESHOLD
        ? "Strong"
        : fitScore >= FAIR_THRESHOLD
          ? "Fair"
          : "Weak";
    return { tile: t, fitScore, level };
  });

  // Blend the measured rankKey with the fit estimate (α small → measured primary),
  // so a real outlier is never buried, but a strong audience-fit floats up.
  scored.sort(
    (x, y) =>
      y.tile.rankKey * (1 + RERANK_ALPHA * y.fitScore) -
      x.tile.rankKey * (1 + RERANK_ALPHA * x.fitScore),
  );

  return scored.map(({ tile, level }) => ({ ...tile, fit: { level } }));
}
