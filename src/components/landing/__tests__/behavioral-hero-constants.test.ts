// ---------------------------------------------------------------------------
// behavioral-hero-constants.test.ts -- Vitest invariant suite for the
// behavioral-simulation hero constants. Catches accidental drift in
// particle counts, percentage range, animation duration window, and easing
// boundary values per .planning/phases/02-foundation-hero/02-RESEARCH.md
// SC2 + threat T-2-05.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

import {
  PARTICLE_COUNTS,
  PARTICLE_MOTION,
  CONFIDENCE_CHIP,
  easeOutCubic,
} from '../behavioral-hero-constants';

describe('behavioral-hero-constants', () => {
  it('mobile has fewer particles than desktop', () => {
    expect(PARTICLE_COUNTS.mobile).toBeLessThan(PARTICLE_COUNTS.desktop);
  });

  it('confidence percentage is in plausible range', () => {
    expect(CONFIDENCE_CHIP.percentage).toBeGreaterThanOrEqual(80);
    expect(CONFIDENCE_CHIP.percentage).toBeLessThanOrEqual(95);
  });

  it('animation duration is in 2.0-2.4s window per CONTEXT.md D-07', () => {
    expect(PARTICLE_MOTION.animationDurationMs).toBeGreaterThanOrEqual(2000);
    expect(PARTICLE_MOTION.animationDurationMs).toBeLessThanOrEqual(2400);
  });

  it('easeOutCubic returns correct boundary values', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
  });
});
