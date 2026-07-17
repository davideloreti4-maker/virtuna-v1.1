/**
 * attention-curve — Sapient's predicted-attention section, honest. Grounded-only, 0..100, real peaks.
 */
import { describe, expect, it } from 'vitest';
import { attentionCurve } from '../attention-curve';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 24,
  seedKey: 'h1',
  // a wavy retention curve so there are real crests to mark
  retentionAt: (u) => Math.max(0.1, 0.7 + 0.25 * Math.sin(u * 12)),
};
const SIMULATED: DriveInput = { mode: 'simulated', stopRatio: 0.6, durationS: 15, seedKey: 'h1' };

describe('attentionCurve', () => {
  it('is grounded-only — no attention curve for a text concept', () => {
    expect(attentionCurve(SIMULATED, 15).points).toHaveLength(0);
  });

  it('grounded → a 0..100 curve, a mean hold, and at most four separated peaks sorted by time', () => {
    const c = attentionCurve(GROUNDED, 24);
    expect(c.points.length).toBeGreaterThan(2);
    for (const v of c.points) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(c.hold).toBeGreaterThanOrEqual(0);
    expect(c.hold).toBeLessThanOrEqual(100);
    expect(c.peaks.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < c.peaks.length; i++) expect(c.peaks[i]!.t).toBeGreaterThan(c.peaks[i - 1]!.t);
    // every marked peak really is above the mean
    for (const p of c.peaks) expect(p.v).toBeGreaterThan(c.hold);
  });
});
