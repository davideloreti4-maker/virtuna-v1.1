import type { HookModality } from './content-analysis-types';

// Hook bar labels (per 05-UI-SPEC.md §HookDecompNode).
export const HOOK_BAR_LABELS: Record<HookModality, string> = {
  visual_stop_power: 'Visual stop power',
  audio_hook_quality: 'Audio hook',
  text_overlay_score: 'Text overlay',
  first_words_speech_score: 'First words',
} as const;

export const HOOK_BAR_ORDER: HookModality[] = [
  'visual_stop_power',
  'audio_hook_quality',
  'text_overlay_score',
  'first_words_speech_score',
];

export const COPY = {
  HOOK_DECOMP_TITLE: 'Hook decomposition',
  // Standardised unavailable template: "<Feature> isn't available for this analysis"
  HOOK_DECOMP_EMPTY: 'Hook analysis unavailable for this video',
  HOOK_DECOMP_UNAVAILABLE: "Hook decomposition isn't available for this analysis",
  HOOK_ZONE_FALLBACK: '0–3s',
  COHERENCE_PREFIX: 'Coherence',
  COGNITIVE_LOAD_PREFIX: 'Cognitive load',
  EMOTION_ARC_TITLE: 'Emotion arc',
  EMOTION_ARC_EMPTY: 'Emotion arc unavailable',
  EMOTION_ARC_UNAVAILABLE: "Emotion arc isn't available for this analysis",
  EMOTION_ARC_PEAK_PREFIX: 'Peak at',
} as const;

export const TELEMETRY = {
  HOOK_DECOMP_EXPANDED: 'hook_decomp_expanded',
  EMOTION_ARC_PEAK_TAPPED: 'emotion_arc_peak_tapped',
} as const;

// INVERTED polarity per src/lib/engine/qwen/schemas.ts:27 — raw 0-10 where HIGHER = WORSE.
// Bucket: 0-3 → 'Low' (good), 4-6 → 'Med', 7-10 → 'High' (bad).
// NEVER surface the raw number — always the label.
export function cognitiveLoadBucket(raw: number): 'Low' | 'Med' | 'High' {
  if (raw <= 3) return 'Low';
  if (raw <= 6) return 'Med';
  return 'High';
}

// Derive hook zone string from heatmap segments (per 05-CONTEXT.md D-16).
// Fallback to '0–3s' when no segments.
export function hookZoneLabel(
  segments: ReadonlyArray<{ t_start: number; t_end: number; is_hook_zone: boolean }> | null | undefined,
): string {
  if (!segments || segments.length === 0) return COPY.HOOK_ZONE_FALLBACK;
  const hookSegs = segments.filter((s) => s.is_hook_zone);
  if (hookSegs.length === 0) return COPY.HOOK_ZONE_FALLBACK;
  const start = Math.min(...hookSegs.map((s) => s.t_start));
  const end = Math.max(...hookSegs.map((s) => s.t_end));
  const fmt = (sec: number) => `${sec.toFixed(0)}s`;
  return `${start.toFixed(0)}–${fmt(end)}`;
}
