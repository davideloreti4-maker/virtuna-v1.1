/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { assembleReasoningBuckets } from '../assembleReasoningBuckets';
import { fixtures } from './fixtures/prediction-result';

describe('assembleReasoningBuckets', () => {
  it('returns intro verbatim from result.reasoning', () => {
    const buckets = assembleReasoningBuckets(fixtures.complete);
    expect(buckets.intro).toBe(fixtures.complete.reasoning);
  });

  it('works contains only factors with score >= 7', () => {
    const buckets = assembleReasoningBuckets(fixtures.complete);
    // fixtures.complete has factors: 8, 7, 6, 3
    const names = buckets.works.map((f) => f.name);
    expect(names).toContain('Visual hook'); // 8
    expect(names).toContain('Audio quality'); // 7
    expect(names).not.toContain('Pacing'); // 6
    expect(names).not.toContain('CTA'); // 3
  });

  it('mightNot contains only factors with score < 4', () => {
    const buckets = assembleReasoningBuckets(fixtures.complete);
    const names = buckets.mightNot.map((f) => f.name);
    expect(names).toContain('CTA'); // 3
    expect(names).not.toContain('Pacing'); // 6
    expect(names).not.toContain('Visual hook'); // 8
  });

  it('factors with score in [4,7) appear in neither bucket', () => {
    const buckets = assembleReasoningBuckets(fixtures.complete);
    // Pacing (score 6) — not in works, not in mightNot
    expect(buckets.works.map((f) => f.name)).not.toContain('Pacing');
    expect(buckets.mightNot.map((f) => f.name)).not.toContain('Pacing');
  });

  it('flagged equals result.warnings verbatim', () => {
    const buckets = assembleReasoningBuckets(fixtures.antiVirality);
    expect(buckets.flagged).toEqual(fixtures.antiVirality.warnings);
    expect(buckets.flagged.length).toBeGreaterThan(0);
  });

  it('counterfactual includes type=fix and type=stretch but not reinforcement', () => {
    const buckets = assembleReasoningBuckets(fixtures.complete);
    const types = buckets.counterfactual.map((s) => s.type);
    expect(types).toContain('fix');
    expect(types).toContain('stretch');
    expect(types).not.toContain('reinforcement');
  });

  it('counterfactual is capped at 5', () => {
    const many = {
      ...fixtures.complete,
      counterfactuals: {
        ...fixtures.complete.counterfactuals!,
        suggestions: Array.from({ length: 10 }, (_, i) => ({
          type: 'fix' as const,
          headline: `h${i}`,
          detail: 'd',
          timestamp_ms: i,
          signal_anchor: 'hook',
        })),
      },
    };
    const buckets = assembleReasoningBuckets(many);
    expect(buckets.counterfactual).toHaveLength(5);
  });

  it('counterfactual is [] when counterfactuals is undefined', () => {
    const noCF = { ...fixtures.complete, counterfactuals: undefined };
    const buckets = assembleReasoningBuckets(noCF as never);
    expect(buckets.counterfactual).toEqual([]);
  });

  it('counterfactual is [] when suggestions is empty', () => {
    const emptyCF = {
      ...fixtures.complete,
      counterfactuals: { band: 'mid' as const, suggestions: [] },
    };
    const buckets = assembleReasoningBuckets(emptyCF);
    expect(buckets.counterfactual).toEqual([]);
  });

  it('works/mightNot return [] when factors is empty', () => {
    const noFactors = { ...fixtures.complete, factors: [] };
    const buckets = assembleReasoningBuckets(noFactors);
    expect(buckets.works).toEqual([]);
    expect(buckets.mightNot).toEqual([]);
  });
});
