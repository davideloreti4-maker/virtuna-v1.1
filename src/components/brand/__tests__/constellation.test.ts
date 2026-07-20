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
  it('clusters 12 dots in a single elliptical swarm (not a flat row)', () => {
    const dots = buildFieldDots(12, 300, 72);
    const ys = dots.map((d) => d.cy);
    const xs = dots.map((d) => d.cx);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    expect(ySpread).toBeGreaterThan(14);
    expect(xSpread).toBeLessThan(260);
    expect(dots.length).toBe(12);
  });

  it('keeps dots in one cluster (no disconnected row bands)', () => {
    const dots = buildFieldDots(12, 300, 84);
    const cx = dots.reduce((s, d) => s + d.cx, 0) / dots.length;
    const cy = dots.reduce((s, d) => s + d.cy, 0) / dots.length;
    const maxR = Math.max(
      ...dots.map((d) => Math.hypot(d.cx - cx, d.cy - cy)),
    );
    expect(maxR).toBeLessThan(120);
  });
});

describe('meshEdges', () => {
  it('returns a dense mesh with high average degree', () => {
    const dots = buildFieldDots(12, 300, 84);
    const edges = meshEdges(dots);
    expect(edges.length).toBeGreaterThan(dots.length);

    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(String(e.a), (degree.get(String(e.a)) ?? 0) + 1);
      degree.set(String(e.b), (degree.get(String(e.b)) ?? 0) + 1);
    }
    const avg =
      [...degree.values()].reduce((s, d) => s + d, 0) / degree.size;
    expect(avg).toBeGreaterThanOrEqual(2.5);
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
      expect(times[peakIdx]!).toBeCloseTo(expectedStart + (1 / n) * 0.08, 2);
    }
  });

  it('uses a shared cycle duration constant', () => {
    expect(CASCADE_CYCLE_SEC).toBe(18);
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
