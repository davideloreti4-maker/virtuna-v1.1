'use client';
import { create } from 'zustand';

export type PerfTier = 'high' | 'medium' | 'low';

interface PerfStore {
  tier: PerfTier;
  detected: boolean;
  setTier: (t: PerfTier) => void;
}

export const usePerfStore = create<PerfStore>((set) => ({
  tier: 'high',
  detected: false,
  setTier: (t) => set({ tier: t, detected: true }),
}));

const CACHE_KEY = 'virtuna-perf-tier';
const CACHE_AT_KEY = 'virtuna-perf-tier-at';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOW_FPS_THRESHOLD = 40;
const LOW_FPS_SUSTAIN_SECONDS = 3;

function mapTier(detectGpuTier: number): PerfTier {
  if (detectGpuTier >= 3) return 'high';
  if (detectGpuTier === 2) return 'medium';
  return 'low';
}

export function nextLowerTier(t: PerfTier): PerfTier {
  return t === 'high' ? 'medium' : t === 'medium' ? 'low' : 'low';
}

export async function detectInitialTier(): Promise<PerfTier> {
  try {
    const cached = localStorage.getItem(CACHE_KEY) as PerfTier | null;
    const cachedAt = parseInt(localStorage.getItem(CACHE_AT_KEY) ?? '0', 10);
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  } catch {
    // localStorage unavailable (privacy mode); fall through to detection
  }
  try {
    const { getGPUTier } = await import('@pmndrs/detect-gpu');
    const result = await getGPUTier();
    const tier = mapTier(typeof result.tier === 'number' ? result.tier : 0);
    try {
      localStorage.setItem(CACHE_KEY, tier);
      localStorage.setItem(CACHE_AT_KEY, Date.now().toString());
    } catch {
      /* ignore */
    }
    return tier;
  } catch {
    return 'high'; // fail-open
  }
}

/**
 * Runtime FPS sampler. Drops tier once if sustained low FPS detected; then
 * stops to prevent fighting itself. Returns a cancel function.
 */
export function startFpsSampler(onDrop: () => void): () => void {
  let frames = 0;
  let lastSample = performance.now();
  let lowFrames = 0;
  let raf = 0;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    frames++;
    const now = performance.now();
    if (now - lastSample >= 1000) {
      const fps = (frames * 1000) / (now - lastSample);
      if (fps < LOW_FPS_THRESHOLD) lowFrames++;
      else lowFrames = 0;
      if (lowFrames >= LOW_FPS_SUSTAIN_SECONDS) {
        cancelled = true;
        onDrop();
        return;
      }
      frames = 0;
      lastSample = now;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
