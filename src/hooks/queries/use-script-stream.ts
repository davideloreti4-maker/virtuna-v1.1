'use client';

/**
 * useScriptStream — SSE consumer for POST /api/tools/script (Plan 06-05).
 *
 * Clones use-hooks-stream.ts structure with script-card semantics (ONE card per run).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body (BLOCKER-1 from 03-04).
 *
 * SSE event contract (mirrors hooks + script routes):
 *   event: stage    { name: string, status: "active"|"done" } — real pipeline stages
 *   event: content  { blocks: ScriptCardBlock[] } — card face (beats+openingBeatSeed+scrollQuote)
 *   event: score    { band, fraction, model } — opener band chip (content-first)
 *   event: followup { text: string } — model-authored follow-up turn
 *   event: done     { count: N }
 *   event: error    { message: string }
 *
 * Content-first pattern (D-02):
 *   1. content event → render card face (beats + openingBeatSeed + scrollQuote)
 *      with placeholder band ("Mixed") until the score event arrives.
 *   2. score event → patch band + fraction on the card.
 *
 * start(ask, platform, anchor?) POSTs to /api/tools/script.
 *   ask — topic or empty; anchor — carries hookLine from hooks→script chain handoff.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HookProof, ScriptCardBlock, ReactionPersona } from '@/lib/tools/blocks';
import { parseProofProp, parseGroundedProp } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IntentLens } from '@/lib/audience/intent-lens';

// ── Partial script card (band/fraction absent until score event) ───────────────

export interface PartialScriptCard {
  beats: ScriptCardBlock['props']['beats'];
  openingBeatSeed: string;
  scrollQuote: string;
  model: 'sim1-flash';
  band?: 'Strong' | 'Mixed' | 'Weak';
  fraction?: string;
  scored: boolean;
  // S3′: opener's real per-persona reactions → named ambient Room cast live, pre-reload (Task B).
  personas?: ReactionPersona[];
  // §11f: the grounded receipt, streamed WITH the face. undefined on ungrounded/unattributed
  // cards (mirrors use-hooks-stream — the stream path must never drop proof).
  proof?: HookProof;
  // Did the RUN have sources, even if this card cited none? Drives the card's <NoSourceNote>.
  // Declared, not merely passed: the live stream is the ONLY path on which the half-attributed
  // grid is visible, so a type that omitted it would let the boundary drop it.
  grounded?: boolean;
}

export interface UseScriptStreamReturn {
  /** Cards streamed in-flight (partial until scored). One card per run (D-02). */
  streamingCards: PartialScriptCard[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string if the stream or route failed. */
  error: string | null;
  /** True once the stream has completed (done event received). */
  isDone: boolean;
  /** Pipeline stages — populated by SSE stage events (STUDIO-01). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event. */
  followupText: string | null;
  /**
   * Start the Script stream.
   * ask: topic/topic-seed or empty; anchor: hookLine from hooks→script handoff (optional).
   */
  start: (ask: string, platform: string, anchor?: string, intent?: IntentLens) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a new run. */
  reset: () => void;
  /**
   * Convert streaming cards to full ScriptCardBlock shapes for rendering.
   * Cards with no score yet use "Mixed" + "–" as interim placeholders.
   */
  toBlocks: () => ScriptCardBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useScriptStream(): UseScriptStreamReturn {
  const [streamingCards, setStreamingCards] = useState<PartialScriptCard[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [stages, setStages] = useState<StageState[]>([]);
  const [followupText, setFollowupText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const cardsRef = useRef<PartialScriptCard[]>([]);
  const stagesRef = useRef<StageState[]>([]);

  const reset = useCallback(() => {
    setStreamingCards([]);
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    setStages([]);
    setFollowupText(null);
    cardsRef.current = [];
    stagesRef.current = [];
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) {
      setIsStreaming(false);
    }
  }, []);

  const start = useCallback(async (ask: string, platform: string, anchor?: string, intent?: IntentLens) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamingCards([]);
    setError(null);
    setIsDone(false);
    setIsStreaming(true);
    setStages([]);
    setFollowupText(null);
    cardsRef.current = [];
    stagesRef.current = [];

    try {
      const body: Record<string, unknown> = { ask, platform };
      if (anchor) body.anchor = anchor;
      if (intent) body.intent = intent;

      const res = await fetch('/api/tools/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Script request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Script request failed');
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
            continue;
          }

          if (eventType === 'stage') {
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

          } else if (eventType === 'followup') {
            const text = typeof data.text === 'string' ? data.text : null;
            if (text && isMountedRef.current) setFollowupText(text);

          } else if (eventType === 'content') {
            // content event: card face with beats+openingBeatSeed+scrollQuote; band/fraction absent
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const cards: PartialScriptCard[] = rawBlocks
              .map((b: unknown) => {
                const block = b as Record<string, unknown>;
                const props = (block.props ?? {}) as Record<string, unknown>;
                const beats = Array.isArray(props.beats)
                  ? (props.beats as Array<{ label?: unknown; content?: unknown; timing?: unknown; retentionMarker?: unknown }>).map((beat) => ({
                      label: String(beat.label ?? ''),
                      content: String(beat.content ?? ''),
                      timing: String(beat.timing ?? ''),
                      retentionMarker: String(beat.retentionMarker ?? ''),
                    }))
                  : [];
                return {
                  beats,
                  openingBeatSeed: String(props.openingBeatSeed ?? ''),
                  scrollQuote: String(props.scrollQuote ?? ''),
                  model: 'sim1-flash' as const,
                  scored: false,
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  proof: parseProofProp(props.proof), // §11f: receipt arrives with the face
                  grounded: parseGroundedProp(props.grounded), // run had sources, even if this card cited none
                };
              })
              .filter((c: PartialScriptCard) => c.beats.length > 0);

            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);

          } else if (eventType === 'score') {
            // score event: patch the card (only one card per run — D-02)
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';

            const patched = cardsRef.current.map((c) =>
              !c.scored ? { ...c, band, fraction, scored: true } : c,
            );
            cardsRef.current = patched;
            if (isMountedRef.current) setStreamingCards([...patched]);

          } else if (eventType === 'done') {
            // S2: unblock the UI on `done` rather than on stream-close. The server emits
            // `done` BEFORE the follow-up chat turn, then keeps the SSE open to stream the
            // followup. Flipping isStreaming here clears the progress checklist + re-enables
            // the composer immediately; the read loop keeps consuming until the server
            // closes the stream, so the followup event still lands and renders inline.
            if (isMountedRef.current) {
              setIsDone(true);
              setIsStreaming(false);
            }

          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Script error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Script stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  const toBlocks = useCallback((): ScriptCardBlock[] => {
    return streamingCards.map((c): ScriptCardBlock => ({
      type: 'script-card',
      props: {
        beats: c.beats,
        openingBeatSeed: c.openingBeatSeed,
        band: c.band ?? 'Mixed',
        fraction: c.fraction ?? '–',
        scrollQuote: c.scrollQuote,
        model: 'sim1-flash',
        personas: c.personas, // S3′: real per-persona reactions → named ambient Room cast (Task B)
        ...(c.proof ? { proof: c.proof } : {}), // §11f: receipt renders live, not just after reload
        // The note renders live too. This object is hand-built field-by-field, so a prop parsed
        // off the wire but not copied HERE is silently dropped on the streaming path — the only
        // path where a half-attributed run is ever seen.
        ...(c.grounded ? { grounded: true } : {}),
      },
    }));
  }, [streamingCards]);

  return {
    streamingCards,
    isStreaming,
    error,
    isDone,
    stages,
    followupText,
    start,
    stop,
    reset,
    toBlocks,
  };
}
