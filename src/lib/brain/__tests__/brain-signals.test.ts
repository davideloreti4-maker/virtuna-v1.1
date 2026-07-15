/**
 * brain-signals — the honest fill for the nine-signal grid. These assert the things that would let a
 * DISHONEST or BROKEN grid pass: scores that leave 0..100, a modeled cell wearing a real verdict, a
 * grid that collapses to one value, or a missing "what it is NOT" line.
 */
import { describe, expect, it } from 'vitest';
import { modeledSignals, voteSignal } from '../brain-signals';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 20,
  seedKey: 'h1',
  retentionAt: (u) => Math.max(0.1, 1 - u * 0.7),
};

describe('modeledSignals — seven honest cortical cells', () => {
  const signals = modeledSignals(GROUNDED, 20);

  it('is one cell per Yeo network, drift included', () => {
    expect(signals).toHaveLength(7);
    expect(signals.map((s) => s.key)).toContain('drift');
  });

  it('every score is an integer in 0..100', () => {
    for (const s of signals) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it('modeled cells NEVER wear a real verdict — a model output reports a LEVEL, not a grade', () => {
    for (const s of signals) {
      expect(s.tone).toBe('level');
      expect(s.real).toBe(false);
    }
  });

  it('every modeled cell is CLEARLY MARKED modeled (the owner rule) and never empty', () => {
    for (const s of signals) {
      expect(s.notMeasured.length).toBeGreaterThan(8);
      expect(s.notMeasured.toLowerCase()).toContain('modeled');
    }
  });

  it('does not collapse to one value — the grid must carry real spread', () => {
    const distinct = new Set(signals.map((s) => s.score));
    expect(distinct.size).toBeGreaterThan(2);
  });
});

describe('voteSignal — real counts may carry a verdict', () => {
  it('a weak vote is toned weak; a strong one strong; the middle okay', () => {
    const weak = voteSignal('core', 'Core hold', 20, { word: 'Losing your core', weak: true, notMeasured: 'x not y' });
    const strong = voteSignal('reach', 'Reach', 80, { word: 'Lands', weak: false, notMeasured: 'x not y' });
    const okay = voteSignal('reach', 'Reach', 50, { word: 'Mixed', weak: false, notMeasured: 'x not y' });
    expect(weak.tone).toBe('weak');
    expect(strong.tone).toBe('strong');
    expect(okay.tone).toBe('okay');
    expect(weak.real).toBe(true);
  });
});
