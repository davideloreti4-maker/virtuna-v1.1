'use client';

/**
 * useIdeasStream — SSE consumer for POST /api/tools/ideas (Plan 04, Task 2).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body. This matches use-expert-chat.ts
 * (RESEARCH Pattern 3, BLOCKER-1).
 *
 * SSE event contract (from 03-03-SUMMARY.md):
 *   event: status  { message: string }       — "Generating ideas…" / "Scoring…"
 *   event: content { blocks: PartialCard[] } — card faces WITH scrollQuote (WARNING-4)
 *     NOTE: content event omits band/fraction — those arrive via score events.
 *   event: score   { seedHook, band, fraction, model } — per-card, fills band chip
 *   event: done    { count: N }
 *   event: error   { message: string }
 *
 * Content-first pattern (IDEAS-02/D-04):
 *   1. Content event → render card faces (title, angle, whyItFits, scrollQuote, …)
 *      with a placeholder band ("Mixed") until the score event arrives.
 *   2. Score events → patch the matching card's band + fraction.
 *   3. The final card (after scoring) is a complete IdeaCardBlock prop shape.
 *
 * The streamed cards use a local PartialIdeaCard type (band/fraction may be
 * placeholder until scored). The IdeasThreadView renders these using the same
 * IdeaCardRenderer by passing fully-formed or "pending score" blocks.
 */

import { useCallback, useRef, useState } from 'react';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Card as it arrives in the content event (band/fraction absent — filled by score events). */
export interface PartialIdeaCard {
  title: string;
  angle: string;
  whyItFits: string;
  mechanism: string;
  seedHook: string;
  needsTake: boolean;
  topic: string;
  take: string;
  format: string | null;
  scrollQuote: string;
  model: 'sim1-flash';
  // band/fraction: present after the matching score event; undefined until then
  band?: 'Strong' | 'Mixed' | 'Weak';
  fraction?: string;
  scored: boolean;
}

export interface UseIdeasStreamReturn {
  /** Cards streamed in-flight (partial until scored). Empty when idle/complete. */
  streamingCards: PartialIdeaCard[];
  /** Human-readable status message from the status event. */
  statusMessage: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string if the stream or route failed. */
  error: string | null;
  /** True once the stream has completed (done event received). */
  isDone: boolean;
  /**
   * Start the Ideas stream. Call from the composer Idea send.
   * ask: empty string → Auto mode; non-empty → seeded mode.
   */
  start: (ask: string, platform: string) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a new run. */
  reset: () => void;
  /**
   * Convert streaming cards to full IdeaCardBlock shapes for rendering via
   * IdeaCardRenderer. Cards with no score yet use "Mixed" + "" as placeholders.
   */
  toBlocks: () => IdeaCardBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useIdeasStream(): UseIdeasStreamReturn {
  const [streamingCards, setStreamingCards] = useState<PartialIdeaCard[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Keep a ref copy of streamingCards so score events can patch without stale closure
  const cardsRef = useRef<PartialIdeaCard[]>([]);

  const reset = useCallback(() => {
    setStreamingCards([]);
    setStatusMessage(null);
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    cardsRef.current = [];
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

    // Reset state for a new run
    setStreamingCards([]);
    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsStreaming(true);
    cardsRef.current = [];

    try {
      // CRITICAL: fetch + getReader, NOT EventSource (POST needs a body — BLOCKER-1).
      const res = await fetch('/api/tools/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ask, platform }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ideas request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Ideas request failed');
      }
      if (!res.body) throw new Error('No response body');

      // ── SSE body reader (mirrors use-expert-chat.ts SSE loop) ───────────────
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

          if (eventType === 'status') {
            const msg = typeof data.message === 'string' ? data.message : null;
            if (isMountedRef.current) setStatusMessage(msg);

          } else if (eventType === 'content') {
            // content event: card faces WITH scrollQuote; band/fraction absent until score
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const cards: PartialIdeaCard[] = rawBlocks
              .map((b: unknown) => {
                const block = b as Record<string, unknown>;
                const props = (block.props ?? {}) as Record<string, unknown>;
                return {
                  title: String(props.title ?? ''),
                  angle: String(props.angle ?? ''),
                  whyItFits: String(props.whyItFits ?? ''),
                  mechanism: String(props.mechanism ?? ''),
                  seedHook: String(props.seedHook ?? ''),
                  needsTake: Boolean(props.needsTake),
                  topic: String(props.topic ?? ''),
                  take: String(props.take ?? ''),
                  format: props.format === null ? null : (props.format ? String(props.format) : null),
                  scrollQuote: String(props.scrollQuote ?? ''),
                  model: 'sim1-flash' as const,
                  scored: false,
                };
              })
              .filter((c: PartialIdeaCard) => c.title.length > 0);

            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);

          } else if (eventType === 'score') {
            // score event: patch the matching card (match by seedHook)
            const scoreSeedHook = typeof data.seedHook === 'string' ? data.seedHook : '';
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';

            const updated = cardsRef.current.map((c) =>
              c.seedHook === scoreSeedHook || !c.scored
                ? { ...c, band, fraction, scored: true }
                : c,
            );
            // Apply to the FIRST unscored card if seedHook doesn't match (order fallback)
            const hadMatch = cardsRef.current.some((c) => c.seedHook === scoreSeedHook);
            let patched = updated;
            if (!hadMatch) {
              let applied = false;
              patched = cardsRef.current.map((c) => {
                if (!c.scored && !applied) { applied = true; return { ...c, band, fraction, scored: true }; }
                return c;
              });
            }
            cardsRef.current = patched;
            if (isMountedRef.current) setStreamingCards([...patched]);

          } else if (eventType === 'done') {
            if (isMountedRef.current) {
              setIsDone(true);
              setStatusMessage(null);
            }

          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Ideas error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Ideas stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  /**
   * Convert partial streaming cards to full IdeaCardBlock shapes.
   * Cards with no band yet use "Mixed" + "–" as interim placeholders.
   */
  const toBlocks = useCallback((): IdeaCardBlock[] => {
    return streamingCards.map((c): IdeaCardBlock => ({
      type: 'idea-card',
      props: {
        title: c.title,
        angle: c.angle,
        whyItFits: c.whyItFits,
        mechanism: c.mechanism,
        seedHook: c.seedHook,
        needsTake: c.needsTake,
        topic: c.topic,
        take: c.take,
        format: c.format,
        band: c.band ?? 'Mixed',
        fraction: c.fraction ?? '–',
        scrollQuote: c.scrollQuote,
        model: 'sim1-flash',
      },
    }));
  }, [streamingCards]);

  return {
    streamingCards,
    statusMessage,
    isStreaming,
    error,
    isDone,
    start,
    stop,
    reset,
    toBlocks,
  };
}
