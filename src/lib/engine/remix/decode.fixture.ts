/**
 * Decode/Adapt test fixtures.
 *
 * Two shapes, because the Decode→Adapt seam has two sides:
 *
 * - `DECODE_RESULT_FIXTURE` — the REAL persisted shape (`DecodeResult`: beats[4] +
 *   repeatable string[] + luck {category,note}[]). This is what Phase 3 writes to
 *   `variants.remix.decode`. Feed this to component/adapter tests so the
 *   `decodeResultToAdaptInput` seam is exercised end-to-end.
 *
 * - `DECODE_FIXTURE` — the PRE-ADAPTED wire shape (`AdaptInput`-without-niche, plus a
 *   `luck` lane for the exclusion test). This is what the route accepts and what the
 *   generator (`buildAdaptUserContent`/`generateAdaptConcepts`) consumes. Generator
 *   unit tests build their `AdaptInput` from this.
 *
 * FORMAT LANGUAGE ONLY — no topic-specific nouns (no food, cooking, pasta, etc.).
 * The no-caption-leak test in adapt.test.ts asserts concepts contain only format
 * language by feeding this fixture and checking for absence of topic-specific nouns.
 *
 * repeatable[] and luck[] are TEXTUALLY DISTINCT so the luck-exclusion test can
 * detect if luck item text leaks into the adapt prompt.
 */

import type { AdaptWireDecode, DecodeResult, RepeatableItem } from './decode-types';

/** Real persisted decode payload shape (Phase 3 output) — drives the adapter seam. */
export const DECODE_RESULT_FIXTURE: DecodeResult = {
  beats: [
    { id: 'hook_pattern', body: 'Open with a provocative question, delay the answer', verdict: 'present' },
    { id: 'structure_pacing', body: 'Hook (0-3s) → tension build (3-12s) → reveal (12-22s) → CTA (22-30s)', verdict: 'present' },
    { id: 'the_turn', body: 'Pivot from problem statement to counter-intuitive solution at 15s', verdict: 'present' },
    { id: 'emotional_beat', body: 'Curiosity → frustration → relief → motivation', verdict: 'present' },
  ],
  repeatable: [
    'open-loop cold open',
    '4-beat emotional arc',
    'counter-intuitive turn at 60% mark',
  ],
  luck: [
    { category: 'timing_trend_moment', note: 'trending-audio-at-posting-time — timing-dependent distribution factor' },
    { category: 'existing_audience_reach', note: 'algorithmic-boost-from-existing-fanbase — prior audience amplifier' },
  ],
};

/**
 * Pre-adapted wire shape (`AdaptWireDecode`, plus a luck lane for exclusion tests).
 *
 * Typed as the WIRE shape, not as AdaptInput-minus-niche: `blueprint` and `target` are supplied
 * server-side and never travel in the request body, so a fixture carrying them would misdescribe
 * what the route accepts.
 */
export const DECODE_FIXTURE: AdaptWireDecode & { luck: RepeatableItem[] } = {
  hook_pattern: 'Open with a provocative question, delay the answer',
  structure: 'Hook (0-3s) → tension build (3-12s) → reveal (12-22s) → CTA (22-30s)',
  the_turn: 'Pivot from problem statement to counter-intuitive solution at 15s',
  emotional_beat: 'Curiosity → frustration → relief → motivation',
  repeatable: [
    {
      label: 'open-loop cold open',
      why_repeatable: 'Format hook, not topic-specific — creates curiosity gap replicable in any niche',
    },
    {
      label: '4-beat emotional arc',
      why_repeatable: 'Structural pacing pattern (curiosity→frustration→relief→motivation) replicable across domains',
    },
    {
      label: 'counter-intuitive turn at 60% mark',
      why_repeatable: 'Narrative structure — subverting expected resolution; works in any instructional format',
    },
  ],
  luck: [
    {
      label: 'trending-audio-at-posting-time',
      why_repeatable: 'Timing-dependent distribution factor — not a structural pattern; cannot be reliably replicated',
    },
    {
      label: 'algorithmic-boost-from-existing-fanbase',
      why_repeatable: 'Distribution amplifier from prior audience size — not a format element',
    },
  ],
};
