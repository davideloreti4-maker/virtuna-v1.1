'use client';

/**
 * useHooksStream — SSE consumer for POST /api/tools/hooks (Plan 04-03, Task 1; updated Plan 05-04, Task 3).
 *
 * CRITICAL: uses fetch + res.body.getReader() (NOT EventSource).
 * EventSource is GET-only and cannot POST a body (BLOCKER-1 from 03-04).
 *
 * SSE event contract (Plan 05-04 additions in CAPS):
 *   event: STAGE   { name: string, status: "active"|"done" } — real pipeline stages (STUDIO-01)
 *   event: status  { message: string }       — "Generating hooks…" / "Scoring on your audience…"
 *   event: content { blocks: PartialHookCard[] } — card faces WITH scrollQuote (content-first)
 *     NOTE: content event omits band/fraction — those arrive via score events.
 *   event: score   { seedHook, rank, band, fraction, model } — per-card, fills band chip
 *   event: FOLLOWUP { text: string } — model-authored follow-up turn (D-03)
 *   event: done    { count: N }
 *   event: error   { message: string }
 *
 * Content-first pattern (D-02/D-08):
 *   1. Content event → render card faces (hookLine, audienceArchetype, rank, scrollQuote)
 *      with a placeholder band ("Mixed") until the score event arrives.
 *   2. Score events → patch the matching card's band + fraction (matched by seedHook).
 *   3. The final card (after scoring) is a complete HookCardBlock prop shape.
 *
 * Clones use-ideas-stream.ts; new fields: audienceArchetype + rank on the partial card
 * (from 04-02's content event). Match 04-01 HookCardBlock prop names exactly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportCredit402 } from '@/lib/billing/credit-wall';
import type { HookCardBlock, CardTarget, HookProof, PopulationAggregateBlock, ReactionPersona } from '@/lib/tools/blocks';
import { parseProofProp, parseGroundedProp, parseTargetProp, parsePopulationProp } from '@/lib/tools/blocks';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IntentLens } from '@/lib/audience/intent-lens';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Card as it arrives in the content event (band/fraction absent — filled by score events). */
export interface PartialHookCard {
  hookLine: string;
  audienceArchetype: string;   // D-03 audience tag (from deriveAudienceArchetype)
  mechanism: string;
  seedHook: string;
  rank: number;                // D-01: integer >= 1, set by runner (rank order = array order)
  scrollQuote: string;
  channel: string | null;
  model: 'sim1-flash';
  // band/fraction: present after the matching score event; undefined until then
  band?: 'Strong' | 'Mixed' | 'Weak';
  fraction?: string;
  scored: boolean;
  // S3′: the card's real per-persona reactions (registry-enum archetypes) — threaded so the
  // ambient Room shows the NAMED People cast live, before the thread reloads (The Room, Task B).
  personas?: ReactionPersona[];
  // §11f: the grounded receipt, streamed WITH the face. undefined on ungrounded/unattributed
  // cards. Before this field the streaming path silently DROPPED proof — receipts only
  // appeared after a reload (caught in the 2026-07-12 flag-ON live verify).
  proof?: HookProof;
  // Did the RUN have sources, even if this card cited none? Drives the card's <NoSourceNote>.
  // Declared, not merely passed: the live stream is the ONLY path on which the half-attributed
  // grid is visible, so a type that omitted it would let the boundary drop it.
  grounded?: boolean;
  // PER-PERSONA GENERATION: the named reader this hook was written for + that reader's own SIM
  // reaction. undefined on General/uncalibrated runs, and on a calibrated run whose writer named
  // nobody we assigned. This is THE field that shows the user the audience model did work, so it
  // is exactly the one whose silent loss would be invisible — five touchpoints, all of them.
  target?: CardTarget;
  // AUDIENCE SIM v2 (Stage 2): the N-individual population projection → the Population·1,000 Sheet.
  // undefined on General/uncalibrated/uncharacterized runs. Same reload-only hazard as proof/target:
  // declared + parsed + carried through toBlocks so it renders live, not only after a reload.
  population?: PopulationAggregateBlock;
}

