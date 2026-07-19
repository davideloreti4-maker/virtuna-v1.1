'use client';

/**
 * useChatStream — SSE consumer for POST /api/tools/chat (Plan 05-03, Task 1).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body (BLOCKER-1).
 *
 * SSE event contract (from 05-01-SUMMARY.md / route.ts):
 *   event: meta  { coldStart: boolean }  — structured cold-start signal (D-08); emitted FIRST
 *   event: token { delta: string }       — per-token text chunk
 *   event: done  { }                     — stream complete
 *   event: error { message: string }     — on any pipeline throw
 *
 * Exposes:
 *   - streamingText: accumulated assistant turn text (in-flight)
 *   - coldStart: true when the meta frame carried coldStart=true (D-08)
 *   - error: string | null (ChatThreadView renders the UI-SPEC error copy off this)
 *   - toBlocks(): single MarkdownBlock array for rendering via MessageBlocks
 *
 * Mirrors use-hooks-stream.ts: mount-guard + abort discipline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UseChatStreamReturn {
  /** Accumulated assistant turn text (in-flight, empty when idle/complete). */
  streamingText: string;
  /**
   * Skill card-blocks streamed inline this turn (CHAT_AGENT_DISPATCH — event: block), in arrival
   * order. Empty on a plain chat turn. Rendered via MessageBlocks in ChatThreadView so a
   * chat-dispatched ideas/hooks/script run shows its real cards in the SAME thread. Raw blocks
   * (MessageBlocks re-validates each), so the type is intentionally loose.
   */
  streamingBlocks: unknown[];
  /**
   * Pipeline stages from the dispatched skill's real phase boundaries (event: stage). Empty on a
   * plain chat turn. Feeds the progress spine, mirroring the skill-route stream hooks. Cleared on
   * each `dispatch` event so a second skill run in one turn starts a fresh spine.
   */
  stages: StageState[];
  /**
   * The skill the agent committed to running this turn (event: dispatch — the display key:
   * 'ideas' | 'hooks' | 'script' | …), or null on a plain chat turn / before any dispatch.
   * Arrives BEFORE the first stage event, so the run capsule can label itself and seed the
   * skill's stage plan while the pipeline is still spinning up. Holds the LATEST dispatch when
   * a turn runs two skills.
   */
  dispatchedSkill: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string if the stream or route failed. Null when no error. */
  error: string | null;
  /** True once the stream has completed (done event received). */
  isDone: boolean;
  /**
   * True when the meta frame carried coldStart=true (D-08).
   * Resets to false on reset() (between sends).
   */
  coldStart: boolean;
  /**
   * Sticky session-level flag: true once coldStart was ever true this session.
   * Used by ChatThreadView to gate the one-time cold-start nudge (D-08).
   * NOT reset by reset() — persists for the life of the hook instance.
   */
  nudgeShown: boolean;
  /**
   * Start the chat stream. Call from the composer chat send.
   * ask: the user's question/message (required — server enforces).
   * platform: current platform selection ("tiktok" | "instagram" | "youtube").
   */
  start: (ask: string, platform: string) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /**
   * Reset state for a new run. Called by start() automatically before each
   * new send; can also be called externally (e.g. on error recovery).
   * Clears error, coldStart, streamingText.
   */
  reset: () => void;
  /**
   * Convert the in-flight assistant turn to a MarkdownBlock array for rendering
   * via MessageBlocks. Returns [] when streamingText is empty.
   */
  toBlocks: () => MarkdownBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useChatStream(): UseChatStreamReturn {
  const [streamingText, setStreamingText] = useState('');
  // Skill card-blocks + stages from a chat-as-agent dispatch (CHAT_AGENT_DISPATCH). Empty on a
  // plain chat turn — these paths only fire when the route ran a skill (event: block / stage).
  const [streamingBlocks, setStreamingBlocks] = useState<unknown[]>([]);
  const [stages, setStages] = useState<StageState[]>([]);
  const [dispatchedSkill, setDispatchedSkill] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [coldStart, setColdStart] = useState(false);
  // Sticky session-level flag — set once when coldStart fires, never reset (D-08).
  const [nudgeShown, setNudgeShown] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  // Ref copies so block/stage events patch without a stale closure (mirrors use-ideas-stream).
  const blocksRef = useRef<unknown[]>([]);
  const stagesRef = useRef<StageState[]>([]);

  // WR-05: set isMountedRef = false on unmount so stream callbacks don't setState
  // on an unmounted component. Without this the useRef(true) guard is permanently
  // true and the "can't update state on unmounted component" leak is unguarded.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Keep a ref copy of accumulated text to avoid stale closures during streaming
  const textRef = useRef('');

  const reset = useCallback(() => {
    setStreamingText('');
    setStreamingBlocks([]);
    setStages([]);
    setDispatchedSkill(null);
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    setColdStart(false);
    textRef.current = '';
    blocksRef.current = [];
    stagesRef.current = [];
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) {
      setIsStreaming(false);
    }
  }, []);

  const start = useCallback(async (ask: string, platform: string) => {
    // Abort any prior in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset state for a new run (clears error, coldStart, streamingText, dispatch blocks/stages)
    setStreamingText('');
    setStreamingBlocks([]);
    setStages([]);
    setDispatchedSkill(null);
    setError(null);
    setIsDone(false);
    setColdStart(false);
    setIsStreaming(true);
    textRef.current = '';
    blocksRef.current = [];
    stagesRef.current = [];

    try {
      // CRITICAL: fetch + getReader, NOT EventSource (POST needs a body — BLOCKER-1).
      const res = await fetch('/api/tools/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ask, platform }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Chat request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Chat request failed');
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

        // Frames are delimited by \n\n (SSE spec)
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

          if (eventType === 'meta') {
            // meta leads the stream — parse coldStart signal (D-08)
            const cs = data.coldStart === true;
            if (isMountedRef.current) {
              setColdStart(cs);
              // nudgeShown is sticky — once set, never cleared (session-level gate)
              if (cs) setNudgeShown(true);
            }

          } else if (eventType === 'token') {
            // Accumulate token deltas into streaming text
            const delta = typeof data.delta === 'string' ? data.delta : '';
            if (delta) {
              textRef.current += delta;
              if (isMountedRef.current) setStreamingText(textRef.current);
            }

          } else if (eventType === 'block') {
            // Chat-as-agent (CHAT_AGENT_DISPATCH): a dispatched skill's card-block. Append in
            // arrival order; MessageBlocks re-validates each on render (unknown/invalid → placeholder).
            const block = (data as { block?: unknown }).block;
            if (block !== undefined) {
              blocksRef.current = [...blocksRef.current, block];
              if (isMountedRef.current) setStreamingBlocks([...blocksRef.current]);
            }

          } else if (eventType === 'dispatch') {
            // The agent committed to a skill run (the run-capsule seam). Arrives BEFORE the first
            // stage event. A SECOND dispatch in one turn starts a fresh spine: clear the live
            // stages so run 2's plan isn't overlaid on run 1's finished steps.
            const skill = typeof data.skill === 'string' ? data.skill : '';
            if (skill && isMountedRef.current) {
              stagesRef.current = [];
              setStages([]);
              setDispatchedSkill(skill);
            }

          } else if (eventType === 'stage') {
            // Dispatched skill's real pipeline phase — upsert by name, preserve first-seen order
            // (mirrors use-ideas-stream). Feeds the progress spine during a chat-run skill.
            const stageName = typeof data.name === 'string' ? data.name : '';
            const stageStatus = (data.status === 'active' || data.status === 'done')
              ? (data.status as StageState['status'])
              : 'pending';
            if (stageName) {
              const existing = stagesRef.current.find((s) => s.name === stageName);
              const updated = existing
                ? stagesRef.current.map((s) => (s.name === stageName ? { ...s, status: stageStatus } : s))
                : [...stagesRef.current, { name: stageName, status: stageStatus }];
              stagesRef.current = updated;
              if (isMountedRef.current) setStages([...updated]);
            }

          } else if (eventType === 'done') {
            if (isMountedRef.current) {
              setIsDone(true);
            }

          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Chat stream error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Chat stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  /**
   * Convert the in-flight assistant turn to a single MarkdownBlock array.
   * Returns [] when streamingText is empty (idle or no tokens yet).
   */
  const toBlocks = useCallback((): MarkdownBlock[] => {
    if (!streamingText) return [];
    return [
      {
        type: 'markdown',
        props: { text: streamingText },
      },
    ];
  }, [streamingText]);

  return {
    streamingText,
    streamingBlocks,
    stages,
    dispatchedSkill,
    isStreaming,
    error,
    isDone,
    coldStart,
    nudgeShown,
    start,
    stop,
    reset,
    toBlocks,
  };
}
