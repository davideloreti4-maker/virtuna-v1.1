'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useReadingReveal — store-free liveness source for the Phase-4 stage-reveal
 * skeleton (REVEAL-01). While a Simulation is still processing, the Reading shows
 * a branded skeleton; this hook subscribes to the REAL signals that survive the
 * /home → /analyze/[id] navigation and surfaces them so the skeleton can fill in
 * as work lands — no fake stage labels, only what the engine actually emits.
 *
 * SOURCE: the reconnect SSE route GET /api/analyze/[id]/stream (the SAME route
 * useAnalysisStream's reconnect ladder uses). On an in-flight row it short-polls
 * the DB and emits `partial` (the accumulated Pass-2 persona array) and
 * `filmstrip_segment_ready` (per keyframe) deltas, then `complete`. The frozen
 * engine never emits per-stage `stage_start`/`stage_end` to a reconnecting client
 * (those live only on the POST body-reader the composer owns and aborts on nav),
 * so these two deltas + `complete` are the honest live signals available here.
 *
 * STORE-FREE (milestone invariant): the reading cluster never imports
 * useBoardStore. useAnalysisStream does (board-store coupled) — so this is a
 * deliberately minimal, self-contained EventSource consumer, NOT that hook.
 *
 * DEGRADES CLEANLY: if the engine writes no mid-flight partial/filmstrip rows,
 * the stream emits only `complete` and the counts stay 0 — the skeleton simply
 * reads as a calm "Reading your simulation…" until the real Reading swaps in.
 * No throw on a closed/absent EventSource (guarded for SSR + jsdom).
 */
export interface ReadingRevealState {
  /** Count of personas seen streaming in (Pass-2 audience forming). */
  personaCount: number;
  /** Count of distinct keyframes extracted (the filmstrip filling in). */
  keyframeCount: number;
  /** Live transport phase for the skeleton's copy. */
  phase: 'idle' | 'connecting' | 'live' | 'complete' | 'error';
}

const INITIAL: ReadingRevealState = {
  personaCount: 0,
  keyframeCount: 0,
  phase: 'idle',
};

export function useReadingReveal(
  id: string | null,
  enabled: boolean,
): ReadingRevealState {
  const [state, setState] = useState<ReadingRevealState>(INITIAL);
  const keyframeIdx = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Only subscribe while genuinely in-flight with a real id, and only where
    // EventSource exists (guards SSR + the jsdom test env without a mock).
    if (!enabled || !id || typeof EventSource === 'undefined') {
      return;
    }

    keyframeIdx.current = new Set();
    setState({ personaCount: 0, keyframeCount: 0, phase: 'connecting' });

    let es: EventSource;
    try {
      es = new EventSource(`/api/analyze/${id}/stream`);
    } catch {
      // Construction can throw in non-browser/relative-URL envs — degrade to the
      // calm default skeleton (no liveness, no crash).
      setState((s) => ({ ...s, phase: 'idle' }));
      return;
    }

    const onPartial = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { personas?: unknown[] };
        const n = Array.isArray(data.personas) ? data.personas.length : 0;
        setState((s) => ({
          ...s,
          phase: 'live',
          personaCount: Math.max(s.personaCount, n),
        }));
      } catch {
        /* malformed frame — ignore */
      }
    };

    const onFilmstrip = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { segment_idx?: number };
        if (typeof data.segment_idx === 'number') {
          keyframeIdx.current.add(data.segment_idx);
        }
        setState((s) => ({
          ...s,
          phase: 'live',
          keyframeCount: keyframeIdx.current.size,
        }));
      } catch {
        /* malformed frame — ignore */
      }
    };

    const onComplete = () => {
      setState((s) => ({ ...s, phase: 'complete' }));
      es.close();
    };

    const onErr = () => {
      // EventSource auto-retries; only treat a CLOSED socket as terminal so a
      // transient blip doesn't flip the skeleton to an error read.
      if (es.readyState === EventSource.CLOSED) {
        setState((s) => ({ ...s, phase: 'error' }));
      }
    };

    es.addEventListener('partial', onPartial);
    es.addEventListener('filmstrip_segment_ready', onFilmstrip);
    es.addEventListener('complete', onComplete);
    es.addEventListener('error', onErr);

    return () => {
      es.removeEventListener('partial', onPartial);
      es.removeEventListener('filmstrip_segment_ready', onFilmstrip);
      es.removeEventListener('complete', onComplete);
      es.removeEventListener('error', onErr);
      es.close();
    };
  }, [id, enabled]);

  return state;
}
