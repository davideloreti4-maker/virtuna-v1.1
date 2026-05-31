import { describe, it, expect } from 'vitest';
import type { PredictionResult } from '@/lib/engine/types';
import {
  bandLabel,
  bandTone,
  comparativeLine,
  confidenceRange,
  deriveBehavioralTiles,
  deriveGatedHero,
  deriveSignalTiles,
  nicheDelta,
  parsePercentile,
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

describe('deriveSignalTiles — only present fields, defensive scales', () => {
  it('normalizes hook to /10 and tags it as the weighted-panel hold (not the craft hook)', () => {
    expect(deriveSignalTiles(result({ weighted_hook_score: 0.72 }))[0]).toMatchObject({ k: 'Hook', v: '7.2', s: 'weighted hold' });
    expect(deriveSignalTiles(result({ weighted_hook_score: 7.2 }))[0]).toMatchObject({ v: '7.2' });
    expect(deriveSignalTiles(result({ weighted_hook_score: 72 }))[0]).toMatchObject({ v: '7.2' });
  });
  it('builds completion %, sound, and platform fit from real fields', () => {
    const tiles = deriveSignalTiles(
      result({
        weighted_completion_pct: 0.68,
        matched_trends: [{ sound_name: 's', velocity_score: 87, trend_phase: 'Rising' }],
        platform_fit: { fit_score: 72 } as unknown as PredictionResult['platform_fit'],
      }),
    );
    // Provenance tag distinguishes this from the Audience predicted watch-through.
    expect(tiles.find((t) => t.k === 'Completion')).toMatchObject({ v: '68', u: '%', s: 'weighted curve' });
    expect(tiles.find((t) => t.k === 'Sound')).toMatchObject({ v: 'Rising', em: 'vel 87' });
    expect(tiles.find((t) => t.k === 'TikTok fit')).toMatchObject({ v: '72', u: '/100' });
  });
  it('omits tiles whose source data is absent', () => {
    expect(deriveSignalTiles(result())).toEqual([]);
  });
  it('falls back to heatmap mirror when top-level weighted_* absent (permalink reload)', () => {
    // Live SSE carries weighted_* top-level; the persisted DB row drops them and
    // only the heatmap mirror survives. Both Hook + Completion must still render.
    const reloaded = result({
      weighted_hook_score: undefined,
      weighted_completion_pct: undefined,
      heatmap: { weighted_hook_score: 4.8, weighted_completion_pct: 0.15 } as unknown as PredictionResult['heatmap'],
    });
    const tiles = deriveSignalTiles(reloaded);
    expect(tiles.find((t) => t.k === 'Hook')).toMatchObject({ v: '4.8', u: '/10' });
    expect(tiles.find((t) => t.k === 'Completion')).toMatchObject({ v: '15', u: '%' });
  });
  it('prefers the top-level value over the heatmap mirror when both present', () => {
    const tiles = deriveSignalTiles(
      result({
        weighted_hook_score: 7.2,
        heatmap: { weighted_hook_score: 1.0 } as unknown as PredictionResult['heatmap'],
      }),
    );
    expect(tiles.find((t) => t.k === 'Hook')).toMatchObject({ v: '7.2' });
  });
});

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

describe('parsePercentile', () => {
  it('extracts the integer from "Nth" forms', () => {
    expect(parsePercentile('74th')).toBe(74);
    expect(parsePercentile('9th')).toBe(9);
    expect(parsePercentile('100th')).toBe(100);
  });
  it('returns null for empty / malformed', () => {
    expect(parsePercentile(undefined)).toBeNull();
    expect(parsePercentile('')).toBeNull();
    expect(parsePercentile('top')).toBeNull();
  });
});

describe('deriveBehavioralTiles — Share/Completion/Comment/Save percentiles', () => {
  const bp = (over = {}) =>
    result({
      behavioral_predictions: {
        completion_pct: 62,
        completion_percentile: '74th',
        share_pct: 8,
        share_percentile: '80th',
        comment_pct: 5,
        comment_percentile: '70th',
        save_pct: 4,
        save_percentile: '68th',
        ...over,
      },
    } as Partial<PredictionResult>);

  it('builds the 4 percentile tiles with predicted-% sub-captions, in order', () => {
    const tiles = deriveBehavioralTiles(bp());
    expect(tiles.map((t) => t.k)).toEqual(['Share', 'Completion', 'Comment', 'Save']);
    expect(tiles[0]).toMatchObject({ k: 'Share', v: '80', u: 'th', s: '8% predicted' });
    expect(tiles[1]).toMatchObject({ k: 'Completion', v: '74', s: '62% predicted' });
    // No niche-cohort per-metric percentiles exist → no delta attached.
    expect(tiles[0]!.delta).toBeUndefined();
  });

  it('omits a tile whose percentile is malformed', () => {
    const tiles = deriveBehavioralTiles(bp({ comment_percentile: '' }));
    expect(tiles.map((t) => t.k)).toEqual(['Share', 'Completion', 'Save']);
  });

  it('shows "<1% predicted" for a nonzero rate that rounds to 0, and "0%" for a true zero', () => {
    // Real WPk976kozfWs: share 0.28%, comment 0.09% → must NOT read "0% predicted".
    const tiles = deriveBehavioralTiles(bp({ share_pct: 0.28, comment_pct: 0.09, save_pct: 0.65, completion_pct: 0 }));
    expect(tiles.find((t) => t.k === 'Share')!.s).toBe('<1% predicted');
    expect(tiles.find((t) => t.k === 'Comment')!.s).toBe('<1% predicted');
    expect(tiles.find((t) => t.k === 'Save')!.s).toBe('1% predicted'); // 0.65 → rounds to 1
    expect(tiles.find((t) => t.k === 'Completion')!.s).toBe('0% predicted'); // true zero stays 0%
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
