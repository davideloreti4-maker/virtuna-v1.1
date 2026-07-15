/**
 * brain-signals — Sapient's nine, mapped honestly from our seven networks. These assert the things
 * that would let a DISHONEST or WRONG grid pass: the wrong signal set, a score outside 0..100, a grade
 * that ignores the signal's DIRECTION (the bug the owner caught — a low Hesitation must read STRONG, not
 * WEAKNESS), a cell that has shed its "not a benchmark" disclosure, a proxy that fails to say it is one,
 * or a grid that collapses to one value.
 */
import { describe, expect, it } from 'vitest';
import { modeledSignals } from '../brain-signals';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 20,
  seedKey: 'h1',
  retentionAt: (u) => Math.max(0.1, 1 - u * 0.7),
};

const WEAK_MAX = 40;
const STRONG_MIN = 65;
const bandOf = (n: number) => (n < WEAK_MAX ? 'weak' : n < STRONG_MIN ? 'okay' : 'strong');

describe('modeledSignals — Sapient\'s nine, honest', () => {
  const signals = modeledSignals(GROUNDED, 20);

  it('is exactly Sapient\'s nine, in order', () => {
    expect(signals.map((s) => s.label)).toEqual([
      'Visual Pull',
      'Voice Impact',
      'Cognitive Grip',
      'Emotional Hit',
      'Memorability',
      'Attention',
      'Buy Signal',
      'Hesitation / Risk',
      'Mental Effort',
    ]);
  });

  it('every score is an integer in 0..100', () => {
    for (const s of signals) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it('higher-is-better cells grade on the number; the grade never ignores the band', () => {
    for (const s of signals) {
      if (s.key === 'risk') continue;
      expect(s.tone).toBe(bandOf(s.score));
    }
  });

  it('Hesitation / Risk is DIRECTIONAL — a low number reads STRONG, not WEAKNESS', () => {
    const risk = signals.find((s) => s.key === 'risk')!;
    // graded on 100 − score: low hesitation is good
    expect(risk.tone).toBe(bandOf(100 - risk.score));
    // and prove the inversion actually flips: a low score must NOT be the weak band it would be if flat
    const low = modeledSignals({ ...GROUNDED, stopRatio: 0.9 }, 20).find((s) => s.key === 'risk')!;
    if (low.score < WEAK_MAX) expect(low.tone).toBe('strong');
  });

  it('all nine are modeled — never a claimed measurement', () => {
    for (const s of signals) expect(s.real).toBe(false);
  });

  it('every cell discloses it is modeled and NOT a benchmark against real outcomes', () => {
    for (const s of signals) {
      expect(s.notMeasured.length).toBeGreaterThan(8);
      expect(s.whyScore.toLowerCase()).toContain('not a benchmark');
    }
  });

  it('the two proxies say so — Buy Signal and Hesitation/Risk never masquerade as measured', () => {
    const buy = signals.find((s) => s.key === 'buy')!;
    const risk = signals.find((s) => s.key === 'risk')!;
    expect(buy.notMeasured.toLowerCase()).toContain('proxy');
    expect(buy.whyScore.toLowerCase()).toContain('do not measure purchase');
    expect(risk.notMeasured.toLowerCase()).toContain('proxy');
  });

  it('does not collapse to one value — the grid must carry real spread', () => {
    const distinct = new Set(signals.map((s) => s.score));
    expect(distinct.size).toBeGreaterThan(2);
  });
});
