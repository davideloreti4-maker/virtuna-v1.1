/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: vi.fn(),
}));

// Stub localStorage (happy-dom 20.x requires --localstorage-file path; stub instead)
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (index: number) => Object.keys(mockStorage)[index] ?? null,
});

import { getGPUTier } from '@pmndrs/detect-gpu';
import { detectInitialTier, startFpsSampler, usePerfStore, nextLowerTier } from '../perf-tier';

describe('detectInitialTier', () => {
  beforeEach(() => {
    mockStorage['virtuna-perf-tier'] && delete mockStorage['virtuna-perf-tier'];
    mockStorage['virtuna-perf-tier-at'] && delete mockStorage['virtuna-perf-tier-at'];
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    (getGPUTier as ReturnType<typeof vi.fn>).mockReset();
  });

  it('returns cached value within TTL', async () => {
    mockStorage['virtuna-perf-tier'] = 'medium';
    mockStorage['virtuna-perf-tier-at'] = String(Date.now());
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
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    expect(await detectInitialTier()).toBe('low');
  });

  it('refreshes cache when older than 7 days', async () => {
    mockStorage['virtuna-perf-tier'] = 'low';
    mockStorage['virtuna-perf-tier-at'] = String(Date.now() - 8 * 24 * 60 * 60 * 1000);
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 3, type: 'BENCHMARK' });
    const tier = await detectInitialTier();
    expect(tier).toBe('high');
    expect(getGPUTier).toHaveBeenCalled();
  });

  it('writes tier to localStorage after detection', async () => {
    (getGPUTier as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 3, type: 'BENCHMARK' });
    await detectInitialTier();
    expect(mockStorage['virtuna-perf-tier']).toBe('high');
    expect(mockStorage['virtuna-perf-tier-at']).toBeTruthy();
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
    // Simulate 3 windows of ~30fps (well below 40). Each window needs
    // enough frames to cross the 1000ms threshold. 34ms * 30 = 1020ms > 1000ms.
    for (let s = 0; s < 3; s++) {
      for (let f = 0; f < 30; f++) {
        now += 34;
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
      now += 34;
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
