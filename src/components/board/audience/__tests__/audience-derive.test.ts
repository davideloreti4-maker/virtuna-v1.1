import { describe, it, expect } from 'vitest';
import {
  buildInsight,
  buildSegmentGroups,
  findBiggestDrop,
  formatTime,
  mixLabel,
  nicheGhostCurve,
  normalizeCurve,
  normalizeSlot,
  smoothPath,
  statusWord,
  totalDuration,
  worstBadGroupKey,
} from '../audience-derive';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import type { PersonaSimulationResult } from '@/lib/engine/types';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(21)).toBe('0:21');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(0)).toBe('0:00');
  });
  it('floors fractional seconds and clamps negatives', () => {
    expect(formatTime(21.9)).toBe('0:21');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('normalizeSlot', () => {
  it('maps niche_deep → niche', () => {
    expect(normalizeSlot('niche_deep')).toBe('niche');
  });
  it('passes through canonical slots', () => {
    expect(normalizeSlot('fyp')).toBe('fyp');
    expect(normalizeSlot('loyalist')).toBe('loyalist');
    expect(normalizeSlot('cross_niche')).toBe('cross_niche');
  });
  it('falls back to fyp for unknown', () => {
    expect(normalizeSlot('weird')).toBe('fyp');
  });
});

describe('normalizeCurve', () => {
  it('keeps 0-1 curves as-is', () => {
    expect(normalizeCurve([1, 0.5, 0])).toEqual([1, 0.5, 0]);
  });
  it('detects and rescales 0-100 curves', () => {
    expect(normalizeCurve([100, 50, 0])).toEqual([1, 0.5, 0]);
  });
  it('clamps out-of-range values', () => {
    expect(normalizeCurve([0.5, -0.2])).toEqual([0.5, 0]);
  });
});

describe('findBiggestDrop', () => {
  it('returns null for short curves', () => {
    expect(findBiggestDrop([])).toBeNull();
    expect(findBiggestDrop([0.9])).toBeNull();
  });
  it('finds the segment with the largest negative step', () => {
    const drop = findBiggestDrop([1, 0.95, 0.9, 0.5, 0.45]);
    expect(drop).not.toBeNull();
    expect(drop!.index).toBe(3); // 0.9 → 0.5 is the biggest drop
    expect(drop!.fromIndex).toBe(2);
    expect(drop!.delta).toBeCloseTo(0.4, 5);
  });
});

describe('statusWord', () => {
  it('returns thresholds', () => {
    expect(statusWord(85)).toBe('Holds strong');
    expect(statusWord(80)).toBe('Holds strong');
    expect(statusWord(65)).toBe('Holds well');
    expect(statusWord(45)).toBe('Leaky');
    expect(statusWord(30)).toBe('Drops fast');
  });
});

describe('totalDuration', () => {
  it('uses last segment t_end', () => {
    const hm = buildHeatmapFixture();
    expect(totalDuration(hm.segments, 99)).toBe(hm.segments[hm.segments.length - 1]!.t_end);
  });
  it('falls back when no segments', () => {
    expect(totalDuration(undefined, 42)).toBe(42);
    expect(totalDuration([], 42)).toBe(42);
  });
});

describe('mixLabel', () => {
  it('labels dominant slot', () => {
    expect(mixLabel({ fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 })).toBe('FYP-heavy');
    expect(mixLabel({ fyp: 0.1, niche: 0.7, loyalist: 0.1, cross_niche: 0.1 })).toBe('Niche-focused');
    expect(mixLabel({ fyp: 0.1, niche: 0.1, loyalist: 0.7, cross_niche: 0.1 })).toBe('Loyalist-focused');
    expect(mixLabel({ fyp: 0.1, niche: 0.1, loyalist: 0.1, cross_niche: 0.7 })).toBe('Cross-niche');
  });
});

describe('buildSegmentGroups', () => {
  it('folds heatmap personas into 4 slot groups with counts', () => {
    const hm = buildHeatmapFixture();
    const groups = buildSegmentGroups(hm, undefined, 21);
    expect(groups.map((g) => g.key)).toEqual(['fyp', 'niche', 'loyalist', 'cross_niche']);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.fyp!.count).toBe(6);
    expect(byKey.niche!.count).toBe(2); // 2 niche_deep_* personas folded into niche
    expect(byKey.loyalist!.count).toBe(1);
    expect(byKey.cross_niche!.count).toBe(1);
  });

  it('niche group is NOT empty despite the niche_deep slot drift', () => {
    const hm = buildHeatmapFixture();
    const groups = buildSegmentGroups(hm, undefined, 21);
    const niche = groups.find((g) => g.key === 'niche')!;
    expect(niche.count).toBeGreaterThan(0);
  });

  it('prefers sim results watch_through_pct (0-100) when available', () => {
    const hm = buildHeatmapFixture();
    const sims: PersonaSimulationResult[] = [
      {
        persona_id: 'p',
        archetype: 'high_engager',
        slot_type: 'fyp',
        niche: 'x',
        scroll_past_second: 1,
        watch_through_pct: 61,
        comment_intent: 0,
        share_intent: 0,
        save_intent: 0,
        rewatch_intent: 0,
        reasoning: 'r',
      },
      {
        persona_id: 'q',
        archetype: 'niche_deep_buyer',
        slot_type: 'niche_deep', // drift — must fold into niche
        niche: 'x',
        scroll_past_second: 1,
        watch_through_pct: 92,
        comment_intent: 0,
        share_intent: 0,
        save_intent: 0,
        rewatch_intent: 0,
        reasoning: 'r',
      },
    ];
    const groups = buildSegmentGroups(hm, sims, 21);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.fyp!.pct).toBeCloseTo(61, 5);
    expect(byKey.niche!.pct).toBeCloseTo(92, 5); // niche_deep sim joined into niche
  });

  it('templates descriptors', () => {
    const hm = buildHeatmapFixture();
    const groups = buildSegmentGroups(hm, undefined, 21);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.fyp!.desc).toBe('fade at 0:21');
    expect(byKey.niche!.desc).toBe('hold through');
    expect(byKey.loyalist!.desc).toBe('watch, then loop');
  });
});

