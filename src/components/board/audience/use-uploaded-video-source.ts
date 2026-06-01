'use client';
import { useEffect, useState } from 'react';
import type { PredictionResult } from '@/lib/engine/types';

/**
 * Resolve a *playable* video source for the Audience retention scrubber.
 *
 * Real video is surfaced for UPLOADED videos only (the product decision): a
 * tiktok_url analysis stores no inline-playable mp4, and text mode has no video.
 *
 * Precedence:
 *   1. `pendingObjectUrl` — the locally selected file's blob URL, present on a
 *      fresh run (zero network, frame-accurate). Wins when set.
 *   2. A short-lived signed URL from `/api/videos/sign` when the persisted row
 *      is `input_mode === 'video_upload'` with a `video_storage_path` (permalink
 *      reload by the owner). 404 → `missing` (deleted by retention / never up).
 *   3. Otherwise none — the caller falls back to the static curve.
 */
export type VideoSourceStatus = 'idle' | 'loading' | 'ready' | 'missing';

export interface UploadedVideoSource {
  src: string | null;
  status: VideoSourceStatus;
}

/** Fields carried on the persisted analysis row but absent from PredictionResult's type. */
type VideoCarrier = {
  input_mode?: string | null;
  video_storage_path?: string | null;
};

export function useUploadedVideoSource(
  result: PredictionResult | null,
  pendingObjectUrl: string | null,
): UploadedVideoSource {
  const carrier = result as (PredictionResult & VideoCarrier) | null;
  const path =
    carrier?.input_mode === 'video_upload' && carrier.video_storage_path
      ? carrier.video_storage_path
      : null;

  const shouldSign = !pendingObjectUrl && !!path;

  // The signing RESULT lives in state keyed by the path it belongs to; every
  // setState happens inside an async callback (never synchronously in the
  // effect). Loading is derived — if there's no resolved entry for the current
  // path yet, a sign is in flight.
  const [resolved, setResolved] = useState<{ key: string; value: UploadedVideoSource } | null>(
    null,
  );

  useEffect(() => {
    if (!shouldSign || !path) return;

    let cancelled = false;
    const settle = (value: UploadedVideoSource) => {
      if (!cancelled) setResolved({ key: path, value });
    };

    fetch(`/api/videos/sign?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) return settle({ src: null, status: 'missing' });
        if (!r.ok) return settle({ src: null, status: 'idle' });
        const body = (await r.json()) as { url?: string };
        settle(body.url ? { src: body.url, status: 'ready' } : { src: null, status: 'idle' });
      })
      .catch(() => settle({ src: null, status: 'idle' }));

    return () => {
      cancelled = true;
    };
  }, [shouldSign, path]);

  if (pendingObjectUrl) return { src: pendingObjectUrl, status: 'ready' };
  if (!path) return { src: null, status: 'idle' };
  if (resolved && resolved.key === path) return resolved.value;
  return { src: null, status: 'loading' };
}
