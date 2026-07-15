/**
 * signal-timeline — the per-second heatmap, honest. Asserts the grounded-only gate and that every
 * cell is a real 0..100 activation for one of the nine signals.
 */
import { describe, expect, it } from 'vitest';
import { signalTimeline } from '../signal-timeline';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 20,
  seedKey: 'h1',
  retentionAt: (u) => Math.max(0.08, 1 - u * 0.8),
};
const SIMULATED: DriveInput = { mode: 'simulated', stopRatio: 0.6, durationS: 15, seedKey: 'h1' };

describe('signalTimeline — the per-second heatmap', () => {
  it('is grounded-only — a per-second timeline is not real for a text concept', () => {
    expect(signalTimeline(SIMULATED, 15).rows).toHaveLength(0);
    expect(signalTimeline(SIMULATED, 15).seconds).toHaveLength(0);
  });

  it('grounded → nine signal rows, one cell per second, every cell an integer 0..100', () => {
    const t = signalTimeline(GROUNDED, 20);
    expect(t.rows).toHaveLength(9);
    expect(t.seconds.length).toBeGreaterThan(1);
    for (const row of t.rows) {
      expect(row.values).toHaveLength(t.seconds.length);
      for (const v of row.values) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('caps the column count so a long clip cannot blow up the grid', () => {
    expect(signalTimeline(GROUNDED, 600, 90).seconds.length).toBeLessThanOrEqual(90);
  });
});
