/**
 * motionTokens.ts — Shared motion constants for Landing v1.
 *
 * Per POLISH-07: every section animation imports from here for cross-section consistency.
 * Per MOTION-05 / CLAUDE.md: when adding color tokens, use HEX for L < 0.15 (Tailwind v4 oklch
 *   compilation drift) — pure number constants here are unaffected.
 * Per MOTION-04 / CLAUDE.md: keyframe additions to globals.css that use backdrop-filter or
 *   mask-image must be applied via inline style={} in the consuming component (Lightning CSS
 *   strips utility classes); this file holds duration/easing tokens only.
 */
export const motionTokens = {
  durations: { fast: 0.15, normal: 0.2, slow: 0.3, slower: 0.5, hero: 0.8 },
  easings: {
    outCubic: [0.215, 0.61, 0.355, 1] as const,
    outQuart: [0.165, 0.84, 0.44, 1] as const,
    inOut: [0.42, 0, 0.58, 1] as const,
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
  staggerDelays: { children: 0.08, tight: 0.04, wide: 0.15 },
  viewportThresholds: { default: 0.2, hero: 0, early: 0.1, late: 0.4 },
  triggerOnce: true,
} as const;
