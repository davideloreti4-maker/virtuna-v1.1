/**
 * network-sigma — the σ bars, honest. Asserts the honesty gate (NEVER z-score the simulated mode,
 * where the BOLD barely moves), the seven rows in Sapient's order, and that the band always agrees
 * with the sign/size of its own z.
 */
import { describe, expect, it } from 'vitest';
import { networkSigmas, whyThisSecond } from '../network-sigma';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 20,
  seedKey: 'h1',
  // a real, moving retention curve → a clip with structure to z-score
  retentionAt: (u) => Math.max(0.08, 1 - u * 0.85),
};
const SIMULATED: DriveInput = { mode: 'simulated', stopRatio: 0.6, durationS: 15, seedKey: 'h1' };

describe('networkSigmas — the σ bars', () => {
  it('REFUSES the simulated mode — its BOLD barely moves, so z-scoring manufactures signal', () => {
    expect(networkSigmas(SIMULATED, 15, 3)).toEqual([]);
  });

  it('grounded → seven networks in Sapient\'s row order', () => {
    const s = networkSigmas(GROUNDED, 20, 4);
    expect(s.map((r) => r.label)).toEqual([
      'Visual',
      'Somatomotor',
      'Dorsal Attention',
      'Ventral Attention',
      'Limbic',
      'Frontoparietal',
      'Default Mode',
    ]);
  });

  it('the band always agrees with its own z (never mislabels above/below)', () => {
    for (const r of networkSigmas(GROUNDED, 20, 6)) {
      const a = Math.abs(r.z);
      const expected = a < 0.15 ? 'about normal' : r.z < 0 ? (a < 0.6 ? 'slightly below' : 'clearly below') : a < 0.6 ? 'slightly above' : 'clearly above';
      expect(r.band).toBe(expected);
    }
  });

  it('whyThisSecond names the standout with its σ, and is empty when there is no data', () => {
    const s = networkSigmas(GROUNDED, 20, 6);
    const why = whyThisSecond(s, 6, 'one month ago my life completely changed');
    expect(why).toContain('σ');
    expect(why.length).toBeGreaterThan(20);
    expect(whyThisSecond([], 6)).toBe('');
  });
});