export interface UseHooksStreamReturn {
  /** Cards streamed in-flight (partial until scored). Empty when idle/complete. */
  streamingCards: PartialHookCard[];
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
   * Run-level degrade notices from the `warning` SSE event — e.g. grounding fell back to
   * ungrounded. Empty on a clean run.
   *
   * ⚠️ This event was emitted by the route and consumed by NOBODY until 2026-07-17: every
   * warning the pipeline ever raised streamed into the void, so a degrade was indistinguishable
   * from a clean run at the glass. The route-side test asserted the event was SENT; nothing
   * asserted it was received. Wire it, don't just type it.
   */
  warnings: string[];
  /**
   * True when the server signalled (via the `outliers` SSE event) that a live scrape could find
   * proven outliers this run couldn't. Drives the "Find new outliers" affordance. Cleared at the
   * start of every run; stays false on a clean grounded run or a platform that can't be scraped.
   */
  outliersAvailable: boolean;
  /**
   * Start the Hooks stream. Call from the composer Hook send.
   * ask: empty string → Auto mode (anchored idea); non-empty → seeded mode (D-09).
   * Re-expose as the retry entry point for the skill-run error state (W2).
   *
   * opts.allowScrape authorizes a live outlier scrape for THIS run (explicit spend) — set only by
   * findOutliers(), never by a normal send.
   */
  start: (ask: string, platform: string, intent?: IntentLens, opts?: { allowScrape?: boolean }) => Promise<void>;
  /**
   * Re-run the LAST hooks send with a live outlier scrape authorized (allowScrape: true). This is
   * the "Find new outliers" action — a deliberate spend that scrapes fresh proven outliers on the
   * same subject and write-throughs them into the cache (so the next normal run is grounded free).
   * No-op if nothing has been run yet.
   */
  findOutliers: () => Promise<void>;
  /**
   * Start a scoped refine re-run via /api/tools/refine (Plan 05-05 / D-04).
   * Consumes the refine SSE into the same streaming state as start() so the new
   * freshly-SIM-scored card renders inline with its own band chip. A failed refine
   * surfaces through this hook's error state → the Plan-04 SkillRunError surface.
   * NEVER called on render — only called on an explicit user send (D-05).
   */
  startRefine: (body: { skill: 'hooks'; instruction: string; anchor: string; cardRef?: number; platform?: string }) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a new run. */
  reset: () => void;
  /**
   * Convert streaming cards to full HookCardBlock shapes for rendering via
   * HookCardRenderer. Cards with no score yet use "Mixed" + "" as placeholders.
   */
  toBlocks: () => HookCardBlock[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHooksStream(): UseHooksStreamReturn {
  const [streamingCards, setStreamingCards] = useState<PartialHookCard[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  // Plan 05-04 additions: stage checklist + model follow-up text (STUDIO-01/02)
  const [stages, setStages] = useState<StageState[]>([]);
  const [followupText, setFollowupText] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [outliersAvailable, setOutliersAvailable] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  // The last normal send's args, so findOutliers() can replay the SAME subject with a scrape
  // authorized. Captured on every start(); the scrape query is derived from the ask, so replaying
  // "" (Auto) would scrape on the niche only — we must re-send the real ask/platform/intent.
  const lastRunRef = useRef<{ ask: string; platform: string; intent?: IntentLens } | null>(null);

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
  const cardsRef = useRef<PartialHookCard[]>([]);
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
    setWarnings([]);
    setOutliersAvailable(false);
    cardsRef.current = [];
    stagesRef.current = [];
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) {
      setIsStreaming(false);
    }
  }, []);

