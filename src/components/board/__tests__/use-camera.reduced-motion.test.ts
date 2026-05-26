/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { easeCameraTowards, easeOutQuart, useCamera } from '../use-camera';
import type { Camera } from '../board-types';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

describe('easeOutQuart', () => {
  it('t=0 returns 0', () => expect(easeOutQuart(0)).toBe(0));
  it('t=1 returns 1', () => expect(easeOutQuart(1)).toBe(1));
  it('clamps t below 0', () => expect(easeOutQuart(-1)).toBe(0));
  it('clamps t above 1', () => expect(easeOutQuart(2)).toBe(1));
});

describe('easeCameraTowards', () => {
  const a: Camera = { x: 0, y: 0, scale: 1 };
  const b: Camera = { x: 100, y: 50, scale: 2 };

  it('Test 1: t=0 returns from', () => {
    const result = easeCameraTowards(a, b, 0);
    expect(result).toEqual(a);
  });

  it('Test 2: t=1 returns to', () => {
    const result = easeCameraTowards(a, b, 1);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(50, 5);
    expect(result.scale).toBeCloseTo(2, 5);
  });

  it('Test 3: t=0.5 is between from and to', () => {
    const m = easeCameraTowards(a, b, 0.5);
    expect(m.x).toBeGreaterThan(0);
    expect(m.x).toBeLessThan(100);
    expect(m.y).toBeGreaterThan(0);
    expect(m.y).toBeLessThan(50);
  });
});

describe('useCamera + reducedMotion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 4: reducedMotion=true → setCamera called exactly once (instant snap)', () => {
    const setCamera = vi.fn();
    const setActivePreset = vi.fn();
    const { result } = renderHook(() =>
      useCamera({
        camera: { x: 0, y: 0, scale: 1 },
        setCamera,
        viewport: { width: 1200, height: 800 },
        activePreset: null,
        setActivePreset,
        reducedMotion: true,
      }),
    );
    act(() => {
      result.current.goToPreset('audience');
    });
    expect(setCamera).toHaveBeenCalledTimes(1);
  });

  it('Test 5: reducedMotion=false → setCamera called multiple times over ~300ms (animated glide)', () => {
    const setCamera = vi.fn();
    const setActivePreset = vi.fn();
    const { result } = renderHook(() =>
      useCamera({
        camera: { x: 0, y: 0, scale: 1 },
        setCamera,
        viewport: { width: 1200, height: 800 },
        activePreset: null,
        setActivePreset,
        reducedMotion: false,
      }),
    );

    act(() => {
      result.current.goToPreset('audience');
    });

    // Advance fake timers to trigger multiple RAF ticks
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // At minimum the first RAF tick should have fired, then subsequent ticks
    expect(setCamera.mock.calls.length).toBeGreaterThan(1);
  });
});
