// ---------------------------------------------------------------------------
// hive-mock-data.ts -- Deterministic mock data generator for development
// ---------------------------------------------------------------------------

import type { HiveNode, HiveData } from './hive-types';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) -- deterministic "random" numbers
// ---------------------------------------------------------------------------

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
  /** [min, max] tier-2 children per tier-1 (default: [8, 14]). */
  tier2Range?: [number, number];
  /** PRNG seed for reproducibility (default: 42). */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a mock hive data tree (societies.io style -- 2 tiers only).
 *
 * Defaults produce ~140 nodes:
 *   1 center + 12 tier-1 + ~130 tier-2
 */
export function generateMockHiveData(options?: MockHiveOptions): HiveData {
  const {
    tier1Count = 10,
    tier2Range = [24, 42],
    seed = 42,
  } = options ?? {};

  const rng = mulberry32(seed);

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
      tier2Children.push({
        id: `t2-${i}-${j}`,
        name: `Sub ${themeName}.${j + 1}`,
        tier: 2,
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
