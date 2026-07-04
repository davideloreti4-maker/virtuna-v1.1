/** @vitest-environment happy-dom */
/**
 * predictionResultToRead — the PredictionResult → contract Read adapter (Seam 2).
 *
 * Locks the mapping in docs/SURFACE-SEAM-SPEC.md §3.3 + the honesty spine:
 *  - reactions mirror the SAME persona nodes the Phase-3 Room renders (buildAudienceNodes);
 *    each is a NAMED person (never the archetype enum), tone via the loved/bounced/neutral bands,
 *    verdict = the persona's real segment_reasons quote (empty when it had none — never faked).
 *  - stop = round(#{watch-through ≥ 0.5} / N × 10) — the same "would stop" the Room shows.
 *  - split % sums to exactly 100; population framed only when a real cohort exists.
 *  - weakSpot/fix come verbatim from the hero block, then the raw Apollo fallbacks; empty (never a
 *    throw) when Apollo is dead too.
 *
 * Run: node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/prediction-to-read.test.ts
 */

import { describe, it, expect } from 'vitest';
import { predictionResultToRead } from '../prediction-to-read';
import { buildAudienceNodes } from '../reading-panels';
import {
  makeReadingResult,
  makeApolloNullResult,
  makeEmptyPersonasResult,
  makeEmptyHeatmapResult,
} from './fixtures/reading-fixture';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';

const toneBand = (w: number) => (w >= 0.6 ? 'loved' : w <= 0.4 ? 'bounced' : 'neutral');

describe('predictionResultToRead — structure', () => {
  it('maps a healthy analysis into a full contract Read', () => {
    const data = makeReadingResult();
    const nodes = buildAudienceNodes(data);
    const read = predictionResultToRead(data, 'card-1');

    expect(read.contentId).toBe('card-1');
    expect(nodes.length).toBeGreaterThan(0);
    expect(read.reactions).toHaveLength(nodes.length);
    const stops = nodes.filter((n) => n.watchThrough >= 0.5).length;
    expect(read.stop).toBe(Math.round((stops / nodes.length) * 10));
    expect(read.population).toEqual({ modeledFrom: nodes.length, total: 1000 });
  });

  it('splits loved/bounced/neutral into percentages that sum to exactly 100', () => {
    const { split } = predictionResultToRead(makeReadingResult(), 'x');
    expect(split.loved + split.bounced + split.neutral).toBe(100);
    expect(split.loved).toBeGreaterThanOrEqual(0);
    expect(split.bounced).toBeGreaterThanOrEqual(0);
    expect(split.neutral).toBeGreaterThanOrEqual(0);
  });

  it('maps each persona node → a named, in-voice reaction with the 3-way tone', () => {
    const data = makeReadingResult();
    const nodes = buildAudienceNodes(data);
    const read = predictionResultToRead(data, 'x');
    read.reactions.forEach((r, i) => {
      const n = nodes[i]!;
      expect(r.person.name).toBe(n.name ?? n.label);
      expect(r.person.id).toBe(n.archetype ?? n.id);
      expect(r.tone).toBe(toneBand(n.watchThrough));
      expect(r.verdict).toBe(n.quote ?? '');
      if (n.dropAt) expect(r.moment).toBe(`drop at ${n.dropAt}`);
      else expect(r.moment).toBeUndefined();
    });
  });

  it('never renders a reaction name as the raw archetype enum (THE-CONTRACT §2)', () => {
    const read = predictionResultToRead(makeReadingResult(), 'x');
    for (const r of read.reactions) {
      expect(ARCHETYPES).not.toContain(r.person.name);
    }
  });
});

describe('predictionResultToRead — weakSpot / fix sourcing', () => {
  it('prefers the first-class hero block (ceiling → weakSpot, the_one_fix → fix)', () => {
    const data = makeReadingResult({
      hero: {
        verdict_line: 'Solid',
        ceiling: 'The 0:08 stall caps the ceiling.',
        the_one_fix: 'Front-load the payoff before 0:03.',
        go_no_go: 'go',
        post_window: null,
      },
    });
    const read = predictionResultToRead(data, 'x');
    expect(read.weakSpot).toBe('The 0:08 stall caps the ceiling.');
    expect(read.fix).toBe('Front-load the payoff before 0:03.');
  });

  it('falls back to Apollo ceiling_capper + first rewrite when the hero block is absent', () => {
    const read = predictionResultToRead(makeReadingResult({ hero: null }), 'x');
    expect(read.weakSpot).toBe('Fix the 0:08 drop and this clears the bar.'); // apollo_reasoning.ceiling_capper
    expect(read.fix).toMatch(/freelancing/i); // apollo_reasoning.rewrites[0].variant
  });

  it('degrades weakSpot/fix to empty strings (never throws) when Apollo is null too', () => {
    const read = predictionResultToRead(makeApolloNullResult({ hero: null, warnings: [] }), 'x');
    expect(read.weakSpot).toBe('');
    expect(read.fix).toBe('');
    expect(read.reactions.length).toBeGreaterThan(0); // still a valid Read with real reactions
  });
});

describe('predictionResultToRead — degraded / empty', () => {
  it('yields a zeroed Read with no reactions + no population when there are no personas', () => {
    const read = predictionResultToRead(makeEmptyPersonasResult(), 'x');
    expect(read.reactions).toEqual([]);
    expect(read.stop).toBe(0);
    expect(read.split).toEqual({ loved: 0, bounced: 0, neutral: 0 });
    expect(read.population).toBeUndefined();
  });

  it('handles a null heatmap without throwing', () => {
    const read = predictionResultToRead(makeEmptyHeatmapResult(), 'x');
    expect(read.reactions).toEqual([]);
    expect(read.population).toBeUndefined();
  });
});

describe('predictionResultToRead — determinism', () => {
  it('is a pure function: identical input → deep-equal output', () => {
    const data = makeReadingResult();
    expect(predictionResultToRead(data, 'x')).toEqual(predictionResultToRead(data, 'x'));
  });
});