describe('worstBadGroupKey', () => {
  it('returns null when all groups hold above ~40%', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined, 21).map((g) => ({
      ...g,
      pct: 70,
    }));
    expect(worstBadGroupKey(groups)).toBeNull();
  });
  it('returns the single worst group below 40%', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined, 21).map((g) => ({
      ...g,
      pct: g.key === 'cross_niche' ? 12 : 80,
    }));
    expect(worstBadGroupKey(groups)).toBe('cross_niche');
  });
  it('ignores groups with zero personas', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined, 21).map((g) => ({
      ...g,
      pct: 5,
      count: g.key === 'fyp' ? 6 : 0,
    }));
    expect(worstBadGroupKey(groups)).toBe('fyp');
  });
});

describe('buildInsight', () => {
  it('produces a leave-at sentence with coral time', () => {
    const hm = buildHeatmapFixture();
    const drop = findBiggestDrop(normalizeCurve(hm.weighted_curve));
    const groups = buildSegmentGroups(hm, undefined, hm.segments[drop!.index]!.t_start);
    const insight = buildInsight(hm.segments, drop, groups);
    expect(insight.lead).toBe('Most viewers leave at ');
    expect(insight.time).toMatch(/^\d:\d\d$/);
    expect(insight.tail).toContain('where');
  });
  it('falls back gracefully when no drop', () => {
    const insight = buildInsight([], null, []);
    expect(insight.time).toBeNull();
    expect(insight.lead).toContain('watch through');
  });
  it('appends the niche-stays addendum when niche >> fyp retention', () => {
    const segments = buildHeatmapFixture().segments;
    const drop = { index: 3, delta: 0.4, fromIndex: 2 };
    const groups = [
      { key: 'fyp' as const, label: 'New viewers', pct: 50, desc: '', count: 6 },
      { key: 'niche' as const, label: 'Your niche', pct: 90, desc: '', count: 2 },
    ];
    const insight = buildInsight(segments, drop, groups);
    expect(insight.addendum).toContain('niche stays');
  });
});

describe('nicheGhostCurve', () => {
  it('returns null when no niche personas', () => {
    const hm = buildHeatmapFixture();
    const noNiche = { ...hm, personas: hm.personas.filter((p) => p.slot_type !== 'niche') };
    expect(nicheGhostCurve(noNiche)).toBeNull();
  });
  it('returns a normalized per-segment mean for niche personas', () => {
    const hm = buildHeatmapFixture();
    const ghost = nicheGhostCurve(hm);
    expect(ghost).not.toBeNull();
    expect(ghost!.length).toBe(hm.segments.length);
    for (const v of ghost!) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('smoothPath', () => {
  it('returns empty for no points', () => {
    expect(smoothPath([])).toBe('');
  });
  it('produces a move command for a single point', () => {
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M1,2');
  });
  it('produces cubic Bézier segments for multiple points', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 25 },
    ]);
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d).toContain('C');
  });
});
