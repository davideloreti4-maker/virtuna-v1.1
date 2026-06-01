import { describe, it, expect } from 'vitest';
import {
  VB_W,
  PAD_TOP,
  FLOOR_Y,
  yForValue,
  xForTime,
  clamp01,
  retentionAt,
} from '../retention-geometry';

const segs = (...ts: number[]): Array<{ t_start: number }> =>
  ts.map((t) => ({ t_start: t }));

describe('clamp01', () => {
  it('clamps and guards NaN', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('yForValue', () => {
  it('maps 1 → top, 0 → floor, 0.5 → midpoint', () => {
    expect(yForValue(1)).toBe(PAD_TOP);
    expect(yForValue(0)).toBe(FLOOR_Y);
    expect(yForValue(0.5)).toBeCloseTo((PAD_TOP + FLOOR_Y) / 2, 5);
  });
});

describe('xForTime', () => {
  it('maps across the viewBox width and clamps', () => {
    expect(xForTime(0, 10)).toBe(0);
    expect(xForTime(10, 10)).toBe(VB_W);
    expect(xForTime(5, 10)).toBe(VB_W / 2);
    expect(xForTime(-3, 10)).toBe(0);
    expect(xForTime(99, 10)).toBe(VB_W);
  });
});

describe('retentionAt', () => {
  it('returns 0 for an empty curve and the lone value for a 1-point curve', () => {
    expect(retentionAt([], null, 10, 3)).toBe(0);
    expect(retentionAt([0.42], null, 10, 7)).toBeCloseTo(0.42, 5);
  });

  it('interpolates linearly between segment-timed points', () => {
    const curve = [1, 0]; // 1.0 at 0s, 0.0 at 10s
    const s = segs(0, 10);
    expect(retentionAt(curve, s, 10, 0)).toBeCloseTo(1, 5);
    expect(retentionAt(curve, s, 10, 10)).toBeCloseTo(0, 5);
    expect(retentionAt(curve, s, 10, 5)).toBeCloseTo(0.5, 5);
    expect(retentionAt(curve, s, 10, 2.5)).toBeCloseTo(0.75, 5);
  });

  it('holds flat before the first and after the last point', () => {
    const curve = [0.8, 0.2];
    const s = segs(2, 8);
    expect(retentionAt(curve, s, 10, 0)).toBeCloseTo(0.8, 5); // before first
    expect(retentionAt(curve, s, 10, 10)).toBeCloseTo(0.2, 5); // after last
  });

  it('falls back to an even spread when segments are absent', () => {
    const curve = [1, 0.5, 0]; // times 0, 5, 10 over total 10
    expect(retentionAt(curve, null, 10, 2.5)).toBeCloseTo(0.75, 5);
    expect(retentionAt(curve, null, 10, 7.5)).toBeCloseTo(0.25, 5);
  });

  it('clamps the query time into [0, total]', () => {
    const curve = [1, 0];
    const s = segs(0, 10);
    expect(retentionAt(curve, s, 10, -5)).toBeCloseTo(1, 5);
    expect(retentionAt(curve, s, 10, 50)).toBeCloseTo(0, 5);
  });
});
