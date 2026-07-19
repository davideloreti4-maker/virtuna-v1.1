'use client';

/**
 * useExploreStream — SSE consumer for POST /api/tools/explore (Plan 11-05, Task 1).
 *
 * CRITICAL: the SSE body is consumed via `fetch` + `res.body.getReader()`.
 * The browser's native SSE client is GET-only and cannot POST a body (BLOCKER-1,
 * RESEARCH Pitfall / Anti-pattern) — so a fetch stream reader is used instead.
 *
 * SIMPLER than useHooksStream: Explore streams ONE outlier-grid block in the content
 * event — there are NO per-card score events and NO followup turn. The whole grid
 * (tiles incl. the audience-fit estimate) arrives in a single content frame; the real
 * persona reaction is lazy (on tap, via the reused remix-card's LensTrigger — D-02),
 * never on the grid.
 *
 * SSE event contract (mirrors /api/tools/explore — clients parse `event:`/`data:` lines):
 *   event: stage   { name: "Pulling outliers" | "Scoring for your audience", status: "active"|"done" }
 *   event: content { blocks: [outlier-grid block] }  — the single grid block (content-first)
 *   event: done    { count }
 *   event: error   { message }
 *
 * Clones the use-hooks-stream structure: fetch+getReader, the \n\n frame split, the
 * event/data line parse, the WR-05 isMountedRef unmount guard + abortRef, the stage
 * upsert-by-name into StageState[]. Drops the score-patch + followup machinery (Explore
 * has neither).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportCredit402 } from '@/lib/billing/credit-wall';
import type { OutlierGridBlock } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Params the composer / a quick-action passes to start the Explore pull. */
export interface ExploreStartParams {
  /** Niche / keywords (a niche-mode pull). */
  niche?: string;
  /** Accounts handle(s) — a profile-mode pull. */
  accounts?: string;
  /** Time window param (Today/This week/This month). Accepted by the route. */
  timeWindow?: string;
  /** Serendipity valve 0..1 (0 = on-niche, 1 = widen beyond niche — D-06). */
  serendipity?: number;
  /** A single preset input string (quick-actions may pass this directly). */
  input?: string;
  /**
   * CR-02 — "use my tracked accounts" signal (the competitors card). The route resolves
   * the session user's tracked handles server-side; the client NEVER sends handles
   * (preserves the CR-01 user_id-from-session invariant).
   */
  tracked?: boolean;
}

export interface UseExploreStreamReturn {
  /** The single outlier-grid block streamed in the content event (null until it arrives). */
  streamingBlock: OutlierGridBlock | null;
  /** Human-readable status message (reserved — the route currently emits stages only). */
  statusMessage: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string if the stream or route failed. */
  error: string | null;
  /** True once the stream has completed (done event received). */
  isDone: boolean;
  /** Pipeline stages — populated by SSE stage events. Ephemeral: shown during streaming. */
  stages: StageState[];
  /**
   * Start the Explore pull. Call from the composer Explore send or a quick-action.
   * Re-expose as the retry entry point for the skill-run error state.
   */
  start: (params: ExploreStartParams) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a new run. */
  reset: () => void;
  /**
   * Convert the streaming block to an OutlierGridBlock[] for MessageBlocks rendering.
   * Returns [streamingBlock] when present, else [].
   */
  toBlocks: () => OutlierGridBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useExploreStream(): UseExploreStreamReturn {
  const [streamingBlock, setStreamingBlock] = useState<OutlierGridBlock | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [stages, setStages] = useState<StageState[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  // Ref copy of stages so the upsert can patch without a stale closure.
  const stagesRef = useRef<StageState[]>([]);

  // WR-05: set isMountedRef = false on unmount so stream callbacks don't setState on an
  // unmounted component (verbatim the use-hooks-stream guard).
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setStreamingBlock(null);
    setStatusMessage(null);
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    setStages([]);
    stagesRef.current = [];
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) {
      setIsStreaming(false);
    }
  }, []);

  const start = useCallback(async (params: ExploreStartParams) => {
    // Abort any prior in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset state for a new run.
    setStreamingBlock(null);
    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsStreaming(true);
    setStages([]);
    stagesRef.current = [];

    try {
      // CRITICAL: fetch + getReader, NOT the SSE GET-only client (POST needs a body — BLOCKER-1).
      const res = await fetch('/api/tools/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Explore request failed' }));
        const errObj = err as { error?: string; message?: string };
        reportCredit402(res.status, err); // wall dialog if it's the credit 402
        throw new Error(errObj.message ?? errObj.error ?? 'Explore request failed');
      }
      if (!res.body) throw new Error('No response body');

      // ── SSE body reader (mirrors use-hooks-stream.ts SSE loop) ──────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are delimited by \n\n (SSE spec).
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

          if (eventType === 'stage') {
            // Upsert stage by name — preserve order of first appearance (verbatim use-hooks-stream).
            const stageName = typeof data.name === 'string' ? data.name : '';
            const stageStatus = (data.status === 'active' || data.status === 'done')
              ? data.status as StageState['status']
              : 'pending';
            if (stageName) {
              const existing = stagesRef.current.find((s) => s.name === stageName);
              let updated: StageState[];
              if (existing) {
                updated = stagesRef.current.map((s) =>
                  s.name === stageName ? { ...s, status: stageStatus } : s,
                );
              } else {
                updated = [...stagesRef.current, { name: stageName, status: stageStatus }];
              }
              stagesRef.current = updated;
              if (isMountedRef.current) setStages([...updated]);
            }

          } else if (eventType === 'status') {
            const msg = typeof data.message === 'string' ? data.message : null;
            if (isMountedRef.current) setStatusMessage(msg);

          } else if (eventType === 'content') {
            // content event: data.blocks is an array carrying the single outlier-grid block.
            // Guard the shape — only accept block.type === "outlier-grid".
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const gridBlock = rawBlocks.find(
              (b: unknown) =>
                typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'outlier-grid',
            ) as OutlierGridBlock | undefined;
            if (gridBlock && isMountedRef.current) setStreamingBlock(gridBlock);

          } else if (eventType === 'done') {
            if (isMountedRef.current) {
              setIsDone(true);
              setStatusMessage(null);
            }

          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Explore error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Explore stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  /**
   * Convert the streaming block to an OutlierGridBlock[] for MessageBlocks rendering.
   * One grid block per run (no per-tile score events) — so this is [block] or [].
   */
  const toBlocks = useCallback((): OutlierGridBlock[] => {
    return streamingBlock ? [streamingBlock] : [];
  }, [streamingBlock]);

  return {
    streamingBlock,
    statusMessage,
    isStreaming,
    error,
    isDone,
    stages,
    start,
    stop,
    reset,
    toBlocks,
  };
}
