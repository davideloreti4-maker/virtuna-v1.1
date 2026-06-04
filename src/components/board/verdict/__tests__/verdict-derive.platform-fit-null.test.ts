import { describe, it, expect } from 'vitest';
import type { PredictionResult } from '@/lib/engine/types';
import { deriveSignalTiles } from '../verdict-derive';

// Confirmation tests — EXISTING null-safety verified (not new behavior added).
// See Plan 01-01 Task 3. Both paths were already null-safe; these tests prove it.

const baseResult = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({
    overall_score: 72,
    confidence: 0.7,
    has_video: true,
    factors: [],
    ...over,
  }) as unknown as PredictionResult;

describe('deriveSignalTiles — platform_fit null-safety', () => {
  it('does not throw and omits fit tile when platform_fit is null', () => {
    const result = baseResult({ platform_fit: null });
    let tiles: ReturnType<typeof deriveSignalTiles> | undefined;
    expect(() => {
      tiles = deriveSignalTiles(result);
    }).not.toThrow();
    // No TikTok fit tile surfaced from a null platform_fit
    expect(tiles?.find((t) => t.k === 'TikTok fit')).toBeUndefined();
  });

  it('does not throw and omits fit tile when platform_fit is undefined', () => {
    const result = baseResult({ platform_fit: undefined });
    let tiles: ReturnType<typeof deriveSignalTiles> | undefined;
    expect(() => {
      tiles = deriveSignalTiles(result);
    }).not.toThrow();
    expect(tiles?.find((t) => t.k === 'TikTok fit')).toBeUndefined();
  });

  it('does not throw when platform_fit object lacks fit_score', () => {
    const result = baseResult({
      platform_fit: {} as PredictionResult['platform_fit'],
    });
    let tiles: ReturnType<typeof deriveSignalTiles> | undefined;
    expect(() => {
      tiles = deriveSignalTiles(result);
    }).not.toThrow();
    expect(tiles?.find((t) => t.k === 'TikTok fit')).toBeUndefined();
  });

  it('surfaces fit tile when platform_fit has a valid numeric fit_score', () => {
    const result = baseResult({
      platform_fit: { fit_score: 85 } as PredictionResult['platform_fit'],
    });
    const tiles = deriveSignalTiles(result);
    const fitTile = tiles.find((t) => t.k === 'TikTok fit');
    expect(fitTile).toBeDefined();
    expect(fitTile?.v).toBe('85');
  });
});
