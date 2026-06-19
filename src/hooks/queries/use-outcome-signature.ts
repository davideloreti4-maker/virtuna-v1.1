'use client';

/**
 * useOutcomeSignature — SSE consumer for POST /api/outcomes/signature (10-03 Task 3, FLYWHEEL-01).
 *
 * The capture-outcome arc: paste a posted URL (+ optional private signals) → the route
 * scrapes public metrics, builds a provenance-tagged realized signature, reconciles it
 * against the PINNED prediction, and logs a reconciliation row.
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource) — EventSource is GET-only
 * and cannot POST a body (BLOCKER-1). Mirrors use-hooks-stream.ts SSE loop.
 *
 * SSE event contract (route + UI-SPEC §"Outcome capture — signature"):
 *   event: status  { message } — "Reading the post…"
 *   event: done    { reconciliation_id, outcome_id } — captured + reconciled
 *   event: error   { message }  — generic scrape-fail copy (never echoes the URL)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CaptureSignalsInput {
  analysis_id?: string | null;
  audience_id?: string | null;
  posted_url: string;
  /** Optional creator-supplied private signals. A blank field is omitted → excluded (never zero). */
  private?: {
    saves?: number;
    watch_through_pct?: number;
    link_clicks?: number;
  };
}

export interface UseOutcomeSignatureReturn {
  /** Human-readable status message from the status event ("Reading the post…"). */
  statusMessage: string | null;
  /** True while the SSE stream is active. */
  isCapturing: boolean;
  /** Error string if the route or stream failed (UI shows the scrape-fail copy). */
  error: string | null;
  /** True once the capture has completed (done event received). */
  isDone: boolean;
  /** Start a capture. Resolves when the stream completes (success or error). */
  capture: (input: CaptureSignalsInput) => Promise<void>;
  /** Reset state for a new capture. */
  reset: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useOutcomeSignature(): UseOutcomeSignatureReturn {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setStatusMessage(null);
    setIsCapturing(false);
    setError(null);
    setIsDone(false);
  }, []);

  const capture = useCallback(async (input: CaptureSignalsInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsCapturing(true);

    try {
      const res = await fetch('/api/outcomes/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: 'Capture request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Capture request failed');
      }
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const frameLines = frame.split('\n');
          let eventType = 'message';
          let dataLine = '';
          for (const fLine of frameLines) {
            if (fLine.startsWith('event: ')) eventType = fLine.slice(7).trim();
            else if (fLine.startsWith('data: ')) dataLine = fLine.slice(6);
          }
          if (!dataLine) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue; // malformed JSON — skip frame
          }

          if (eventType === 'status') {
            const msg = typeof data.message === 'string' ? data.message : null;
            if (isMountedRef.current) setStatusMessage(msg);
          } else if (eventType === 'done') {
            if (isMountedRef.current) {
              setIsDone(true);
              setStatusMessage(null);
            }
          } else if (eventType === 'error') {
            const msg =
              typeof data.message === 'string'
                ? data.message
                : 'Couldn’t read that post.';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Capture stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  }, []);

  return { statusMessage, isCapturing, error, isDone, capture, reset };
}
