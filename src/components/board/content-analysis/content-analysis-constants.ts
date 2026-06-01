import type { HookModality, CraftPillarKey } from './content-analysis-types';

// ── Reading-rail pillar labels ────────────────────────────────────────────────
export const PILLAR_LABELS: Record<CraftPillarKey, string> = {
  hook: 'Hook',
  pacing: 'Pacing',
  audio: 'Audio',
  cta: 'CTA',
} as const;

export const PILLAR_ORDER: CraftPillarKey[] = ['hook', 'pacing', 'audio', 'cta'];

// ── Hook modality → caption ("how the hook opens") ────────────────────────────
// The strongest modality names the hook's character in the rail caption.
export const HOOK_MODALITY_CAPTION: Record<HookModality, string> = {
  visual_stop_power: 'Visual-led open',
  audio_hook_quality: 'Audio-led open',
  text_overlay_score: 'Text-led open',
  first_words_speech_score: 'Words-led open',
} as const;

export const HOOK_MODALITY_ORDER: HookModality[] = [
  'visual_stop_power',
  'audio_hook_quality',
  'text_overlay_score',
  'first_words_speech_score',
];

// ── CTA type → short label ────────────────────────────────────────────────────
export const CTA_TYPE_LABEL: Record<string, string> = {
  follow: 'Follow ask',
  comment: 'Comment bait',
  link_in_bio: 'Link in bio',
  watch_next: 'Watch-next pull',
  engage_question: 'Question prompt',
  other: 'Clear ask',
} as const;

// ── Verdict thresholds (0–10) — strong / mid / weak buckets ───────────────────
export const VERDICT = {
  STRONG: 7,
  MID: 5,
} as const;

// ── Energy / emotion-arc thresholds ───────────────────────────────────────────
export const ENERGY = {
  // intensity (0–1) at or below this in a contiguous run = an "energy dip".
  DIP_CEILING: 0.45,
  // a dip must span at least this fraction of total duration to be called out.
  MIN_DIP_FRACTION: 0.12,
} as const;

// ── Audio mix-profile thresholds (audio_signals ratios are 0–1) ───────────────
export const AUDIO_MIX = {
  HIGH_SILENCE: 0.5,
  DOMINANT: 0.45,
} as const;

export const COPY = {
  FRAME_TITLE: 'Content craft',
  // Whole-frame fallback when no craft signal exists (text / tiktok_url modes).
  EMPTY: "Craft signals aren't available for this format",
  // Audio pillar when audio_signals is null (slideshow / b-roll, no speech track).
  AUDIO_NONE_CAPTION: 'No speech track',
  CTA_NONE_VALUE: 'None',
  CTA_NONE_CAPTION: 'Ends with no ask',
  HOOK_MARK: 'Hook',
  NO_CLOSE_MARK: 'No close',
  CLOSE_MARK: 'Close',
} as const;

// INVERTED polarity per src/lib/engine/qwen/schemas.ts:27 — raw 0-10 where HIGHER = WORSE.
// Bucket: 0-3 → 'Low' (good), 4-6 → 'Med', 7-10 → 'High' (bad).
// NEVER surface the raw number — always the label.
export function cognitiveLoadBucket(raw: number): 'Low' | 'Med' | 'High' {
  if (raw <= 3) return 'Low';
  if (raw <= 6) return 'Med';
  return 'High';
}
