import { describe, it, expect } from 'vitest';
import type { PersonaNode } from '@/components/board/_kit';
import {
  instantiatePopulation,
  weightedRollup,
  cascadeOrder,
  type PopulationDot,
} from '../lens-derive';

/**
 * Fixture: 10 archetypes with varied weight + watchThrough + tone.
 * Mirrors the buildPersonaNodes output shape (the only input lens-derive consumes).
 * Highest weight = "core" (0.95); a low-watchThrough accent node is the worst cluster.
 */
function tenNodes(): PersonaNode[] {
  return [
    { id: 'p1', label: 'Core fans', weight: 0.95, watchThrough: 0.82, tone: 'default' },
    { id: 'p2', label: 'Niche regulars', weight: 0.8, watchThrough: 0.71, tone: 'default' },
    { id: 'p3', label: 'New viewers', weight: 0.65, watchThrough: 0.58, tone: 'default' },
    { id: 'p4', label: 'Cross-niche', weight: 0.6, watchThrough: 0.49, tone: 'default' },
    { id: 'p5', label: 'Loyalists', weight: 0.55, watchThrough: 0.66, tone: 'default' },
    { id: 'p6', label: 'Skimmers', weight: 0.5, watchThrough: 0.38, tone: 'default' },
    { id: 'p7', label: 'Skeptics', weight: 0.45, watchThrough: 0.31, tone: 'default' },
    { id: 'p8', label: 'Bouncers', weight: 0.4, watchThrough: 0.22, tone: 'accent' },
    { id: 'p9', label: 'Drifters', weight: 0.35, watchThrough: 0.44, tone: 'default' },
    { id: 'p10', label: 'Lurkers', weight: 0.3, watchThrough: 0.53, tone: 'default' },
  ];
}

const SEED = 1337;

describe('instantiatePopulation', () => {
  it('Test 1 — instantiation count: ~1000 dots, sum === total, proportional to weight', () => {
    const nodes = tenNodes();
    const dots = instantiatePopulation(nodes, { total: 1000, seed: SEED });

    // Exact total — distribution must account for every dot.
    expect(dots.length).toBe(1000);

    // Per-archetype counts.
    const counts = new Map<string, number>();
    for (const d of dots) counts.set(d.archetype, (counts.get(d.archetype) ?? 0) + 1);

    // Sum of per-archetype counts === total.
    const sum = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(1000);

    // Highest-weight archetype gets the most dots; lowest gets fewer.
    const highest = counts.get('p1') ?? 0;
    const lowest = counts.get('p10') ?? 0;
    expect(highest).toBeGreaterThan(lowest);

    // Every archetype is represented (no node dropped).
    expect(counts.size).toBe(10);
  });

  it('Test 2 — determinism: same nodes+seed → byte-identical (deep-equal) output', () => {
    const nodes = tenNodes();
    const a = instantiatePopulation(nodes, { total: 1000, seed: SEED });
    const b = instantiatePopulation(nodes, { total: 1000, seed: SEED });
    expect(a).toEqual(b);
    // JSON byte-identity guards SSR hydration + the engine-determinism gate.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('Test 2b — default total is 1000 when opts.total omitted', () => {
    const nodes = tenNodes();
    const dots = instantiatePopulation(nodes, { seed: SEED });
    expect(dots.length).toBe(1000);
  });

  it('Test 4 — variance bounded + neighbour blend: real verdicts only, no invented verdict', () => {
    const nodes = tenNodes();
    const dots = instantiatePopulation(nodes, { total: 1000, seed: SEED });

    // The only legal verdicts are those the 10 emit (stop | scroll) — derived from
    // their real watchThrough. No dot invents a verdict outside that set.
    const legalVerdicts = new Set<PopulationDot['verdict']>(['stop', 'scroll']);
    for (const d of dots) {
      expect(legalVerdicts.has(d.verdict)).toBe(true);
      // sentiment is bounded 0..1.
      expect(d.sentiment).toBeGreaterThanOrEqual(0);
      expect(d.sentiment).toBeLessThanOrEqual(1);
      // each dot belongs to one of the 10.
      expect(nodes.some((n) => n.id === d.archetype)).toBe(true);
    }

    // Some dots blend toward a neighbour archetype (affinity), but the blend never
    // produces a verdict the cohort never emitted — assert at least one dot's
    // sentiment differs from its archetype's base watchThrough (bounded jitter present).
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const jittered = dots.some((d) => {
      const base = byId.get(d.archetype)!;
      return Math.abs(d.sentiment - base.watchThrough) > 1e-6;
    });
    expect(jittered).toBe(true);
  });
});

describe('weightedRollup', () => {
  it('Test 3 — weighted-rollup identity: aggregate is the SSOT for Panel·10 and Population·1000', () => {
    const nodes = tenNodes();
    const roll = weightedRollup(nodes);

    // stop + scroll === total.
    expect(roll.stop + roll.scroll).toBe(roll.total);
    expect(roll.total).toBeGreaterThan(0);

    // byArchetype carries all 10, each with its weight + a stop contribution.
    expect(roll.byArchetype.length).toBe(10);
    for (const row of roll.byArchetype) {
      expect(nodes.some((n) => n.id === row.archetype)).toBe(true);
      expect(row.weight).toBeGreaterThanOrEqual(0);
    }

    // Identity: the normalized Population·1000 stop-fraction equals the rollup's
    // normalized stop-fraction (same weighted verdict mix, two resolutions).
    const dots = instantiatePopulation(nodes, { total: 1000, seed: SEED });
    const popStop = dots.filter((d) => d.verdict === 'stop').length / dots.length;
    const rollStop = roll.stop / roll.total;
    // Within sampling tolerance of the 1000-dot resolution.
    expect(Math.abs(popStop - rollStop)).toBeLessThan(0.06);
  });

  it('weightedRollup is deterministic (pure)', () => {
    const nodes = tenNodes();
    expect(weightedRollup(nodes)).toEqual(weightedRollup(nodes));
  });
});

describe('cascadeOrder', () => {
  it('Test 5 — cascade order purity: deterministic ordering keyed on verdict/weight', () => {
    const nodes = tenNodes();
    const a = cascadeOrder(nodes);
    const b = cascadeOrder(nodes);

    // Identical across calls (no Math.random / Date.now).
    expect(a).toEqual(b);

    // Returns every node id exactly once.
    expect(a.length).toBe(nodes.length);
    expect(new Set(a).size).toBe(nodes.length);
    for (const n of nodes) expect(a).toContain(n.id);
  });
});
