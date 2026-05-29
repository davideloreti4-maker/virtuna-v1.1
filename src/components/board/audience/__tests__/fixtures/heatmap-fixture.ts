import type { HeatmapPayload } from '@/lib/engine/types';

/**
 * PERSONA_SLOT_ORDER: fixed archetype slot mapping (Phase 4 D-05).
 * 6 FYP slots + 2 niche + 1 loyalist + 1 cross_niche = 10 total.
 */
export const PERSONA_SLOT_ORDER = [
  'fyp', 'fyp', 'fyp', 'fyp', 'fyp', 'fyp',
  'niche', 'niche',
  'loyalist',
  'cross_niche',
] as const;

/**
 * Archetype names matched to PERSONA_SLOT_ORDER index.
 * Deterministic — fully seeded, not randomized.
 */
const ARCHETYPE_BY_SLOT = [
  'high_engager',    // fyp 0
  'saver',           // fyp 1
  'lurker',          // fyp 2
  'sharer',          // fyp 3
  'tough_crowd',     // fyp 4
  'purposeful_viewer', // fyp 5
  'niche_deep_buyer',  // niche 0
  'niche_deep_scout',  // niche 1
  'loyalist',          // loyalist 0
  'cross_niche_curiosity', // cross_niche 0
] as const;

/**
 * Builds a deterministic HeatmapPayload for tests.
 * - 10 segments: idx 0-3 are hook_zone (t=0..12s), idx 4-9 are ~3s segments
 * - 10 personas matching PERSONA_SLOT_ORDER archetypes
 * - attentions[i][j] = (i + j) * 0.07 % 1  (deterministic, seeded formula)
 * - weighted_curve = 1 - i * 0.07 (monotonically decreasing)
 * - weights = default mix {fyp:0.65, niche:0.20, loyalist:0.10, cross_niche:0.05}
 * - weights_source = 'default'
 */
export function buildHeatmapFixture(overrides?: Partial<HeatmapPayload>): HeatmapPayload {
  const NUM_SEGMENTS = 10;
  const NUM_PERSONAS = 10;

  const segments = Array.from({ length: NUM_SEGMENTS }, (_, idx) => {
    const isHookZone = idx < 4;
    const tStart = idx < 4 ? idx * 3 : 12 + (idx - 4) * 3;
    const tEnd = tStart + 3;
    return {
      idx,
      t_start: tStart,
      t_end: tEnd,
      label: idx === 0 ? 'hook' : idx < 4 ? `hook_${idx}` : `segment_${idx}`,
      is_hook_zone: isHookZone,
      keyframe_uri: null as string | null,
    };
  });

  const personas = Array.from({ length: NUM_PERSONAS }, (_, i) => ({
    id: `persona_${i}`,
    slot_type: PERSONA_SLOT_ORDER[i] as 'fyp' | 'niche' | 'loyalist' | 'cross_niche',
    archetype: ARCHETYPE_BY_SLOT[i] as string,
    attentions: Array.from({ length: NUM_SEGMENTS }, (_, j) => (i + j) * 0.07 % 1),
    swipe_predicted_at: null as number | null,
    segment_reasons: {} as Record<number, string>,
  }));

  const weightedCurve = Array.from({ length: NUM_SEGMENTS }, (_, i) => 1 - i * 0.07);

  return {
    segments,
    personas,
    weighted_curve: weightedCurve,
    weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    weights_source: 'default',
    ...overrides,
  };
}

/**
 * Builds a HeatmapPayload where segments 4-6 have aggregated attention < 0.4,
 * triggering the timeline_pattern anti-virality overlay.
 */
export function buildAntiViralityHeatmap(): HeatmapPayload {
  const base = buildHeatmapFixture();

  // Override segments 4-6: set all persona attentions to 0.15 (below 0.4 threshold)
  const personas = base.personas.map((persona) => ({
    ...persona,
    attentions: persona.attentions.map((att, segIdx) =>
      segIdx >= 4 && segIdx <= 6 ? 0.15 : att,
    ),
  }));

  // weighted_curve reflects the low attention for segments 4-6
  const weightedCurve = base.weighted_curve.map((val, i) =>
    i >= 4 && i <= 6 ? 0.15 : val,
  );

  return {
    ...base,
    personas,
    weighted_curve: weightedCurve,
  };
}

/** Re-export archetype slot info for tests that need it */
export { ARCHETYPE_BY_SLOT };
