/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUploadedVideoSource } from '../use-uploaded-video-source';
import type { PredictionResult } from '@/lib/engine/types';

// Minimal cast helper: the persisted row carries input_mode/video_storage_path
// even though PredictionResult's type doesn't declare them.
function rowResult(extra: Record<string, unknown>): PredictionResult {
  return extra as unknown as PredictionResult;
}

describe('useUploadedVideoSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the local object URL immediately and never signs', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() =>
      useUploadedVideoSource(rowResult({ input_mode: 'video_upload', video_storage_path: 'u/x.mp4' }), 'blob:local-123'),
    );

    expect(result.current).toEqual({ src: 'blob:local-123', status: 'ready' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signs a stored upload path on reload (no local blob)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://signed/video.mp4' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() =>
      useUploadedVideoSource(rowResult({ input_mode: 'video_upload', video_storage_path: 'user-1/clip.mp4' }), null),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).toBe('https://signed/video.mp4');
    expect(fetchSpy).toHaveBeenCalledWith('/api/videos/sign?path=user-1%2Fclip.mp4');
  });

  it('reports missing on a 404 (deleted / never uploaded)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'video_missing' }) }),
    );

    const { result } = renderHook(() =>
      useUploadedVideoSource(rowResult({ input_mode: 'video_upload', video_storage_path: 'user-1/gone.mp4' }), null),
    );

    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.src).toBeNull();
  });

  it('yields no source for tiktok_url mode WITHOUT a stored path (never signs)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() =>
      useUploadedVideoSource(rowResult({ input_mode: 'tiktok_url', video_url: 'https://tiktok/x' }), null),
    );

    expect(result.current).toEqual({ src: null, status: 'idle' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signs a re-hosted tiktok_url path on reload (reading-ux S1)', async () => {
    // tiktok_url runs now re-host the real mp4 to an owner-prefixed, signable path,
    // so the scrubber resolves a playable source on permalink reload just like uploads.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://signed/tiktok.mp4' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() =>
      useUploadedVideoSource(
        rowResult({ input_mode: 'tiktok_url', video_storage_path: 'user-1/tiktok-abc.mp4' }),
        null,
      ),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).toBe('https://signed/tiktok.mp4');
    expect(fetchSpy).toHaveBeenCalledWith('/api/videos/sign?path=user-1%2Ftiktok-abc.mp4');
  });

  it('yields no source when result is null', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderHook(() => useUploadedVideoSource(null, null));
    expect(result.current.src).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
