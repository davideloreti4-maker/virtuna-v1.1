import { describe, it, expect } from 'vitest';
import {
  averageWatchThrough,
  buildDropMoments,
  buildInsight,
  buildPersonaNodes,
  buildRetentionTrend,
  buildSegmentGroups,
  cohortDropFrame,
  findBiggestDrop,
  formatTime,
  heroVerdict,
  mixLabel,
  nicheGhostCurve,
  normalizeCurve,
  normalizeSlot,
  personasFinishing,
  smoothPath,
  statusWord,
  toRetentionCurve,
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

describe('toRetentionCurve', () => {
  it('anchors the hook to 100% even when attention opens below 1', () => {
    // hook attention 0.5 → retention opens at 1.0, decays relative to the hook
    expect(toRetentionCurve([0.5, 0.4, 0.25])).toEqual([1, 0.8, 0.5]);
  });
  it('models the "30% leave → drops 30%" mental model', () => {
    // attention falls to 70% of the hook → 70% retention
    const r = toRetentionCurve([1, 0.7, 0.5]);
    expect(r[0]).toBe(1);
    expect(r[1]).toBeCloseTo(0.7, 5);
    expect(r[2]).toBeCloseTo(0.5, 5);
  });
  it('is monotonic non-increasing — viewers who left do not return', () => {
    // attention recovers (0.4 → 0.9) but retention holds flat at the floor
    const r = toRetentionCurve([1, 0.4, 0.9, 0.95]);
    expect(r).toEqual([1, 0.4, 0.4, 0.4]);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1]!);
  });
  it('clamps attention rising above the hook to a flat 100%', () => {
    expect(toRetentionCurve([0.5, 0.8, 0.6, 0.3])).toEqual([1, 1, 1, 0.6]);
  });
  it('is identity on a curve that is already a proper survival curve', () => {
    const survival = [1, 0.95, 0.9, 0.55, 0.55, 0.25, 0.2];
    expect(toRetentionCurve(survival)).toEqual(survival);
  });
  it('handles a degenerate zero-attention hook by anchoring to the peak', () => {
    expect(toRetentionCurve([0, 0.8, 0.4])).toEqual([0, 0, 0]);
  });
  it('handles empty and single-point curves', () => {
    expect(toRetentionCurve([])).toEqual([]);
    expect(toRetentionCurve([0.42])).toEqual([1]);
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
    const groups = buildSegmentGroups(hm, undefined);
    expect(groups.map((g) => g.key)).toEqual(['fyp', 'niche', 'loyalist', 'cross_niche']);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.fyp!.count).toBe(6);
    expect(byKey.niche!.count).toBe(2); // 2 niche_deep_* personas folded into niche
    expect(byKey.loyalist!.count).toBe(1);
    expect(byKey.cross_niche!.count).toBe(1);
  });

  it('niche group is NOT empty despite the niche_deep slot drift', () => {
    const hm = buildHeatmapFixture();
    const groups = buildSegmentGroups(hm, undefined);
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
    const groups = buildSegmentGroups(hm, sims);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.fyp!.pct).toBeCloseTo(61, 5);
    expect(byKey.niche!.pct).toBeCloseTo(92, 5); // niche_deep sim joined into niche
  });

  it('derives descriptors from each group pct (never contradicts the %)', () => {
    const hm = buildHeatmapFixture();
    const groups = buildSegmentGroups(hm, undefined);
    const expected = (pct: number) =>
      pct >= 85
        ? 'watches, loops'
        : pct >= 70
          ? 'holds through'
          : pct >= 55
            ? 'fades late'
            : pct >= 40
              ? 'drops midway'
              : 'leaves early';
    for (const g of groups) {
      expect(g.desc).toBe(expected(g.pct));
    }
  });

  it('a low-% group never claims it "holds through" (screenshot regression)', () => {
    const hm = buildHeatmapFixture();
    const sims: PersonaSimulationResult[] = [
      {
        persona_id: 'q',
        archetype: 'niche_deep_buyer',
        slot_type: 'niche_deep',
        niche: 'x',
        scroll_past_second: 1,
        watch_through_pct: 49, // niche at 49% must NOT read "hold through"
        comment_intent: 0,
        share_intent: 0,
        save_intent: 0,
        rewatch_intent: 0,
        reasoning: 'r',
      },
    ];
    const niche = buildSegmentGroups(hm, sims).find((g) => g.key === 'niche')!;
    expect(niche.pct).toBeCloseTo(49, 5);
    expect(niche.desc).toBe('drops midway');
  });
});