  const start = useCallback(async (
    ask: string,
    platform: string,
    intent?: IntentLens,
    opts?: { allowScrape?: boolean },
  ) => {
    // Abort any prior in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Remember this send so findOutliers() can replay the SAME subject with a scrape authorized.
    // The allowScrape flag itself is NOT stored — each findOutliers() sets it explicitly, so a
    // stored scrape authorization can never leak into a later normal run.
    lastRunRef.current = { ask, platform, intent };

    // Reset state for a new run
    setStreamingCards([]);
    setStatusMessage(null);
    setError(null);
    setIsDone(false);
    setIsStreaming(true);
    setStages([]);
    setFollowupText(null);
    setWarnings([]);
    setOutliersAvailable(false);
    cardsRef.current = [];
    stagesRef.current = [];

    try {
      // CRITICAL: fetch + getReader, NOT EventSource (POST needs a body — BLOCKER-1).
      const res = await fetch('/api/tools/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // allowScrape rides the body ONLY when explicitly authorized (findOutliers) — a normal send
        // omits it, so the route's `body.allowScrape === true` check keeps the scrape off by default.
        body: JSON.stringify({
          ask,
          platform,
          ...(intent ? { intent } : {}),
          ...(opts?.allowScrape ? { allowScrape: true } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Hooks request failed' }));
        if (reportCredit402(res.status, err)) {
          // The wall dialog is up (CreditWallListener); surface the human sentence, not the slug.
          throw new Error(err.message);
        }
        throw new Error((err as { error?: string }).error ?? 'Hooks request failed');
      }
      if (!res.body) throw new Error('No response body');

      // ── SSE body reader (mirrors use-ideas-stream.ts SSE loop) ──────────────
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
                // Update status for the matching stage
                updated = stagesRef.current.map((s) =>
                  s.name === stageName ? { ...s, status: stageStatus } : s,
                );
              } else {
                // First time we see this stage — append it
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

          } else if (eventType === 'warning') {
            // Run-level degrade notices. The route has sent these since grounding shipped; this
            // branch is what finally reads them (see UseHooksStreamReturn.warnings).
            const list = Array.isArray(data.warnings)
              ? data.warnings.filter((w: unknown): w is string => typeof w === 'string')
              : [];
            if (list.length > 0 && isMountedRef.current) setWarnings(list);

          } else if (eventType === 'outliers') {
            // The server says a live scrape could find proven outliers this run couldn't. Flip the
            // flag that drives the "Find new outliers" affordance. Only ever true here — the server
            // is the sole authority on whether a scrape would actually do anything.
            if (data.available === true && isMountedRef.current) setOutliersAvailable(true);

          } else if (eventType === 'content') {
            // content event: hook faces WITH scrollQuote; band/fraction absent until score
            const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
            const cards: PartialHookCard[] = rawBlocks
              .map((b: unknown) => {
                const block = b as Record<string, unknown>;
                const props = (block.props ?? {}) as Record<string, unknown>;
                return {
                  hookLine: String(props.hookLine ?? ''),
                  audienceArchetype: String(props.audienceArchetype ?? ''),
                  mechanism: String(props.mechanism ?? ''),
                  seedHook: String(props.seedHook ?? ''),
                  rank: typeof props.rank === 'number' ? props.rank : 0,
                  scrollQuote: String(props.scrollQuote ?? ''),
                  channel: props.channel === null ? null : (props.channel ? String(props.channel) : null),
                  model: 'sim1-flash' as const,
                  scored: false,
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  proof: parseProofProp(props.proof), // §11f: receipt arrives with the face
                  grounded: parseGroundedProp(props.grounded), // run had sources, even if this card cited none
                  target: parseTargetProp(props.target), // who this hook was written for + how they reacted
                  population: parsePopulationProp(props.population), // Sim v2: N-individual projection → Population·1,000 Sheet
                };
              })
              .filter((c: PartialHookCard) => c.hookLine.length > 0);

            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);

          } else if (eventType === 'score') {
            // score event: patch the matching card (match by seedHook; fallback to rank)
            const scoreSeedHook = typeof data.seedHook === 'string' ? data.seedHook : '';
            const scoreRank = typeof data.rank === 'number' ? data.rank : -1;
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';

            const hadMatch = cardsRef.current.some(
              (c) => c.seedHook === scoreSeedHook || c.rank === scoreRank,
            );

            let patched: PartialHookCard[];
            if (hadMatch) {
              patched = cardsRef.current.map((c) =>
                (c.seedHook === scoreSeedHook || c.rank === scoreRank) && !c.scored
                  ? { ...c, band, fraction, scored: true }
                  : c,
              );
            } else {
              // Fallback: apply to first unscored card (order fallback)
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
            const msg = typeof data.message === 'string' ? data.message : 'Hooks error';
            throw new Error(msg);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Hooks stream error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
      }
    }
  }, []);

  /**
   * "Find new outliers" — replay the last send with a live scrape authorized (explicit spend).
   * Delegates to start() so the whole streaming path (reset, cards, score, done, and a FRESH
   * outliers signal) is identical; the only difference is allowScrape: true, which lets the route
   * scrape → write-through the cache → ground this run. No-op before the first run.
   */
  const findOutliers = useCallback(async () => {
    const last = lastRunRef.current;
    if (!last) return;
    await start(last.ask, last.platform, last.intent, { allowScrape: true });
  }, [start]);

  /**
   * Scoped refine re-run (Plan 05-05 / D-04).
   * POSTs to /api/tools/refine and consumes the SSE into the same streaming state.
   * A failed refine sets error → the Plan-04 SkillRunError surface renders for retry.
   * NEVER called on render — only on explicit user send (D-05).
   */
  const startRefine = useCallback(async (
    body: { skill: 'hooks'; instruction: string; anchor: string; cardRef?: number; platform?: string },
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
    setWarnings([]);
    setOutliersAvailable(false);
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
        if (reportCredit402(res.status, err)) {
          // The wall dialog is up (CreditWallListener); surface the human sentence, not the slug.
          throw new Error(err.message);
        }
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
            const cards: PartialHookCard[] = rawBlocks
              .map((b: unknown) => {
                const block = b as Record<string, unknown>;
                const props = (block.props ?? {}) as Record<string, unknown>;
                return {
                  hookLine: String(props.hookLine ?? ''),
                  audienceArchetype: String(props.audienceArchetype ?? ''),
                  mechanism: String(props.mechanism ?? ''),
                  seedHook: String(props.seedHook ?? ''),
                  rank: typeof props.rank === 'number' ? props.rank : 0,
                  scrollQuote: String(props.scrollQuote ?? ''),
                  channel: props.channel === null ? null : (props.channel ? String(props.channel) : null),
                  model: 'sim1-flash' as const,
                  scored: false,
                  personas: Array.isArray(props.personas)
                    ? (props.personas as ReactionPersona[])
                    : undefined,
                  proof: parseProofProp(props.proof), // §11f: receipt arrives with the face
                  grounded: parseGroundedProp(props.grounded), // run had sources, even if this card cited none
                  target: parseTargetProp(props.target), // who this hook was written for + how they reacted
                  population: parsePopulationProp(props.population), // Sim v2: N-individual projection → Population·1,000 Sheet
                };
              })
              .filter((c: PartialHookCard) => c.hookLine.length > 0);
            cardsRef.current = cards;
            if (isMountedRef.current) setStreamingCards([...cards]);
          } else if (eventType === 'score') {
            const scoreSeedHook = typeof data.seedHook === 'string' ? data.seedHook : '';
            const scoreRank = typeof data.rank === 'number' ? data.rank : -1;
            const band = (['Strong', 'Mixed', 'Weak'] as const).find((b) => b === data.band) ?? 'Mixed';
            const fraction = typeof data.fraction === 'string' ? data.fraction : '';
            const hadMatch = cardsRef.current.some(
              (c) => c.seedHook === scoreSeedHook || c.rank === scoreRank,
            );
            let patched: PartialHookCard[];
            if (hadMatch) {
              patched = cardsRef.current.map((c) =>
                (c.seedHook === scoreSeedHook || c.rank === scoreRank) && !c.scored
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
   * Convert partial streaming cards to full HookCardBlock shapes.
   * Cards with no band yet use "Mixed" + "–" as interim placeholders.
   * Rendered in RANK order (array is already ranked by the runner — 04-02).
   */
  const toBlocks = useCallback((): HookCardBlock[] => {
    return streamingCards.map((c): HookCardBlock => ({
      type: 'hook-card',
      props: {
        hookLine: c.hookLine,
        audienceArchetype: c.audienceArchetype,
        mechanism: c.mechanism,
        seedHook: c.seedHook,
        rank: c.rank,
        band: c.band ?? 'Mixed',
        fraction: c.fraction ?? '–',
        scored: c.scored ?? false, // A4: drives ProofUnit's pending→scored treatment
        scrollQuote: c.scrollQuote,
        model: 'sim1-flash',
        channel: c.channel,
        personas: c.personas, // S3′: real per-persona reactions → named ambient Room cast (Task B)
        ...(c.proof ? { proof: c.proof } : {}), // §11f: receipt renders live, not just after reload
        // The note renders live too. This object is hand-built field-by-field, so a prop parsed
        // off the wire but not copied HERE is silently dropped on the streaming path — the only
        // path where a half-attributed run is ever seen.
        ...(c.grounded ? { grounded: true } : {}),
        // Same hazard, same fix: the target line is the ONLY visible evidence that the audience
        // model steered anything, and the live stream is where the user watches for it.
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
    warnings,
    outliersAvailable,
    start,
    findOutliers,
    startRefine,
    stop,
    reset,
    toBlocks,
  };
}
