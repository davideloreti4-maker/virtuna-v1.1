import type { PredictionResult } from '@/lib/engine/types';
import type { NicheCohort, ConfidenceRange } from './ScoreDistribution';
import type { SignalTile } from './SignalTiles';
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

/** Hook score arrives on an uncertain scale (0-1 | 0-10 | 0-100 across engine
 *  versions). Normalize to a 0-10 display defensively rather than assume. */
function hookTo10(v: number): string {
  const s = v <= 1 ? v * 10 : v <= 10 ? v : v / 10;
  return s.toFixed(1);
}

/** Surfaces engine signals unused by the old Score frame. Each tile is included
 *  only when its source field is present + finite. */
export function deriveSignalTiles(result: PredictionResult): SignalTile[] {
  const tiles: SignalTile[] = [];

  // Top-level fields exist on the LIVE SSE result but are NOT persisted (no DB
  // column) — fall back to the mirror persisted inside heatmap so these tiles
  // survive permalink reload. (Same live-vs-persisted split as the craft frame.)
  const hook = result.weighted_hook_score ?? result.heatmap?.weighted_hook_score;
  if (typeof hook === 'number' && Number.isFinite(hook)) {
    tiles.push({ k: 'Hook', v: hookTo10(hook), u: '/10', s: 'open' });
  }

  const completion = result.weighted_completion_pct ?? result.heatmap?.weighted_completion_pct;
  if (typeof completion === 'number' && Number.isFinite(completion)) {
    tiles.push({
      k: 'Completion',
      v: String(Math.round(completion * 100)),
      u: '%',
      s: 'watch-through',
    });
  }

  const sound = result.matched_trends?.[0];
  if (sound) {
    tiles.push({
      k: 'Sound',
      v: sound.trend_phase ?? 'Matched',
      em: `vel ${Math.round(sound.velocity_score)}`,
      s: 'trending',
    });
  }

  const fit = (result.platform_fit as { fit_score?: number } | null | undefined)?.fit_score;
  if (typeof fit === 'number' && Number.isFinite(fit)) {
    tiles.push({ k: 'TikTok fit', v: String(Math.round(fit)), u: '/100', s: 'platform' });
  }

  return tiles.slice(0, 4);
}

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

/** Parses an engine percentile string ("74th", "9th", "100th") to its integer.
 *  Returns null for the malformed / empty case so the tile can degrade. */
export function parsePercentile(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /\d+/.exec(raw);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** The 4 behavioral-percentile tiles for the hero's StatTileRow (Share ·
 *  Completion · Comment · Save). Each value is the raw engine percentile; the
 *  sub-caption carries the predicted absolute %. Tiles whose percentile is
 *  absent are omitted (never fabricated). Niche-cohort deltas are not derivable
 *  — the comparisons endpoint exposes only an aggregate score histogram, no
 *  per-metric cohort percentiles — so no `delta` is attached. */
/** "X% predicted" — but a nonzero rate that rounds to 0 (e.g. 0.28% share) reads
 *  as broken "0% predicted". Show "<1%" so a tiny-but-real prediction stays honest
 *  (a true zero still reads "0%"). */
function predictedPctLabel(abs: number): string {
  if (abs <= 0) return '0% predicted';
  const rounded = Math.round(abs);
  return rounded === 0 ? '<1% predicted' : `${rounded}% predicted`;
}

export function deriveBehavioralTiles(result: PredictionResult): StatTileData[] {
  const bp = result.behavioral_predictions;
  if (!bp) return [];

  const rows: Array<{ k: string; pctl: string | undefined; abs: number | undefined }> = [
    { k: 'Share', pctl: bp.share_percentile, abs: bp.share_pct },
    { k: 'Completion', pctl: bp.completion_percentile, abs: bp.completion_pct },
    { k: 'Comment', pctl: bp.comment_percentile, abs: bp.comment_pct },
    { k: 'Save', pctl: bp.save_percentile, abs: bp.save_pct },
  ];

  const tiles: StatTileData[] = [];
  for (const r of rows) {
    const p = parsePercentile(r.pctl);
    if (p == null) continue;
    tiles.push({
      k: r.k,
      v: String(p),
      u: 'th',
      s: typeof r.abs === 'number' && Number.isFinite(r.abs) ? predictedPctLabel(r.abs) : undefined,
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