describe('worstBadGroupKey', () => {
  it('returns null when all groups hold above ~40%', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined).map((g) => ({
      ...g,
      pct: 70,
    }));
    expect(worstBadGroupKey(groups)).toBeNull();
  });
  it('returns the single worst group below 40%', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined).map((g) => ({
      ...g,
      pct: g.key === 'cross_niche' ? 12 : 80,
    }));
    expect(worstBadGroupKey(groups)).toBe('cross_niche');
  });
  it('ignores groups with zero personas', () => {
    const groups = buildSegmentGroups(buildHeatmapFixture(), undefined).map((g) => ({
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
    const groups = buildSegmentGroups(hm, undefined);
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
  it('clamps a long segment label and never emits a double period', () => {
    const segments = [
      {
        idx: 0,
        t_start: 0,
        t_end: 10,
        label: 'intro',
        is_hook_zone: true,
        keyframe_uri: null as string | null,
      },
      {
        idx: 1,
        t_start: 21,
        t_end: 29,
        // a real, verbose label that already ends in a period (the ".." source)
        label: "Actor as the 'guy' character delivers the final punchline about his friend.",
        is_hook_zone: false,
        keyframe_uri: null as string | null,
      },
    ];
    const drop = { index: 1, delta: 0.31, fromIndex: 0 };
    const insight = buildInsight(segments, drop, []);
    expect(insight.tail).not.toContain('..');
    // clamped to ≤7 words + ellipsis, no stray trailing period before it
    expect(insight.tail).toMatch(/^, where .+…$/);
    expect(insight.tail.split(' ').length).toBeLessThanOrEqual(9); // ", where" + ≤7 words
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

describe('buildPersonaNodes', () => {
  it('returns [] when no heatmap / no personas', () => {
    expect(buildPersonaNodes(null, undefined, null)).toEqual([]);
    expect(buildPersonaNodes({ ...buildHeatmapFixture(), personas: [] }, undefined, null)).toEqual([]);
  });

  it('maps every persona to a node with id, label, weight 0-1, watchThrough 0-1', () => {
    const hm = buildHeatmapFixture();
    const nodes = buildPersonaNodes(hm, undefined, null);
    expect(nodes).toHaveLength(hm.personas.length);
    for (const n of nodes) {
      expect(typeof n.id).toBe('string');
      expect(typeof n.label).toBe('string');
      expect(n.weight).toBeGreaterThanOrEqual(0);
      expect(n.weight).toBeLessThanOrEqual(1);
      expect(n.watchThrough).toBeGreaterThanOrEqual(0);
      expect(n.watchThrough).toBeLessThanOrEqual(1);
    }
    // largest-attention persona is max-normalized to weight 1.
    expect(Math.max(...nodes.map((n) => n.weight))).toBeCloseTo(1, 5);
  });

  it('prefers sim watch_through_pct (0-100 → 0-1) joined by persona_id', () => {
    const hm = buildHeatmapFixture();
    const sims: PersonaSimulationResult[] = [
      {
        persona_id: hm.personas[0]!.id,
        archetype: 'high_engager',
        slot_type: 'fyp',
        niche: 'x',
        scroll_past_second: 1,
        watch_through_pct: 80,
        comment_intent: 0,
        share_intent: 0,
        save_intent: 0,
        rewatch_intent: 0,
        reasoning: 'r',
      },
    ];
    const nodes = buildPersonaNodes(hm, sims, null);
    const target = nodes.find((n) => n.id === hm.personas[0]!.id)!;
    expect(target.watchThrough).toBeCloseTo(0.8, 5);
  });

  it("paints only the badKey slot's nodes coral (tone=accent)", () => {
    const hm = buildHeatmapFixture();
    const nodes = buildPersonaNodes(hm, undefined, 'cross_niche');
    const accented = nodes.filter((n) => n.tone === 'accent');
    expect(accented.length).toBe(1); // one cross_niche persona in the fixture
    expect(accented.every((n) => n.segment === 'Cross-niche')).toBe(true);
    // no badKey ⇒ no accent.
    expect(buildPersonaNodes(hm, undefined, null).every((n) => n.tone === 'default')).toBe(true);
  });

  it('sets dropAt only when swipe_predicted_at is present', () => {
    const hm = buildHeatmapFixture();
    hm.personas[0]!.swipe_predicted_at = 21;
    const nodes = buildPersonaNodes(hm, undefined, null);
    expect(nodes[0]!.dropAt).toBe('0:21');
    expect(nodes[1]!.dropAt).toBeUndefined();
  });
});

describe('averageWatchThrough', () => {
  it('returns null for no nodes', () => {
    expect(averageWatchThrough([])).toBeNull();
  });
  it('returns the mean as a 0-100 int', () => {
    const nodes = [
      { id: 'a', label: 'A', weight: 1, watchThrough: 0.5 },
      { id: 'b', label: 'B', weight: 1, watchThrough: 1 },
    ];
    expect(averageWatchThrough(nodes)).toBe(75);
  });
});

describe('personasFinishing', () => {
  it('counts nodes at/above the threshold', () => {
    const nodes = [
      { id: 'a', label: 'A', weight: 1, watchThrough: 0.95 },
      { id: 'b', label: 'B', weight: 1, watchThrough: 0.9 },
      { id: 'c', label: 'C', weight: 1, watchThrough: 0.4 },
    ];
    expect(personasFinishing(nodes)).toEqual({ finishing: 2, total: 3 });
  });
});

describe('heroVerdict', () => {
  it('maps bands to a single word + tone', () => {
    expect(heroVerdict(85)).toEqual({ word: 'Strong', tone: 'good' });
    expect(heroVerdict(65)).toEqual({ word: 'Solid', tone: 'good' });
    expect(heroVerdict(45)).toEqual({ word: 'Leaky', tone: 'warn' });
    expect(heroVerdict(20)).toEqual({ word: 'Drops', tone: 'crit' });
  });
});

describe('buildRetentionTrend', () => {
  it('returns [] when no curve', () => {
    expect(buildRetentionTrend(null, buildHeatmapFixture(), 30, null)).toEqual([]);
  });
  it('maps the weighted curve to current (0-100) keyed by segment t_start', () => {
    const hm = buildHeatmapFixture();
    const trend = buildRetentionTrend(hm.weighted_curve, hm, totalDuration(hm.segments, 30), null);
    expect(trend).toHaveLength(hm.weighted_curve.length);
    expect(trend[0]!.x).toBe(hm.segments[0]!.t_start);
    expect(trend[0]!.current).toBe(100); // weighted_curve[0] = 1
    for (const p of trend) {
      expect(p.current).toBeGreaterThanOrEqual(0);
      expect(p.current).toBeLessThanOrEqual(100);
    }
  });
  it('adds the niche ghost as previous when niche personas exist', () => {
    const hm = buildHeatmapFixture();
    const trend = buildRetentionTrend(hm.weighted_curve, hm, totalDuration(hm.segments, 30), null);
    expect(trend.some((p) => p.previous != null)).toBe(true);
  });
  it('falls back to a flat niche-completion line as previous when no niche curve', () => {
    const hm = { ...buildHeatmapFixture(), personas: buildHeatmapFixture().personas.filter((p) => p.slot_type !== 'niche') };
    const trend = buildRetentionTrend(hm.weighted_curve, hm, totalDuration(hm.segments, 30), 0.6);
    expect(trend.every((p) => p.previous === 60)).toBe(true);
  });
});

describe('buildDropMoments', () => {
  it('returns [] when no curve / too-short curve / no segments', () => {
    const hm = buildHeatmapFixture();
    expect(buildDropMoments(null, hm.segments, {})).toEqual([]);
    expect(buildDropMoments([1], hm.segments, {})).toEqual([]);
    expect(buildDropMoments(hm.weighted_curve, [], {})).toEqual([]);
  });

  it('returns [] when the curve only ever rises (no downward steps)', () => {
    const hm = buildHeatmapFixture();
    const rising = hm.weighted_curve.map((_, i) => i * 0.05); // strictly increasing
    expect(buildDropMoments(rising, hm.segments, {})).toEqual([]);
  });

  it('picks the biggest drop + next-worst, time-ordered, with one worst', () => {
    const hm = buildHeatmapFixture();
    // Engineer distinct drops: big at idx3, medium at idx6, small at idx1.
    const curve = [1, 0.97, 0.97, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2];
    const moments = buildDropMoments(curve, hm.segments, {}, 3);
    expect(moments).toHaveLength(3);
    // returned in time order (ascending index)
    const idxs = moments.map((m) => m.index);
    expect([...idxs].sort((a, b) => a - b)).toEqual(idxs);
    // exactly one worst, and it's the biggest drop (idx 3: 0.97 → 0.5 = 0.47)
    const worst = moments.filter((m) => m.worst);
    expect(worst).toHaveLength(1);
    expect(worst[0]!.index).toBe(3);
    // each carries an mm:ss timecode + a non-negative delta%
    for (const m of moments) {
      expect(m.timecode).toMatch(/^\d:\d\d$/);
      expect(m.deltaPct).toBeGreaterThanOrEqual(0);
    }
  });

  it('caps at `max` moments', () => {
    const hm = buildHeatmapFixture();
    const curve = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]; // 9 drops
    expect(buildDropMoments(curve, hm.segments, {}, 3)).toHaveLength(3);
    expect(buildDropMoments(curve, hm.segments, {}, 5)).toHaveLength(5);
  });

  it('resolves a real keyframe URL from the filmstrip map by segment position', () => {
    const hm = buildHeatmapFixture();
    const curve = [1, 0.97, 0.97, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2];
    const filmstrips = { 3: 'https://signed/frame-3.jpg', 6: 'https://signed/frame-6.jpg' };
    const moments = buildDropMoments(curve, hm.segments, filmstrips, 3);
    const m3 = moments.find((m) => m.index === 3)!;
    expect(m3.url).toBe('https://signed/frame-3.jpg');
    const m6 = moments.find((m) => m.index === 6)!;
    expect(m6.url).toBe('https://signed/frame-6.jpg');
  });

  it('yields a null url (caller draws fallback) when no frame exists for that moment', () => {
    const hm = buildHeatmapFixture();
    const curve = [1, 0.97, 0.97, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2];
    const moments = buildDropMoments(curve, hm.segments, {}, 1);
    expect(moments[0]!.url).toBeNull();
  });
});

describe('cohortDropFrame', () => {
  it('returns null with no heatmap / no segments / no personas in slot', () => {
    expect(cohortDropFrame(null, 'fyp', {})).toBeNull();
    const hm = buildHeatmapFixture();
    expect(cohortDropFrame({ ...hm, segments: [] }, 'fyp', {})).toBeNull();
    // remove all niche personas → niche cohort has no frame
    const noNiche = { ...hm, personas: hm.personas.filter((p) => normalizeSlot(p.slot_type) !== 'niche') };
    expect(cohortDropFrame(noNiche, 'niche', {})).toBeNull();
  });

  it('uses the cohort mean swipe time and resolves that frame + timecode', () => {
    const hm = buildHeatmapFixture();
    // fyp personas are indices 0-5; give them a mean swipe at 21s → segment idx 7 (t 21-24).
    for (const p of hm.personas) {
      if (normalizeSlot(p.slot_type) === 'fyp') p.swipe_predicted_at = 21;
    }
    const frame = cohortDropFrame(hm, 'fyp', { 7: 'https://signed/frame-7.jpg' });
    expect(frame).not.toBeNull();
    expect(frame!.timecode).toBe('0:21');
    expect(frame!.url).toBe('https://signed/frame-7.jpg');
  });

  it('falls back to the cohort lowest-attention segment when no swipe time', () => {
    const hm = buildHeatmapFixture();
    // loyalist persona is index 8 — no swipe times set in fixture.
    const frame = cohortDropFrame(hm, 'loyalist', {});
    expect(frame).not.toBeNull();
    expect(frame!.timecode).toMatch(/^\d:\d\d$/);
    expect(frame!.url).toBeNull(); // empty filmstrips → fallback gradient at the view
  });
});
