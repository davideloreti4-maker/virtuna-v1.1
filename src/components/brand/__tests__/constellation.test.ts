import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buildFieldDots,
  meshEdges,
  cascadeKeyframes,
  CASCADE_CYCLE_SEC,
} from '../constellation';

const CONSTELLATION_PATH = resolve(
  import.meta.dirname,
  '..',
  'constellation.tsx',
);

describe('buildFieldDots — swarm layout', () => {
  it('clusters 12 dots in a 2D band (not a flat single row)', () => {
    const dots = buildFieldDots(12, 300, 72);
    const ys = dots.map((d) => d.cy);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    // Wide hero viewBox should use vertical spread, not a near-horizontal line.
    expect(ySpread).toBeGreaterThan(12);
    expect(dots.length).toBe(12);
  });

  it('uses at most 4 rows for 12 dots in a wide viewBox', () => {
    const dots = buildFieldDots(12, 300, 72);
    const cys = dots.map((d) => d.cy);
    const rowCenters: number[] = [];
    for (const cy of cys) {
      if (!rowCenters.some((c) => Math.abs(c - cy) < 9)) rowCenters.push(cy);
    }
    expect(rowCenters.length).toBeLessThanOrEqual(4);
  });
});

describe('meshEdges', () => {
  it('returns more edges than a tree and includes a node with degree >= 2', () => {
    const dots = buildFieldDots(12, 300, 72);
    const edges = meshEdges(dots);
    expect(edges.length).toBeGreaterThan(dots.length - 1);

    const degree = new Map<string, number>();
    for (const e of edges) {
      const [a, b] = e.key.split('-');
      degree.set(a!, (degree.get(a!) ?? 0) + 1);
      degree.set(b!, (degree.get(b!) ?? 0) + 1);
    }
    expect([...degree.values()].some((d) => d >= 2)).toBe(true);
  });
});

describe('cascadeKeyframes', () => {
  it('produces monotonic keyTimes from 0 to 1', () => {
    const { keyTimes } = cascadeKeyframes(3, 12);
    const times = keyTimes.split(';').map(Number);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBe(1);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
    }
  });

  it('peaks at the correct phase for each index', () => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const { keyTimes, values } = cascadeKeyframes(i, n);
      const times = keyTimes.split(';').map(Number);
      const vals = values.split(';').map(Number);
      const peakIdx = vals.indexOf(1);
      const expectedStart = i / n;
      expect(times[peakIdx]!).toBeCloseTo(expectedStart + (1 / n) * 0.12, 2);
    }
  });

  it('uses a shared cycle duration constant', () => {
    expect(CASCADE_CYCLE_SEC).toBe(6);
  });
});

describe('constellation.tsx — source guards', () => {
  it('is deterministic: no Math.random / Date.now / new Date', () => {
    const code = readFileSync(CONSTELLATION_PATH, 'utf8');
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
    expect(code).not.toMatch(/new Date\(/);
  });
});
