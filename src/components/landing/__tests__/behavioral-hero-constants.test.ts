// ---------------------------------------------------------------------------
// behavioral-hero-constants.test.ts -- Vitest invariant suite for the
// behavioral-simulation hero constants. Catches accidental drift in
// particle counts, percentage range, animation duration window, and easing
// boundary values per .planning/phases/02-foundation-hero/02-RESEARCH.md
// SC2 + threat T-2-05.
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PARTICLE_COUNTS,
  PARTICLE_MOTION,
  CONFIDENCE_CHIP,
  easeOutCubic,
} from '../behavioral-hero-constants';
import { gaussian } from '../BehavioralCanvas';

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

describe('gaussian() -- WR-02 NaN regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not return NaN when Math.random() returns 0 on the first call', () => {
    // Box-Muller is u = Math.random(); then Math.log(u). If u === 0,
    // Math.log(0) === -Infinity and the result is NaN -- the bug guarded
    // against. Mock the first call to 0 (the failure case), then a normal
    // value for the rotation term, then a normal value for any retry.
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValueOnce(0); // first u -- should be rejected
    spy.mockReturnValueOnce(0.42); // retry u
    spy.mockReturnValueOnce(0.7); // angle term

    const value = gaussian();
    expect(value).not.toBeNaN();
    expect(Number.isFinite(value)).toBe(true);
  });

  it('returns a finite number under repeated calls with mixed inputs', () => {
    // Sanity check that the loop still terminates and produces finite output
    // for normal random draws.
    for (let i = 0; i < 1_000; i++) {
      const v = gaussian();
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
