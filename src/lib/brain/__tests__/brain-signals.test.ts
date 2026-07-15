/**
 * brain-signals — the honest fill for the nine-signal grid. These assert the things that would let a
 * DISHONEST or BROKEN grid pass: scores that leave 0..100, a grade decoupled from its own number, a
 * modeled cell that has shed its "modeled" mark or its WHY-THIS-SCORE disclosure, a grid that
 * collapses to one value, or a fabricated zero where there is no data.
 *
 * NOTE: this REPLACES the earlier "modeled cells NEVER wear a verdict" guard. The owner's 2026-07-15
 * call is a graded 1:1 grid (WEAKNESS/OKAY/STRONG). We are allowed to grade a MODELED number only
 * because the grade is a DISCLOSED band of it — so the guard now checks the disclosure, not its
 * absence. See `brain-signals.ts` header and `room-readout.ts` §5.
 */
import { describe, expect, it } from 'vitest';
import { modeledSignals, voteSignal, absentSignal } from '../brain-signals';
import type { DriveInput } from '../cortex-sim';

const GROUNDED: DriveInput = {
  mode: 'grounded',
  stopRatio: 0.6,
  durationS: 20,
  seedKey: 'h1',
  retentionAt: (u) => Math.max(0.1, 1 - u * 0.7),
};

describe('modeledSignals — seven honest, graded cortical cells', () => {
  const signals = modeledSignals(GROUNDED, 20);

  it('is one cell per Yeo network, the default-mode cell included', () => {
    expect(signals).toHaveLength(7);
    expect(signals.map((s) => s.key)).toContain('drift');
  });

  it('every score is an integer in 0..100', () => {
    for (const s of signals) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score as number).toBeGreaterThanOrEqual(0);
      expect(s.score as number).toBeLessThanOrEqual(100);
    }
  });

  it('the GRADE is a disclosed band of the cell\'s OWN number — never decoupled from it', () => {
    for (const s of signals) {
      const n = s.score as number;
      const expected = n < 40 ? 'weak' : n < 70 ? 'okay' : 'strong';
      expect(s.tone).toBe(expected);
    }
  });

  it('modeled cells are marked MODELED (real:false) — the grade must never read as a measurement', () => {
    for (const s of signals) expect(s.real).toBe(false);
  });

  it('every modeled cell carries the honest disclosure: what it is NOT, and that the band is not a benchmark', () => {
    for (const s of signals) {
      expect(s.notMeasured.toLowerCase()).toContain('modeled');
      expect(s.whyScore.toLowerCase()).toContain('modeled');
      // the load-bearing admission — the band is a cutoff, not a benchmark against real outcomes
      expect(s.whyScore.toLowerCase()).toContain('not a benchmark');
    }
  });

  it('presents the default-mode network POSITIVELY as Immersion, so all nine read higher = better', () => {
    const drift = signals.find((s) => s.key === 'drift')!;
    expect(drift.label).toBe('Immersion');
    // it is graded like the rest (no back-to-front verdict word to confuse the reader)
    expect(['weak', 'okay', 'strong']).toContain(drift.tone);
  });

  it('does not collapse to one value — the grid must carry real spread', () => {
    const distinct = new Set(signals.map((s) => s.score));
    expect(distinct.size).toBeGreaterThan(2);
  });
});

describe('voteSignal — real counts graded on the same flat band, monotonic like Sapient', () => {
  it('one number → one verdict: 35 weak, 55 okay, 80 strong — never non-monotonic', () => {
    const low = voteSignal('reach', 'Reach', 35, { chip: 'Stays home', notMeasured: 'x not y' });
    const mid = voteSignal('core', 'Core hold', 55, { chip: 'Wavering', notMeasured: 'x not y' });
    const high = voteSignal('reach', 'Reach', 80, { chip: 'Travels', notMeasured: 'x not y' });
    expect(low.tone).toBe('weak'); // 35 < 40
    expect(mid.tone).toBe('okay'); // 55 in 40..69
    expect(high.tone).toBe('strong'); // 80 ≥ 70
    expect(high.word.toLowerCase()).toBe('strong');
    expect(mid.real).toBe(true);
    // the room's richer segment read is preserved where the nuance belongs — behind WHY THIS SCORE
    expect(mid.whyScore.toLowerCase()).toContain('wavering');
  });
});

describe('absentSignal — no data is shown as absent, never a fabricated zero (D-13)', () => {
  it('carries a null score, an absent tone, and a reason', () => {
    const a = absentSignal('reach', 'Reach', 'Too few new viewers to read reach.');
    expect(a.score).toBeNull();
    expect(a.tone).toBe('absent');
    expect(a.word.toLowerCase()).toContain('no data');
    expect(a.notMeasured.length).toBeGreaterThan(8);
  });
});
