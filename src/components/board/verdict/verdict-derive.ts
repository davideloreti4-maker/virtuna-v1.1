import type { PredictionResult } from '@/lib/engine/types';
import type { NicheCohort, ConfidenceRange } from './ScoreDistribution';
import type { StatTileData } from '../_kit';
import { fixCount } from './verdict-constants';

// Pure derivations for the redesigned Score frame. No fabricated numbers — every
// value traces to a real engine field; tiles/banner omit what isn't present.

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Field needs a real cohort; below this the hero degrades to the lane. Mirrors
 *  FIELD_MIN_COUNT in ScoreDistribution. */
const FIELD_MIN_COUNT = 20;

/** Confidence interval rendered as the hero's coral band. Derived from the
 *  numeric confidence (0-1): high confidence → tight band, low → wide. This is a
 *  visualization of uncertainty, not a stored field — kept honest by labelling
 *  it "likely" and tying its width directly to `confidence`. */
export function confidenceRange(score: number, confidence: number): ConfidenceRange {
  const c = Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5;
  const half = clamp(Math.round((1 - c) * 22), 3, 22);
  return { lo: Math.max(0, score - half), hi: Math.min(100, score + half) };
}

export function bandLabel(score: number): string {
  if (score >= 70) return 'High potential';
  if (score >= 40) return 'Solid contender';
  return 'Needs work';
}

/** Honest cohort position from the aggregate stats we actually have (median,
 *  p75, count) — never a fabricated percentile. */
export function comparativeLine(score: number, niche: NicheCohort | null): string {
  if (!niche) return 'add your handle to rank vs your niche';
  const suffix =
    niche.count >= FIELD_MIN_COUNT ? `${niche.count} posts` : `small sample (${niche.count})`;
  const lead =
    score >= niche.p75
      ? 'top 25% of your niche'
      : score >= niche.median
        ? 'above your niche median'
        : 'below your niche median';
  return `${lead} · ${suffix}`;
}

// T4.5 (2026-06-07): deriveSignalTiles (the Score frame's "Engine signals" row) was
// removed. It restated the WEIGHTED persona-sim hook/completion numbers that the
// Content-craft frame (hook quality) and Audience frame (watch-through/retention)
// already own — the "weighted hold" / "weighted curve" provenance sub-labels existed
// only to disambiguate the duplicates. One owner per number now: Hook → Content-craft,
// Retention/Completion → Audience. The Score frame keeps the hero score + factor bars.

/* ────────────────────────────────────────────────────────────────────────────
 * Redesign-v2 selectors — map the same engine fields onto the shared kit's
 * Hero + StatTileRow + tab semantics. No new numbers fabricated.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ScoreTone = 'good' | 'warn' | 'crit' | 'neutral';

/** Band → hero status tone. ≥70 good, 40–69 warn, <40 crit. */
export function bandTone(score: number): ScoreTone {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warn';
  return 'crit';
}

/** Hero delta vs the niche median, in absolute score points — only when a real
 *  cohort exists (otherwise no honest comparison to draw). Rounded; 0 is dropped
 *  by <Delta> unless showZero. */
export function nicheDelta(score: number, niche: NicheCohort | null): number | null {
  if (!niche || !Number.isFinite(niche.median)) return null;
  return Math.round(score - niche.median);
}

/** Title-case a qualitative intent label: "high intent" → "High intent".
 *  undefined when absent — the engine emits these only on the persona aggregate. */
function intentChip(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tile value for an absolute predicted rate. A nonzero rate that rounds to 0
 *  (e.g. 0.28% share) reads as broken "0%"; show "<1" so a tiny-but-real
 *  prediction stays honest (a true zero still reads "0"). */
function pctValue(abs: number): string {
  if (abs <= 0) return '0';
  const rounded = Math.round(abs);
  return rounded === 0 ? '<1' : String(rounded);
}

/** The 4 behavioral tiles for the hero's StatTileRow (Share · Completion ·
 *  Comment · Save). Each value is the absolute predicted % the engine actually
 *  emits (`*_pct`); the sub-caption carries the qualitative intent label when
 *  present. Tiles whose absolute % is absent are omitted (never fabricated).
 *
 *  T1.2/T1.4: previously keyed on the `*_percentile` string parsed for a digit —
 *  but the engine emits digit-less intent labels ("high intent"), so the parse
 *  always returned null and every tile was dropped. Self-referential percentiles
 *  are gone; absolute rates + intent chips are the honest surface. Niche-cohort
 *  deltas are not derivable (the comparisons endpoint exposes only an aggregate
 *  score histogram, no per-metric cohort percentiles) — so no `delta` is attached. */
export function deriveBehavioralTiles(result: PredictionResult): StatTileData[] {
  const bp = result.behavioral_predictions;
  if (!bp) return [];

  const rows: Array<{ k: string; intent: string | undefined; abs: number | undefined }> = [
    { k: 'Share', intent: bp.share_percentile, abs: bp.share_pct },
    { k: 'Completion', intent: bp.completion_percentile, abs: bp.completion_pct },
    { k: 'Comment', intent: bp.comment_percentile, abs: bp.comment_pct },
    { k: 'Save', intent: bp.save_percentile, abs: bp.save_pct },
  ];

  const tiles: StatTileData[] = [];
  for (const r of rows) {
    if (typeof r.abs !== 'number' || !Number.isFinite(r.abs)) continue;
    tiles.push({
      k: r.k,
      v: pctValue(r.abs),
      u: '%',
      s: intentChip(r.intent),
    });
  }
  return tiles;
}

export interface GatedHero {
  /** Gate label shown as the hero status word. */
  word: string;
  /** One-line top-fix headline folded into the hero insight (was the lead of
   *  AntiViralityHeader + the first TopFixesList item). Null when no fix exists. */
  insight: string | null;
}

/** Folds the AV-gated state into the single hero: the gate label as status word
 *  and the first fix headline as the one-line insight. */
export function deriveGatedHero(result: PredictionResult): GatedHero {
  const n = fixCount(result.counterfactuals?.suggestions);
  const word =
    n > 0 ? `Don't post yet · fixable in ${n} ${n === 1 ? 'step' : 'steps'}` : 'Low confidence';
  const firstFix = result.counterfactuals?.suggestions.find(
    (s) => s.type === 'fix' && s.headline,
  );
  return { word, insight: firstFix?.headline ?? null };
}
