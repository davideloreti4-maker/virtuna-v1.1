import { describe, it, expect } from 'vitest';
import {
  recomputeWeightedCurve,
  normalizeOverSurvivors,
  getPersonaWeight,
} from '../weighted-aggregator-client';
import { buildWeightedCurve, type Pass2PersonaResult } from '../weighted-aggregator';
import type { PersonaWeights } from '@/lib/engine/persona-weights';
import { buildHeatmapFixture } from '../../../../components/board/audience/__tests__/fixtures/heatmap-fixture';

/** Convert HeatmapPayload persona + matching SegmentGrid info into Pass2PersonaResult for server parity test. */
function makePass2FromPayloadPersona(
  persona: ReturnType<typeof buildHeatmapFixture>['personas'][number],
  segments: ReturnType<typeof buildHeatmapFixture>['segments'],
): Pass2PersonaResult {
  return {
    persona_id: persona.id,
    archetype: 'high_engager',
    slot_type: persona.slot_type,
    segment_reactions: segments.map((s, i) => ({
      t_start: s.t_start,
      t_end: s.t_end,
      attention: persona.attentions[i] ?? 0,
      reason: persona.segment_reasons[i],
      swipe_predicted: false,
    })),
    pass2_latency_ms: 100,
    pass2_cost_cents: 0.01,
  };
}

const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05,
};

describe('weighted-aggregator-client', () => {
  it('recomputeWeightedCurve numerical parity vs server buildWeightedCurve', () => {
    const fixture = buildHeatmapFixture();
    const { personas, segments } = fixture;

    // Build server-compatible Pass2PersonaResult[] from payload personas
    const pass2Results = personas.map((p) =>
      makePass2FromPayloadPersona(p, segments),
    );

    // Build server SegmentGrid[] from payload segments (only t_start, t_end, is_hook_zone needed)
    const segmentGrids = segments.map((s) => ({
      t_start: s.t_start,
      t_end: s.t_end,
      visual_event: s.label ?? '',
      audio_event: '',
      is_hook_zone: s.is_hook_zone,
      idx: s.idx,
    }));

    const serverResult = buildWeightedCurve(pass2Results, segmentGrids, DEFAULT_WEIGHTS);
    const clientResult = recomputeWeightedCurve(personas, segments, DEFAULT_WEIGHTS);

    // Per-segment parity — must be < 1e-9 difference
    expect(clientResult.weighted_curve).toHaveLength(serverResult.weighted_curve.length);
    for (let j = 0; j < serverResult.weighted_curve.length; j++) {
      expect(Math.abs((clientResult.weighted_curve[j] ?? 0) - (serverResult.weighted_curve[j] ?? 0))).toBeLessThan(1e-9);
    }

    // Headline metrics parity
    expect(Math.abs(clientResult.weighted_completion_pct - serverResult.weighted_completion_pct)).toBeLessThan(1e-9);
    expect(Math.abs(clientResult.weighted_top_dropoff_t - serverResult.weighted_top_dropoff_t)).toBeLessThan(1e-9);
    expect(Math.abs(clientResult.weighted_hook_score - serverResult.weighted_hook_score)).toBeLessThan(1e-9);
  });

  it('normalizeOverSurvivors zeros missing slot_types and renormalizes to sum 1.0', () => {
    const personas = [
      { id: 'p0', slot_type: 'fyp' as const, archetype: 'high_engager', attentions: [0.8], swipe_predicted_at: null, segment_reasons: {} },
      { id: 'p1', slot_type: 'niche' as const, archetype: 'niche_deep', attentions: [0.6], swipe_predicted_at: null, segment_reasons: {} },
      // loyalist and cross_niche are absent
    ];
    const result = normalizeOverSurvivors(personas, DEFAULT_WEIGHTS);

    // Absent types should be zero
    expect(result.loyalist).toBe(0);
    expect(result.cross_niche).toBe(0);

    // Present types should be non-zero
    expect(result.fyp).toBeGreaterThan(0);
    expect(result.niche).toBeGreaterThan(0);

    // Sum should normalize to 1.0
    const total = result.fyp + result.niche + result.loyalist + result.cross_niche;
    expect(total).toBeCloseTo(1.0, 9);
  });

  it('getPersonaWeight remaps niche_deep → niche', () => {
    const w: PersonaWeights = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };

    // niche_deep should map to niche weight
    expect(getPersonaWeight('niche_deep', w)).toBe(0.20);
    expect(getPersonaWeight('niche', w)).toBe(0.20);

    // Other slot types map directly
    expect(getPersonaWeight('fyp', w)).toBe(0.65);
    expect(getPersonaWeight('loyalist', w)).toBe(0.10);
    expect(getPersonaWeight('cross_niche', w)).toBe(0.05);

    // Unknown key returns 0
    expect(getPersonaWeight('unknown_type', w)).toBe(0);
  });

  it('all-zero attentions returns all-zero curve', () => {
    const personas = [
      { id: 'p0', slot_type: 'fyp' as const, archetype: 'high_engager', attentions: [0, 0, 0, 0], swipe_predicted_at: null, segment_reasons: {} },
      { id: 'p1', slot_type: 'niche' as const, archetype: 'niche_deep', attentions: [0, 0, 0, 0], swipe_predicted_at: null, segment_reasons: {} },
    ];
    const segments = [
      { idx: 0, t_start: 0, t_end: 3, is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 3, t_end: 6, is_hook_zone: true, keyframe_uri: null },
      { idx: 2, t_start: 6, t_end: 9, is_hook_zone: false, keyframe_uri: null },
      { idx: 3, t_start: 9, t_end: 12, is_hook_zone: false, keyframe_uri: null },
    ];
    const result = recomputeWeightedCurve(personas, segments, DEFAULT_WEIGHTS);

    result.weighted_curve.forEach((v) => expect(v).toBe(0));
    expect(result.weighted_completion_pct).toBe(0);
    expect(result.weighted_hook_score).toBe(0);
  });
});
