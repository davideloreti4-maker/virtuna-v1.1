import { describe, it, expect } from 'vitest';
import type { PredictionResult } from '@/lib/engine/types';
import {
  bandLabel,
  bandTone,
  comparativeLine,
  confidenceRange,
  deriveBehavioralTiles,
  deriveGatedHero,
  nicheDelta,
} from '../verdict-derive';
import type { NicheCohort } from '../ScoreDistribution';

const niche = (over: Partial<NicheCohort> = {}): NicheCohort => ({
  median: 50,
  p75: 65,
  count: 142,
  histogram: [],
  ...over,
});

// Minimal PredictionResult — derivations only read a handful of fields.
const result = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({
    overall_score: 77,
    confidence: 0.6,
    has_video: true,
    factors: [],
    ...over,
  }) as unknown as PredictionResult;

describe('confidenceRange', () => {
  it('is tight for high confidence, wide for low, and clamps to 0–100', () => {
    expect(confidenceRange(77, 0.95)).toEqual({ lo: 74, hi: 80 });
    const low = confidenceRange(50, 0.3);
    expect(low.hi - low.lo).toBeGreaterThan(20);
    expect(confidenceRange(95, 0.3).hi).toBe(100);
    expect(confidenceRange(5, 0.3).lo).toBe(0);
  });
});

describe('bandLabel', () => {
  it('maps score to honest verdict band', () => {
    expect(bandLabel(70)).toBe('High potential');
    expect(bandLabel(69)).toBe('Solid contender');
    expect(bandLabel(40)).toBe('Solid contender');
    expect(bandLabel(39)).toBe('Needs work');
  });
});

describe('comparativeLine — honest cohort position (never a fabricated percentile)', () => {
  it('top 25% when at/above p75', () => {
    expect(comparativeLine(77, niche())).toBe('top 25% of your niche · 142 posts');
  });
  it('above median when between median and p75', () => {
    expect(comparativeLine(55, niche({ count: 11 }))).toBe(
      'above your niche median · small sample (11)',
    );
  });
  it('below median when under median', () => {
    expect(comparativeLine(40, niche({ count: 30 }))).toBe('below your niche median · 30 posts');
  });
  it('prompts for handle when no niche', () => {
    expect(comparativeLine(77, null)).toBe('add your handle to rank vs your niche');
  });
});

// T4.5: deriveSignalTiles + its tests removed — the Score frame's "Engine signals"
// row duplicated numbers owned by Content-craft (hook) and Audience (retention).

/* ── redesign-v2 selectors ── */

describe('bandTone', () => {
  it('maps band → hero status tone', () => {
    expect(bandTone(70)).toBe('good');
    expect(bandTone(40)).toBe('warn');
    expect(bandTone(39)).toBe('crit');
  });
});

describe('nicheDelta — score vs niche median, in points (only with a cohort)', () => {
  it('returns rounded signed point gap when a niche exists', () => {
    expect(nicheDelta(77, niche({ median: 50 }))).toBe(27);
    expect(nicheDelta(40, niche({ median: 55 }))).toBe(-15);
  });
  it('returns null without a niche', () => {
    expect(nicheDelta(77, null)).toBeNull();
  });
});

describe('deriveBehavioralTiles — absolute predicted rates + intent chips', () => {
  const bp = (over = {}) =>
    result({
      behavioral_predictions: {
        completion_pct: 62,
        completion_percentile: 'high intent',
        share_pct: 8,
        share_percentile: 'very high intent',
        comment_pct: 5,
        comment_percentile: 'moderate intent',
        save_pct: 4,
        save_percentile: 'low intent',
        ...over,
      },
    } as Partial<PredictionResult>);

  it('builds the 4 tiles with absolute %% values + intent sub-captions, in order', () => {
    const tiles = deriveBehavioralTiles(bp());
    expect(tiles.map((t) => t.k)).toEqual(['Share', 'Completion', 'Comment', 'Save']);
    expect(tiles[0]).toMatchObject({ k: 'Share', v: '8', u: '%', s: 'Very high intent' });
    expect(tiles[1]).toMatchObject({ k: 'Completion', v: '62', u: '%', s: 'High intent' });
    // No niche-cohort per-metric percentiles exist → no delta attached.
    expect(tiles[0]!.delta).toBeUndefined();
  });

  it('omits the intent sub-caption when the label is absent (raw DeepSeek predictions)', () => {
    const tiles = deriveBehavioralTiles(bp({ comment_percentile: undefined }));
    expect(tiles.map((t) => t.k)).toEqual(['Share', 'Completion', 'Comment', 'Save']);
    expect(tiles.find((t) => t.k === 'Comment')!.s).toBeUndefined();
  });

  it('omits a tile whose absolute % is absent', () => {
    const tiles = deriveBehavioralTiles(bp({ comment_pct: undefined }));
    expect(tiles.map((t) => t.k)).toEqual(['Share', 'Completion', 'Save']);
  });

  it('shows "<1" for a nonzero rate that rounds to 0, and "0" for a true zero', () => {
    // Real WPk976kozfWs: share 0.28%, comment 0.09% → must NOT read "0%".
    const tiles = deriveBehavioralTiles(bp({ share_pct: 0.28, comment_pct: 0.09, save_pct: 0.65, completion_pct: 0 }));
    expect(tiles.find((t) => t.k === 'Share')!.v).toBe('<1');
    expect(tiles.find((t) => t.k === 'Comment')!.v).toBe('<1');
    expect(tiles.find((t) => t.k === 'Save')!.v).toBe('1'); // 0.65 → rounds to 1
    expect(tiles.find((t) => t.k === 'Completion')!.v).toBe('0'); // true zero stays 0
  });

  it('returns [] when behavioral_predictions is absent', () => {
    expect(
      deriveBehavioralTiles(result({ behavioral_predictions: undefined as unknown as PredictionResult['behavioral_predictions'] })),
    ).toEqual([]);
  });
});

describe('deriveGatedHero — folds AV header + first fix into the hero', () => {
  const cf = (suggestions: Array<{ type: string; headline: string }>) =>
    result({
      counterfactuals: { band: 'low', suggestions } as unknown as PredictionResult['counterfactuals'],
    });

  it('uses the gate label with a fixable-in-N step word + the first fix headline', () => {
    const r = cf([
      { type: 'fix', headline: 'Re-hook at 0:08' },
      { type: 'fix', headline: 'Tighten overlay' },
    ]);
    expect(deriveGatedHero(r)).toEqual({
      word: "Don't post yet · fixable in 2 steps",
      insight: 'Re-hook at 0:08',
    });
  });

  it('singularizes "step" for a single fix', () => {
    expect(deriveGatedHero(cf([{ type: 'fix', headline: 'x' }])).word).toBe(
      "Don't post yet · fixable in 1 step",
    );
  });

  it('falls back to "Low confidence" with null insight when there are no fixes', () => {
    expect(deriveGatedHero(result())).toEqual({ word: 'Low confidence', insight: null });
  });
});
