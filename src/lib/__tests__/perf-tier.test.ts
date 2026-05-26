/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: vi.fn(),
}));

import { getGPUTier } from '@pmndrs/detect-gpu';
import { detectInitialTier, startFpsSampler, usePerfStore, nextLowerTier } from '../perf-tier';

describe('detectInitialTier', () => {
  beforeEach(() => {
    localStorage.clear();
    (getGPUTier as ReturnType<typeof vi.fn>).mockReset();
  });

  it('returns cached value within TTL', async () => {
    localStorage.setItem('virtuna-perf-tier', 'medium');
    localStorage.setItem('virtuna-perf-tier-at', String(Date.now()));
    const tier = await detectInitialTier();
    expect(tier).toBe('medium');
    expect(getGPUTier).not.toHaveBeenCalled();
  });

  it('maps detect-gpu tier 3 → high', async () => {
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 3, type: 'BENCHMARK' });
    const tier = await detectInitialTier();
    expect(tier).toBe('high');
  });

  it('maps detect-gpu tier 2 → medium', async () => {
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 2, type: 'BENCHMARK' });
    expect(await detectInitialTier()).toBe('medium');
  });

  it('maps detect-gpu tier 1/0 → low', async () => {
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 1, type: 'BENCHMARK' });
    expect(await detectInitialTier()).toBe('low');
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 0, type: 'FALLBACK' });
    localStorage.clear();
    expect(await detectInitialTier()).toBe('low');
  });

  it('refreshes cache when older than 7 days', async () => {
    localStorage.setItem('virtuna-perf-tier', 'low');
    localStorage.setItem('virtuna-perf-tier-at', String(Date.now() - 8 * 24 * 60 * 60 * 1000));
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 3, type: 'BENCHMARK' });
    const tier = await detectInitialTier();
    expect(tier).toBe('high');
    expect(getGPUTier).toHaveBeenCalled();
  });

  it('writes tier to localStorage after detection', async () => {
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 3, type: 'BENCHMARK' });
    await detectInitialTier();
    expect(localStorage.getItem('virtuna-perf-tier')).toBe('high');
    expect(localStorage.getItem('virtuna-perf-tier-at')).toBeTruthy();
  });
});

describe('startFpsSampler', () => {
  let now = 0;
  let rafCb: FrameRequestCallback | null = null;
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb;
      return 1 as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('fires onDrop after 3 consecutive low-fps seconds', () => {
    const onDrop = vi.fn();
    startFpsSampler(onDrop);
    // Simulate 3 windows of 30fps (well below 40)
    for (let s = 0; s < 3; s++) {
      // 30 frames in 1000ms
      for (let f = 0; f < 30; f++) {
        now += 33;
        rafCb?.(now);
      }
    }
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('returns cancel function that stops RAF loop', () => {
    const onDrop = vi.fn();
    const cancel = startFpsSampler(onDrop);
    cancel();
    // After cancel, driving more frames should not fire onDrop
    for (let f = 0; f < 90; f++) {
      now += 33;
      rafCb?.(now);
    }
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe('usePerfStore', () => {
  it('initial state', () => {
    const s = usePerfStore.getState();
    expect(s.tier).toBe('high');
    expect(s.detected).toBe(false);
  });
  it('setTier updates state', () => {
    usePerfStore.getState().setTier('medium');
    expect(usePerfStore.getState()).toMatchObject({ tier: 'medium', detected: true });
  });
});

describe('nextLowerTier', () => {
  it('high → medium → low → low', () => {
    expect(nextLowerTier('high')).toBe('medium');
    expect(nextLowerTier('medium')).toBe('low');
    expect(nextLowerTier('low')).toBe('low');
  });
});
