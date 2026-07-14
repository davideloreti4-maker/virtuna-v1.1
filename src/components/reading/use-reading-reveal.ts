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
export interface RevealFrame {
  idx: number;
  /** 30-day signed URL minted by the extract route — renderable as-is. */
  uri: string;
}

/**
 * The scraped post: cover, author, views. Lands seconds into the run (the scrape is the first
 * thing the pipeline does), so it is what the in-flight Reading can show while the engine is
 * still working. null in video_upload mode — nothing was scraped, so there is no receipt, and
 * we show none rather than inventing one.
 */
export interface RevealSource {
  cover_url: string | null;
  handle: string | null;
  views: number | null;
  video_url: string | null;
}

/** One of the user's calibrated reactors — the cast, not their reactions. */
export interface RevealPersona {
  archetype: string;
  label: string | null;
}

export interface ReadingRevealState {
  /** The scraped post we are reading — the first evidence of the run. null until it lands. */
  source: RevealSource | null;
  /**
   * WHO is about to watch this: the user's calibrated audience, known before the run starts.
   * Their REACTIONS are what the Read produces — those are not here, and are never guessed.
   */
  roster: RevealPersona[];
  /** Count of personas seen streaming in (Pass-2 audience forming). */
  personaCount: number;
  /**
   * The keyframes themselves, ascending by idx — REAL frames of the user's own video, which
   * is the only honest proof-of-work available while the engine runs.
   *
   * These arrived on the wire all along: `filmstrip_segment_ready` has always carried
   * `keyframe_uri` next to `segment_idx`, and this hook parsed the index, threw the picture
   * away, and kept a count — so the wait rendered the text "7 frames read" instead of the seven
   * frames. Keep the pictures.
   */
  frames: RevealFrame[];
  /** How many frames are coming in total (`filmstrip_plan`); 0 until the grid is seeded. */
  frameTotal: number;
  /** Count of distinct keyframes extracted (the filmstrip filling in). */
  keyframeCount: number;
  /** Live transport phase for the skeleton's copy. */
  phase: 'idle' | 'connecting' | 'live' | 'complete' | 'error';
}

const INITIAL: ReadingRevealState = {
  source: null,
  roster: [],
  personaCount: 0,
  frames: [],
  frameTotal: 0,
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
    setState({ ...INITIAL, phase: 'connecting' });

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

    const onSource = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as RevealSource;
        // Only take a receipt that actually carries something to show.
        if (data && (data.cover_url || data.handle)) {
          setState((s) => ({ ...s, phase: 'live', source: data }));
        }
      } catch {
        /* malformed frame — ignore */
      }
    };

    const onRoster = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { personas?: RevealPersona[] };
        if (Array.isArray(data.personas) && data.personas.length > 0) {
          setState((s) => ({ ...s, phase: 'live', roster: data.personas! }));
        }
      } catch {
        /* malformed frame — ignore */
      }
    };

    const onFilmstripPlan = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { total?: number };
        if (typeof data.total === 'number' && data.total > 0) {
          setState((s) => ({ ...s, phase: 'live', frameTotal: data.total! }));
        }
      } catch {
        /* malformed frame — ignore */
      }
    };

    const onFilmstrip = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          segment_idx?: number;
          keyframe_uri?: string | null;
        };
        if (typeof data.segment_idx !== 'number') return;

        const idx = data.segment_idx;
        const uri = data.keyframe_uri;
        keyframeIdx.current.add(idx);

        setState((s) => {
          // Keep the picture, not just the tally. A frame with no uri is a segment the extractor
          // could not read — it still counts as read (the engine moved past it), but there is
          // nothing to show for it, so it never enters `frames`.
          const frames =
            typeof uri === 'string' && uri.length > 0 && !s.frames.some((f) => f.idx === idx)
              ? [...s.frames, { idx, uri }].sort((a, b) => a.idx - b.idx)
              : s.frames;

          return {
            ...s,
            phase: 'live',
            frames,
            frameTotal: Math.max(s.frameTotal, idx + 1),
            keyframeCount: keyframeIdx.current.size,
          };
        });
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

    es.addEventListener('source', onSource);
    es.addEventListener('roster', onRoster);
    es.addEventListener('partial', onPartial);
    es.addEventListener('filmstrip_plan', onFilmstripPlan);
    es.addEventListener('filmstrip_segment_ready', onFilmstrip);
    es.addEventListener('complete', onComplete);
    es.addEventListener('error', onErr);

    return () => {
      es.removeEventListener('source', onSource);
      es.removeEventListener('roster', onRoster);
      es.removeEventListener('partial', onPartial);
      es.removeEventListener('filmstrip_plan', onFilmstripPlan);
      es.removeEventListener('filmstrip_segment_ready', onFilmstrip);
      es.removeEventListener('complete', onComplete);
      es.removeEventListener('error', onErr);
      es.close();
    };
  }, [id, enabled]);

  return state;
}
