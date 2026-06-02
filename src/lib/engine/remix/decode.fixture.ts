/**
 * Realistic Decode output fixture for unit/integration tests.
 *
 * Phase 4 builds against this fixture until Phase 3's real Omni-based Decode lands.
 * Once Phase 3 ships, swap DECODE_FIXTURE for a captured real decode output.
 *
 * FORMAT LANGUAGE ONLY — no topic-specific nouns (no food, cooking, pasta, etc.).
 * The no-caption-leak test in adapt.test.ts asserts concepts contain only format
 * language by feeding this fixture and checking for absence of topic-specific nouns.
 *
 * repeatable[] and luck[] are TEXTUALLY DISTINCT so the luck-exclusion test can
 * detect if luck item text leaks into the adapt prompt.
 */

import type { DecodeOutput } from './decode-types';

export const DECODE_FIXTURE: DecodeOutput = {
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
