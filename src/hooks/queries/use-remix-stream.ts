'use client';

/**
 * useRemixStream — SSE consumer for POST /api/tools/remix/run (Plan 06-05).
 *
 * Clones use-hooks-stream.ts structure with remix-card semantics (ONE card per run).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body (BLOCKER-1 from 03-04).
 *
 * SSE event contract (mirrors remix/run route from 06-04):
 *   event: stage    { name: string, status: "active"|"done" } — Resolving/Decoding/Adapting/Simulating
 *   event: content  { blocks: RemixCardBlock[] } — card face (adaptedHook+sourceDecode+scrollQuote)
 *   event: score    { band, fraction, model } — adapted-hook band chip (content-first)
 *   event: followup { text: string } — model-authored follow-up turn
 *   event: done     { count: N }
 *   event: error    { message: string }
 *
 * Content-first pattern (D-02):
 *   1. content event → render card face with placeholder band ("Mixed") until score event.
 *   2. score event → patch band + fraction on the card.
 *
 * start(url, platform) POSTs to /api/tools/remix/run.
 *   url — a trending/competitor TikTok URL to decode + adapt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportCredit402 } from '@/lib/billing/credit-wall';
import type { RemixCardBlock, PopulationAggregateBlock, ReactionPersona } from '@/lib/tools/blocks';
import { parsePopulationProp } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IntentLens } from '@/lib/audience/intent-lens';

// ── Partial remix card (band/fraction absent until score event) ────────────────

export interface PartialRemixCard {
  adaptedHook: string;
  angle: string;
  whoItsFor: string;
  formatBorrowed: string;
  sourceDecode: {
    hookPattern: string;
    structure: string;
    theTurn: string;
    emotionalBeat: string;
  };
  scrollQuote: string;
  model: 'sim1-flash';
  band?: 'Strong' | 'Mixed' | 'Weak';
  fraction?: string;
  scored: boolean;
  // S3′: adapted hook's real per-persona reactions → named ambient Room cast live, pre-reload (Task B).
  personas?: ReactionPersona[];
  // AUDIENCE SIM v2 (Stage 2): the adapted hook's N-individual population projection → Population·
  // 1,000 Sheet. undefined on General/uncalibrated/uncharacterized runs. Declared + parsed +
  // carried through toBlocks so it renders live, not only after a reload (the reload-only hazard).
  population?: PopulationAggregateBlock;
  // READY TO FILM (owner 2026-07-22): the shoot plan for YOUR adapted version. undefined when the
  // adapt model returned none. Same reload-only hazard — carried through toBlocks so it renders live.
  production?: RemixCardBlock['props']['production'];
}

/**
 * Parse a raw `production` prop off the SSE face into a validated shoot-plan, or undefined. Mirrors
 * the runner's coercion: shots+onScreenText+setup are required together (partial → dropped whole);
 * edit optional. Keeps the live remix card honest — no fabricated shoot plan from a malformed payload.
 */
function parseProductionProp(raw: unknown): RemixCardBlock['props']['production'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v : undefined;
  const shots = str(p.shots);
  const onScreenText = str(p.onScreenText);
  const setup = str(p.setup);
  if (!shots || !onScreenText || !setup) return undefined;
  const edit = str(p.edit);
  return { shots, onScreenText, setup, ...(edit ? { edit } : {}) };
}

export interface UseRemixStreamReturn {
  /** Cards streamed in-flight (partial until scored). One card per run (D-02). */
  streamingCards: PartialRemixCard[];
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
   * Start the Remix stream.
   * url: a trending/competitor TikTok URL to decode + adapt.
   */
  start: (url: string, platform: string, intent?: IntentLens) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a new run. */
  reset: () => void;
  /**
   * Convert streaming cards to full RemixCardBlock shapes for rendering.
   * Cards with no score yet use "Mixed" + "–" as interim placeholders.
   */
  toBlocks: () => RemixCardBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useRemixStream(): UseRemixStreamReturn {
  const [streamingCards, setStreamingCards] = useState<PartialRemixCard[]>([]);
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

  const cardsRef = useRef<PartialRemixCard[]>([]);
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

  const start = useCallback(async (url: string, platform: string, intent?: IntentLens) => {
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
      const res = await fetch('/api/tools/remix/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, platform, ...(intent ? { intent } : {}) }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Remix request failed' }));
        if (reportCredit402(res.status, err)) {
          // The wall dialog is up (CreditWallListener); surface the human sentence, not the slug.
          throw new Error(err.message);
        }
        throw new Error((err as { error?: string }).error ?? 'Remix request failed');
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
            // content event: card face; band/fraction absent until score event
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const cards: PartialRemixCard[] = rawBlocks
              .map((b: unknown) => {
                const block = b as Record<string, unknown>;
                const props = (block.props ?? {}) as Record<string, unknown>;
                const sourceDecode = (props.sourceDecode ?? {}) as Record<string, unknown>;
                return {
                  adaptedHook: String(props.adaptedHook ?? ''),
                  angle: String(props.angle ?? ''),
                  whoItsFor: String(props.whoItsFor ?? ''),
                  formatBorrowed: String(props.formatBorrowed ?? ''),
                  sourceDecode: {
                    hookPattern: String(sourceDecode.hookPattern ?? ''),
                    structure: String(sourceDecode.structure ?? ''),
                    theTurn: String(sourceDecode.theTurn ?? ''),
                    emotionalBeat: String(sourceDecode.emotionalBeat ?? ''),
                  },
                  scrollQuote: String(props.scrollQuote ?? ''),
                  model: 'sim1-flash' as const,
                  scored: false,
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  population: parsePopulationProp(props.population), // Sim v2: adapted-hook projection → Population·1,000 Sheet
                  production: parseProductionProp(props.production), // owner 2026-07-22: YOUR-version shoot plan renders live, not reload-only
                };
              })
              .filter((c: PartialRemixCard) => c.adaptedHook.length > 0);

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
            if (isMountedRef.current) {
              setIsDone(true);
            }

          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Remix error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Remix stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  const toBlocks = useCallback((): RemixCardBlock[] => {
    return streamingCards.map((c): RemixCardBlock => ({
      type: 'remix-card',
      props: {
        adaptedHook: c.adaptedHook,
        angle: c.angle,
        whoItsFor: c.whoItsFor,
        formatBorrowed: c.formatBorrowed,
        sourceDecode: c.sourceDecode,
        band: c.band ?? 'Mixed',
        fraction: c.fraction ?? '–',
        scrollQuote: c.scrollQuote,
        model: 'sim1-flash',
        personas: c.personas, // S3′: real per-persona reactions → named ambient Room cast (Task B)
        // Sim v2 Stage 2 — the adapted-hook projection renders live in the Sheet, not just after reload.
        ...(c.population ? { population: c.population } : {}),
        // Ready-to-film (owner 2026-07-22) — the YOUR-version shoot plan renders live, not reload-only.
        ...(c.production ? { production: c.production } : {}),
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
