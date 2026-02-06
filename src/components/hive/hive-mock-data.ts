// ---------------------------------------------------------------------------
// hive-mock-data.ts -- Deterministic mock data generator for development
// ---------------------------------------------------------------------------

import type { HiveNode, HiveData } from './hive-types';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) -- deterministic "random" numbers
// ---------------------------------------------------------------------------

/**
 * Mulberry32 PRNG. Returns a function that produces pseudo-random numbers
 * in [0, 1) from a 32-bit seed. Same seed always produces the same sequence.
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MockHiveOptions {
  /** Number of tier-1 children (default: 12). */
  tier1Count?: number;
  /** [min, max] tier-2 children per tier-1 (default: [8, 12]). */
  tier2Range?: [number, number];
  /** [min, max] tier-3 children per tier-2 (default: [8, 12]). */
  tier3Range?: [number, number];
  /** PRNG seed for reproducibility (default: 42). */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a mock hive data tree with realistic node counts.
 *
 * Defaults produce ~1333 nodes:
 *   1 center + 12 tier-1 + ~120 tier-2 + ~1200 tier-3
 *
 * The PRNG is seeded so identical options always produce identical data.
 *
 * @param options - Configuration for node counts and seed
 * @returns Root HiveData node (tier 0) with populated children
 */
export function generateMockHiveData(options?: MockHiveOptions): HiveData {
  const {
    tier1Count = 12,
    tier2Range = [8, 12],
    tier3Range = [8, 12],
    seed = 42,
  } = options ?? {};

  const rng = mulberry32(seed);

  /** Produce a random integer in [min, max] using the seeded PRNG. */
  function randInt(min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
  }

  const THEME_NAMES = [
    'Engagement',
    'Sentiment',
    'Clarity',
    'Relevance',
    'Trust',
    'Emotion',
    'Humor',
    'Novelty',
    'Authority',
    'Urgency',
    'Authenticity',
    'Controversy',
    'Inspiration',
    'Nostalgia',
    'Curiosity',
    'Empathy',
  ];

  const tier1Children: HiveNode[] = [];

  for (let i = 0; i < tier1Count; i++) {
    const themeName = THEME_NAMES[i % THEME_NAMES.length];
    const tier2Count = randInt(tier2Range[0], tier2Range[1]);
    const tier2Children: HiveNode[] = [];

    for (let j = 0; j < tier2Count; j++) {
      const tier3Count = randInt(tier3Range[0], tier3Range[1]);
      const tier3Children: HiveNode[] = [];

      for (let k = 0; k < tier3Count; k++) {
        tier3Children.push({
          id: `t3-${i}-${j}-${k}`,
          name: `Leaf ${themeName}.${j + 1}.${k + 1}`,
          tier: 3,
        });
      }

      tier2Children.push({
        id: `t2-${i}-${j}`,
        name: `Sub ${themeName}.${j + 1}`,
        tier: 2,
        children: tier3Children,
      });
    }

    tier1Children.push({
      id: `t1-${i}`,
      name: `Theme ${themeName}`,
      tier: 1,
      children: tier2Children,
    });
  }

  return {
    id: 'center',
    name: 'Test Content',
    tier: 0,
    children: tier1Children,
  };
}

// ---------------------------------------------------------------------------
// Utility -- count nodes in a tree (for verification)
// ---------------------------------------------------------------------------

/** Recursively count all nodes in a HiveNode tree. */
export function countNodes(node: HiveNode): number {
  if (!node.children || node.children.length === 0) return 1;
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}
