'use client';

/**
 * useIdeasStream — SSE consumer for POST /api/tools/ideas (Plan 04, Task 2; updated Plan 05-04, Task 3).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body. This matches use-expert-chat.ts
 * (RESEARCH Pattern 3, BLOCKER-1).
 *
 * SSE event contract (Plan 05-04 additions in CAPS):
 *   event: STAGE   { name: string, status: "active"|"done" } — real pipeline stages (STUDIO-01)
 *   event: status  { message: string }       — "Generating ideas…" / "Scoring…"
 *   event: content { blocks: PartialCard[] } — card faces WITH scrollQuote (WARNING-4)
 *     NOTE: content event omits band/fraction — those arrive via score events.
 *   event: score   { seedHook, band, fraction, model } — per-card, fills band chip
 *   event: FOLLOWUP { text: string } — model-authored follow-up turn (D-03)
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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HookProof, IdeaCardBlock, PopulationAggregateBlock, ReactionPersona, CardTarget } from '@/lib/tools/blocks';
import { parseProofProp, parseGroundedProp, parseTargetProp, parsePopulationProp } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IntentLens } from '@/lib/audience/intent-lens';

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
  // S3′: real per-persona reactions → named ambient Room cast live, pre-reload (Task B).
  personas?: ReactionPersona[];
  // §11f: the grounded receipt, streamed WITH the face. undefined on ungrounded/unattributed
  // cards (mirrors use-hooks-stream — the stream path must never drop proof).
  proof?: HookProof;
  // Did the RUN have sources, even if this card cited none? Drives the card's <NoSourceNote>.
  // Must be declared here, not merely passed: the live stream is the ONLY path on which the
  // half-attributed grid is visible, so a type that omits it would let the boundary drop it.
  grounded?: boolean;
  // PER-PERSONA GENERATION: WHO this idea was written for + how that person reacted. Same rule as
  // `grounded` above, and it is not a hypothetical — the identical prop was being dropped by the
  // hooks SSE emit (#298), so the target line could only ever appear AFTER a reload, never on the
  // live stream, which is the only path a user actually watches.
  target?: CardTarget;
  // AUDIENCE SIM v2 (Stage 2): the N-individual population projection → the Population·1,000 Sheet.
  // undefined on General/uncalibrated/uncharacterized runs. Same reload-only hazard as proof:
  // declared + parsed + carried through toBlocks so it renders live, not only after a reload.
  population?: PopulationAggregateBlock;
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
  /** Pipeline stages — populated by SSE stage events (STUDIO-01 / Plan 05-04). Ephemeral: shown during streaming. */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event (D-03 / Plan 05-04). */
  followupText: string | null;
  /**
   * Start the Ideas stream. Call from the composer Idea send.
   * ask: empty string → Auto mode; non-empty → seeded mode.
   * Re-exposed as the retry entry point for the skill-run error state (W2).
   */
  start: (ask: string, platform: string, intent?: IntentLens) => Promise<void>;
  /**
   * Start a scoped refine re-run via /api/tools/refine (Plan 05-05 / D-04).
   * Consumes the refine SSE into the same streaming state as start() so the new
   * freshly-SIM-scored card renders inline with its own band chip. A failed refine
   * surfaces through this hook's error state → the Plan-04 SkillRunError surface.
   * NEVER called on render — only on explicit user send (D-05).
   */
  startRefine: (body: { skill: 'idea'; instruction: string; anchor: string; cardRef?: number; platform?: string }) => Promise<void>;
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
  // Plan 05-04 additions: stage checklist + model follow-up text (STUDIO-01/02)
  const [stages, setStages] = useState<StageState[]>([]);
  const [followupText, setFollowupText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

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

  // Keep a ref copy of streamingCards so score events can patch without stale closure
  const cardsRef = useRef<PartialIdeaCard[]>([]);
  // Ref copy of stages so the upsert can patch without stale closure
  const stagesRef = useRef<StageState[]>([]);

  const reset = useCallback(() => {
    setStreamingCards([]);
    setStatusMessage(null);
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

  const start = useCallback(async (ask: string, platform: string, intent?: IntentLens) => {
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
    setStages([]);
    setFollowupText(null);
    cardsRef.current = [];
    stagesRef.current = [];

    try {
      // CRITICAL: fetch + getReader, NOT EventSource (POST needs a body — BLOCKER-1).
      const res = await fetch('/api/tools/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ask, platform, ...(intent ? { intent } : {}) }),
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

          if (eventType === 'stage') {
            // Upsert stage by name — preserve order of first appearance (STUDIO-01)
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
            // Model-authored follow-up turn (D-03)
            const text = typeof data.text === 'string' ? data.text : null;
            if (text && isMountedRef.current) setFollowupText(text);

          } else if (eventType === 'status') {
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
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  proof: parseProofProp(props.proof), // §11f: receipt arrives with the face
                  grounded: parseGroundedProp(props.grounded), // run had sources, even if this card cited none
                  target: parseTargetProp(props.target), // who this idea was written for + how they reacted
                  population: parsePopulationProp(props.population), // Sim v2: N-individual projection → Population·1,000 Sheet
                };
              })
              .filter((c: PartialIdeaCard) => c.title.length > 0);

            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);

          } else if (eventType === 'score') {
            // score event: patch the matching card (match by seedHook)
            // WR-04: mirror the correct logic from startRefine and use-hooks-stream.
            // The previous code used `|| !c.scored` in the hadMatch branch, which
            // stamped one band onto ALL unscored cards when there was a seedHook match.
            const scoreSeedHook = typeof data.seedHook === 'string' ? data.seedHook : '';
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';

            const hadMatch = cardsRef.current.some((c) => c.seedHook === scoreSeedHook);
            let patched: PartialIdeaCard[];
            if (hadMatch) {
              // Only patch the specific matching card that hasn't been scored yet
              patched = cardsRef.current.map((c) =>
                c.seedHook === scoreSeedHook && !c.scored
                  ? { ...c, band, fraction, scored: true }
                  : c,
              );
            } else {
              // No seedHook match — apply to first unscored card (order fallback)
              let applied = false;
              patched = cardsRef.current.map((c) => {
                if (!c.scored && !applied) { applied = true; return { ...c, band, fraction, scored: true }; }
                return c;
              });
            }
            cardsRef.current = patched;
            if (isMountedRef.current) setStreamingCards([...patched]);

          } else if (eventType === 'done') {
            // S2: unblock the UI on `done` rather than on stream-close. The server now
            // emits `done` BEFORE the follow-up chat turn, then keeps the SSE open to
            // stream the followup. Flipping isStreaming here clears the progress checklist
            // + re-enables the composer immediately; the read loop below keeps consuming
            // until the server closes the stream, so the followup event still lands and
            // renders inline (gated on followupText && !isStreaming).
            if (isMountedRef.current) {
              setIsDone(true);
              setStatusMessage(null);
              setIsStreaming(false);
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
   * Scoped refine re-run (Plan 05-05 / D-04).
   * POSTs to /api/tools/refine and consumes the SSE into the same streaming state.
   * A failed refine sets error → the Plan-04 SkillRunError surface renders for retry.
   * NEVER called on render — only on explicit user send (D-05).
   */
  const startRefine = useCallback(async (
    body: { skill: 'idea'; instruction: string; anchor: string; cardRef?: number; platform?: string },
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamingCards([]);
    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsStreaming(true);
    setStages([]);
    setFollowupText(null);
    cardsRef.current = [];
    stagesRef.current = [];

    try {
      const res = await fetch('/api/tools/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Refine request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Refine request failed');
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
                  needsTake: typeof props.needsTake === 'boolean' ? props.needsTake : false,
                  topic: String(props.topic ?? ''),
                  take: String(props.take ?? ''),
                  format: props.format === null ? null : (props.format ? String(props.format) : null),
                  scrollQuote: String(props.scrollQuote ?? ''),
                  model: 'sim1-flash' as const,
                  scored: false,
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  proof: parseProofProp(props.proof), // §11f: receipt arrives with the face
                  grounded: parseGroundedProp(props.grounded), // run had sources, even if this card cited none
                  target: parseTargetProp(props.target), // who this idea was written for + how they reacted
                  population: parsePopulationProp(props.population), // Sim v2: N-individual projection → Population·1,000 Sheet
                };
              })
              .filter((c: PartialIdeaCard) => c.title.length > 0);
            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);
          } else if (eventType === 'score') {
            const scoreSeedHook = typeof data.seedHook === 'string' ? data.seedHook : '';
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';
            const hadMatch = cardsRef.current.some((c) => c.seedHook === scoreSeedHook);
            let patched: PartialIdeaCard[];
            if (hadMatch) {
              patched = cardsRef.current.map((c) =>
                c.seedHook === scoreSeedHook && !c.scored
                  ? { ...c, band, fraction, scored: true }
                  : c,
              );
            } else {
              let applied = false;
              patched = cardsRef.current.map((c) => {
                if (!c.scored && !applied) { applied = true; return { ...c, band, fraction, scored: true }; }
                return c;
              });
            }
            cardsRef.current = patched;
            if (isMountedRef.current) setStreamingCards([...patched]);
          } else if (eventType === 'done') {
            // S2: unblock the UI on `done` rather than on stream-close. The server now
            // emits `done` BEFORE the follow-up chat turn, then keeps the SSE open to
            // stream the followup. Flipping isStreaming here clears the progress checklist
            // + re-enables the composer immediately; the read loop below keeps consuming
            // until the server closes the stream, so the followup event still lands and
            // renders inline (gated on followupText && !isStreaming).
            if (isMountedRef.current) {
              setIsDone(true);
              setStatusMessage(null);
              setIsStreaming(false);
            }
          } else if (eventType === 'error') {
            const msg = typeof data.message === 'string' ? data.message : 'Refine error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Refine stream error');
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
        scored: c.scored ?? false, // A4: drives ProofUnit's pending→scored treatment
        scrollQuote: c.scrollQuote,
        model: 'sim1-flash',
        personas: c.personas, // S3′: real per-persona reactions → named ambient Room cast (Task B)
        ...(c.proof ? { proof: c.proof } : {}), // §11f: receipt renders live, not just after reload
        // The note renders live too. This object is hand-built field-by-field, so a prop that is
        // parsed off the wire but not copied HERE is silently dropped on the streaming path —
        // and the streaming path is the only one where the half-attributed grid is ever seen.
        ...(c.grounded ? { grounded: true } : {}),
        // Same trap, same line: the target must be copied here or it renders only after a reload.
        ...(c.target ? { target: c.target } : {}),
        // Sim v2 Stage 2 — the population projection renders live in the Sheet, not just after reload.
        ...(c.population ? { population: c.population } : {}),
      },
    }));
  }, [streamingCards]);

  return {
    streamingCards,
    statusMessage,
    isStreaming,
    error,
    isDone,
    stages,
    followupText,
    start,
    startRefine,
    stop,
    reset,
    toBlocks,
  };
}
