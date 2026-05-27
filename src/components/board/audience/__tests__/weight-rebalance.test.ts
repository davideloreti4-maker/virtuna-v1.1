import { describe, it, expect } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import { rebalance, weightsEqual } from '../use-client-weights';

void buildHeatmapFixture; // ensures fixture import resolves

describe('weight-rebalance', () => {
  it('proportional rebalance maintains sum = 1.0 ± 0.005', () => {
    const initial = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    const result = rebalance(initial, 'fyp', 0.50);
    const sum = result.fyp + result.niche + result.loyalist + result.cross_niche;
    expect(sum).toBeCloseTo(1.0, 2);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.005);
  });

  it('no negative weights', () => {
    const initial = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    const result = rebalance(initial, 'fyp', 0.99);
    expect(result.niche).toBeGreaterThanOrEqual(0);
    expect(result.loyalist).toBeGreaterThanOrEqual(0);
    expect(result.cross_niche).toBeGreaterThanOrEqual(0);
  });

  it('single slider drag to 100% sets others to 0', () => {
    const initial = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    const result = rebalance(initial, 'fyp', 1.0);
    expect(result.fyp).toBeCloseTo(1.0, 4);
    expect(result.niche).toBeCloseTo(0, 4);
    expect(result.loyalist).toBeCloseTo(0, 4);
    expect(result.cross_niche).toBeCloseTo(0, 4);
  });

  it('weightsEqual returns true within epsilon', () => {
    const a = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    const b = { fyp: 0.65004, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    expect(weightsEqual(a, b)).toBe(true);
  });

  it('weightsEqual returns false outside epsilon', () => {
    const a = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    const b = { fyp: 0.66, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    expect(weightsEqual(a, b)).toBe(false);
  });

  it('rebalance otherSum===0 edge case', () => {
    // All others are 0, so redistribute is impossible — just normalize
    const initial = { fyp: 1.0, niche: 0.0, loyalist: 0.0, cross_niche: 0.0 };
    const result = rebalance(initial, 'fyp', 0.5);
    const sum = result.fyp + result.niche + result.loyalist + result.cross_niche;
    // Should not throw, and should remain a valid distribution
    expect(sum).toBeCloseTo(1.0, 3);
  });
});
