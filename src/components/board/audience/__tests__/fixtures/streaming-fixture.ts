import type { StageEvent } from '@/lib/engine/events';

/**
 * Archetype names in PERSONA_SLOT_ORDER sequence (Phase 4 D-05).
 * 6 FYP archetypes, 2 niche, 1 loyalist, 1 cross_niche.
 */
const PERSONA_ARCHETYPES = [
  { persona_id: 'fyp_1', archetype: 'high_engager' },
  { persona_id: 'fyp_2', archetype: 'saver' },
  { persona_id: 'fyp_3', archetype: 'lurker' },
  { persona_id: 'fyp_4', archetype: 'sharer' },
  { persona_id: 'fyp_5', archetype: 'tough_crowd' },
  { persona_id: 'fyp_6', archetype: 'purposeful_viewer' },
  { persona_id: 'niche_1', archetype: 'niche_deep_buyer' },
  { persona_id: 'niche_2', archetype: 'niche_deep_scout' },
  { persona_id: 'loyalist_1', archetype: 'loyalist' },
  { persona_id: 'cross_1', archetype: 'cross_niche_curiosity' },
] as const;

const NUM_SEGMENTS = 10;

/**
 * Helper to build a typed StageEvent with overrides.
 * The generic type parameter T narrows which union member is selected.
 */
export function buildStageEvent<T extends StageEvent['type']>(
  type: T,
  overrides: Partial<Extract<StageEvent, { type: T }>>,
): StageEvent {
  switch (type) {
    case 'stage_start':
      return {
        type: 'stage_start',
        stage: 'unknown',
        wave: 0,
        timestamp_ms: 0,
        ...(overrides as Partial<Extract<StageEvent, { type: 'stage_start' }>>),
      } as StageEvent;
    case 'stage_end':
      return {
        type: 'stage_end',
        stage: 'unknown',
        wave: 0,
        duration_ms: 0,
        cost_cents: 0,
        ok: true,
        ...(overrides as Partial<Extract<StageEvent, { type: 'stage_end' }>>),
      } as StageEvent;
    case 'pass2_persona_start':
      return {
        type: 'pass2_persona_start',
        persona_id: 'persona_0',
        archetype: 'high_engager',
        ...(overrides as Partial<Extract<StageEvent, { type: 'pass2_persona_start' }>>),
      } as StageEvent;
    case 'pass2_persona_end':
      return {
        type: 'pass2_persona_end',
        persona_id: 'persona_0',
        archetype: 'high_engager',
        latency_ms: 500,
        cost_cents: 0.1,
        ok: true,
        attentions: Array.from({ length: NUM_SEGMENTS }, (_, i) => 1 - i * 0.07),
        swipe_predicted_at: null,
        ...(overrides as Partial<Extract<StageEvent, { type: 'pass2_persona_end' }>>),
      } as StageEvent;
    case 'filmstrip_segment_ready':
      return {
        type: 'filmstrip_segment_ready',
        segment_idx: 0,
        keyframe_uri: 'https://example.com/keyframe_0.jpg',
        ...(overrides as Partial<Extract<StageEvent, { type: 'filmstrip_segment_ready' }>>),
      } as StageEvent;
    case 'pipeline_warning':
      return {
        type: 'pipeline_warning',
        message: 'warning',
        ...(overrides as Partial<Extract<StageEvent, { type: 'pipeline_warning' }>>),
      } as StageEvent;
    default:
      throw new Error(`Unknown StageEvent type: ${type as string}`);
  }
}

/**
 * STREAMING_FIXTURE: full Pass 2 event timeline covering:
 *   stage_start wave_0_segmentation
 *   stage_end wave_0_segmentation
 *   10× pass2_persona_start (in PERSONA_SLOT_ORDER archetype sequence)
 *   10× pass2_persona_end (each with attentions[] + swipe_predicted_at)
 *   10× filmstrip_segment_ready (segments 0-9)
 *
 * Per 04-RESEARCH.md §Streaming Choreography event timeline (lines 458-477).
 * All data is deterministic — no Math.random.
 */
export const STREAMING_FIXTURE: StageEvent[] = [
  // Wave 0: segmentation stage
  buildStageEvent('stage_start', {
    stage: 'wave_0_segmentation',
    wave: 0,
    timestamp_ms: 0,
  }),
  buildStageEvent('stage_end', {
    stage: 'wave_0_segmentation',
    wave: 0,
    duration_ms: 2000,
    cost_cents: 0.05,
    ok: true,
  }),

  // 10× pass2_persona_start — one per persona in PERSONA_SLOT_ORDER
  ...PERSONA_ARCHETYPES.map((p) =>
    buildStageEvent('pass2_persona_start', {
      persona_id: p.persona_id,
      archetype: p.archetype,
    }),
  ),

  // 10× pass2_persona_end — attentions deterministic: (personaIdx + segIdx) * 0.07 % 1
  ...PERSONA_ARCHETYPES.map((p, personaIdx) =>
    buildStageEvent('pass2_persona_end', {
      persona_id: p.persona_id,
      archetype: p.archetype,
      latency_ms: 400 + personaIdx * 50,
      cost_cents: 0.08 + personaIdx * 0.005,
      ok: true,
      attentions: Array.from({ length: NUM_SEGMENTS }, (_, segIdx) =>
        (personaIdx + segIdx) * 0.07 % 1,
      ),
      swipe_predicted_at: personaIdx % 3 === 0 ? 4.2 + personaIdx * 0.5 : null,
    }),
  ),

  // 10× filmstrip_segment_ready — one per segment
  ...Array.from({ length: NUM_SEGMENTS }, (_, segIdx) =>
    buildStageEvent('filmstrip_segment_ready', {
      segment_idx: segIdx,
      keyframe_uri: `https://example.com/keyframe_${segIdx}.jpg`,
    }),
  ),
];
