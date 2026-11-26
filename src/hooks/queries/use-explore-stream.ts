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

import { useCallback, useRef, useState } from 'react';
import { reportCredit402, CreditWallRefusal, isCreditWallRefusal } from '@/lib/billing/credit-wall';
import { reportSession401, SessionExpiredRefusal } from '@/lib/auth/session-expired';
import { resolveRunError } from '@/lib/net/run-failure';
import type { OutlierGridBlock } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';
import { useLetGoRun } from '@/hooks/queries/use-let-go-run';

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
  /**
   * The creator pressed Stop while this run's request was out. A stopped run is still a run: its
   * turn (the creator's message above it) stays on screen even when Stop came before a single
   * stage or card, as it does for a run stopped mid-way. Cleared by the next start and by reset().
   */
  isStopped: boolean;
  /**
   * How many runs this stream has started (a refine and a retry each count). A new number is a new
   * run even when no render saw it streaming: a request refused at once ends in the render it began in.
   */
  runs: number;
  /** Pipeline stages — populated by SSE stage events. Ephemeral: shown during streaming. */
  stages: StageState[];
  /**
   * Start the Explore pull. Call from the composer Explore send or a quick-action.
   * Re-expose as the retry entry point for the skill-run error state.
   */
  start: (params: ExploreStartParams) => Promise<void>;
  /**
   * Replay the last start() with the same params (the failed turn's Retry). No-op before the first
   * start.
   */
  retry: () => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /**
   * Let go of the request in flight without ending it (a thread switch): it runs to its end in the
   * background, so its route stays alive to store the result in the chat it was started in, and
   * every frame it still sends is dropped. Stop is different: it ends the request (`stop`).
   */
  detach: () => void;
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
  const [isStopped, setIsStopped] = useState(false);
  const [runs, setRuns] = useState(0);
  const [stages, setStages] = useState<StageState[]>([]);

  // The in-flight request's controller; null once its stream has ended, so Stop can tell a run it
  // cut short from one that was already over.
  const abortRef = useRef<AbortController | null>(null);
  // The last call as it was made, so Retry replays the run the creator asked for.
  const lastCallRef = useRef<ExploreStartParams | null>(null);
  const isMountedRef = useRef(true);
  // Ref copy of stages so the upsert can patch without a stale closure.
  const stagesRef = useRef<StageState[]>([]);

  // The let-go machinery (`use-let-go-run`): each request's number and liveness, a thread switch or an
  // unmount letting the run go on in the background, and the mount effect that owns `isMountedRef`.
  const letGo = useLetGoRun(abortRef, isMountedRef);

  const reset = useCallback(() => {
    setStreamingBlock(null);
    setStatusMessage(null);
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    setIsStopped(false);
    setStages([]);
    stagesRef.current = [];
  }, []);

  const stop = useCallback(() => {
    const inFlight = abortRef.current;
    inFlight?.abort();
    abortRef.current = null;
    if (isMountedRef.current) {
      setIsStreaming(false);
      if (inFlight) setIsStopped(true);
    }
  }, []);

  // A thread switch lets the run go on in the background (see the interface): its request is left
  // open and its number retired, so its reader drops what is still to come.
  const detach = letGo.detach;

  const start = useCallback(async (params: ExploreStartParams) => {
    // Abort any prior in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // This request's number and liveness (`use-let-go-run`): once let go, every frame it still sends
    // is read and dropped, so it reaches its end without touching the next chat's run.
    const { gen, isLive } = letGo.begin();
    lastCallRef.current = params;

    // Reset state for a new run.
    setStreamingBlock(null);
    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsStopped(false);
    setIsStreaming(true);
    setRuns((r) => r + 1);
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
        // 401 first — it is not a 402, and each check then reads only its own status. The
        // refusal's flag carries the cause to this turn's copy (lib/net/run-failure.ts).
        if (reportSession401(res.status)) throw new SessionExpiredRefusal();
        if (reportCredit402(res.status, err)) {
          // The wall dialog is up (CreditWallListener) and it IS the UI: unwind without drawing an
          // inline error under it (see CreditWallRefusal — the old throw put a futile retry there).
          throw new CreditWallRefusal(errObj.message);
        }
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
        if (!isLive()) continue; // detached: read on to the end, draw nothing
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
              if (isLive()) setStages([...updated]);
            }

          } else if (eventType === 'status') {
            const msg = typeof data.message === 'string' ? data.message : null;
            if (isLive()) setStatusMessage(msg);

          } else if (eventType === 'content') {
            // content event: data.blocks is an array carrying the single outlier-grid block.
            // Guard the shape — only accept block.type === "outlier-grid".
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const gridBlock = rawBlocks.find(
              (b: unknown) =>
                typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'outlier-grid',
            ) as OutlierGridBlock | undefined;
            if (gridBlock && isLive()) setStreamingBlock(gridBlock);

          } else if (eventType === 'done') {
            if (isLive()) {
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
      // The credit wall is already up and owns this refusal — an inline error under the modal
      // would offer a retry that gets the same 402 (see CreditWallRefusal). `finally` still resets.
      if (isCreditWallRefusal(err)) return;
      // A null result means draw nothing: an abort is the user's own Stop, not a failure.
      const message = resolveRunError(err, 'Explore stream error');
      if (message === null) return;
      if (isLive()) setError(message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      letGo.finish(gen);
      if (isLive()) {
        setIsStreaming(false);
      }
    }
  }, [letGo]);

  const retry = useCallback(async () => {
    const last = lastCallRef.current;
    if (last) await start(last);
  }, [start]);

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
    isStopped,
    runs,
    stages,
    start,
    retry,
    stop,
    detach,
    reset,
    toBlocks,
  };
}
