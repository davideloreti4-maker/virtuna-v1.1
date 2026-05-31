import type { PredictionResult } from '@/lib/engine/types';
import type { NicheCohort, ConfidenceRange } from './ScoreDistribution';
import type { SignalTile } from './SignalTiles';

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

export interface OneMove {
  headline: string;
  /** ms, only when a real video timestamp exists; null otherwise (suppressed for
   *  text/url modes where the audience filmstrip is empty). */
  timestampMs: number | null;
}

export function deriveOneMove(result: PredictionResult): OneMove | null {
  const fix = result.counterfactuals?.suggestions.find((s) => s.type === 'fix' && s.headline);
  if (fix) {
    const showTs = result.has_video && fix.timestamp_ms > 0;
    return { headline: fix.headline, timestampMs: showTs ? fix.timestamp_ms : null };
  }
  // Fallback: the weakest factor's improvement tip.
  const factors = result.factors ?? [];
  if (factors.length) {
    const weak = [...factors].sort((a, b) => a.score - b.score)[0]!;
    if (weak.improvement_tip) return { headline: weak.improvement_tip, timestampMs: null };
  }
  return null;
}

export function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
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

  const hook = result.weighted_hook_score;
  if (typeof hook === 'number' && Number.isFinite(hook)) {
    tiles.push({ k: 'Hook', v: hookTo10(hook), u: '/10', s: 'open' });
  }

  const completion = result.weighted_completion_pct;
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
