import { describe, it, expect } from 'vitest';
import type { PredictionResult } from '@/lib/engine/types';
import {
  bandLabel,
  comparativeLine,
  confidenceRange,
  deriveOneMove,
  deriveSignalTiles,
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

describe('deriveOneMove', () => {
  const cf = (over = {}) => ({
    band: 'mid' as const,
    suggestions: [
      { type: 'fix' as const, headline: 'Add a replay beat', detail: 'd', timestamp_ms: 6000, signal_anchor: 'a' },
      ...[],
    ],
    ...over,
  });

  it('prefers the first counterfactual fix and shows its timestamp for video', () => {
    expect(deriveOneMove(result({ counterfactuals: cf() }))).toEqual({
      headline: 'Add a replay beat',
      timestampMs: 6000,
    });
  });
  it('suppresses the timestamp for non-video modes (no filmstrip to jump to)', () => {
    expect(deriveOneMove(result({ counterfactuals: cf(), has_video: false }))).toEqual({
      headline: 'Add a replay beat',
      timestampMs: null,
    });
  });
  it('falls back to the weakest factor tip when no counterfactuals', () => {
    const r = result({
      factors: [
        { id: 'a', name: 'Strong', score: 8, max_score: 10, rationale: '', improvement_tip: 'keep' },
        { id: 'b', name: 'Weak', score: 4, max_score: 10, rationale: '', improvement_tip: 'lift the weak one' },
      ],
    });
    expect(deriveOneMove(r)).toEqual({ headline: 'lift the weak one', timestampMs: null });
  });
  it('returns null with no data', () => {
    expect(deriveOneMove(result())).toBeNull();
  });
});

describe('deriveSignalTiles — only present fields, defensive scales', () => {
  it('normalizes hook to /10 regardless of 0-1 | 0-10 | 0-100 scale', () => {
    expect(deriveSignalTiles(result({ weighted_hook_score: 0.72 }))[0]).toMatchObject({ k: 'Hook', v: '7.2' });
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
    expect(tiles.find((t) => t.k === 'Completion')).toMatchObject({ v: '68', u: '%' });
    expect(tiles.find((t) => t.k === 'Sound')).toMatchObject({ v: 'Rising', em: 'vel 87' });
    expect(tiles.find((t) => t.k === 'TikTok fit')).toMatchObject({ v: '72', u: '/100' });
  });
  it('omits tiles whose source data is absent', () => {
    expect(deriveSignalTiles(result())).toEqual([]);
  });
});
