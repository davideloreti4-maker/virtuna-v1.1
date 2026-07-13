"use client";

/**
 * Phase 1 Plan 02 (D-01, D-02, D-03, D-05, D-07, D-08) — SSE consumer hook.
 *
 * Locked D-02 9-key return shape (iter-1):
 *   { start, result, stages, partial, panelReady, phase, error, reconnect, analysisId }
 *
 * Reconnect ladder per D-03:
 *   POST body-reader → on error → single EventSource at /api/analyze/[id]/stream
 *     → on EventSource close without complete → TanStack useQuery polling at
 *     /api/analysis/[id] every 2s, paused on document.hidden, hard ceiling 90s.
 *
 * Pitfall #3: initialData with non-null overall_score short-circuits — never opens stream.
 * Pitfall #6: analysisId surfaced from event:started frame (POST route Plan 02 T3).
 * Pitfall #8: visibilitychange-aware polling gate.
 *
 * Existing useAnalyze hook is NOT modified (D-01 clean separation).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useBoardStore } from "@/stores/board-store";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PredictionResult } from "@/lib/engine/types";
import type { StageEvent } from "@/lib/engine/events";
import { isReadingQuotaExceeded, type ReadingQuotaExceeded } from "@/lib/billing/quota-error";
import {
  PANEL_IDS,
  type PanelId,
  type PanelReadyState,
  panelReadyFromStages,
} from "@/lib/engine/panel-mapping";

// Locked D-02 phase set
export type AnalysisStreamPhase =
  | "idle"
  | "analyzing"
  | "reconnecting"
  | "polling"
  | "complete"
  | "error";

export interface PerPersonaPartial {
  id: string;
  status: "pending" | "streaming" | "complete";
  verdict?: string;
  reasoning?: string;
  // D-15 Phase 3 — streaming partials for Pass 2 timeline reveal
  pass2_status?: "pending" | "streaming" | "complete";
  attentions?: number[];
  swipe_predicted_at?: number;
}

export interface PartialStreamState {
  personas: PerPersonaPartial[];
}

export interface AnalysisStreamInput {
  input_mode: "text" | "tiktok_url" | "video_upload";
  content_text?: string;
  content_type: string;
  tiktok_url?: string;
  video_storage_path?: string;
  society_id?: string;
  niche?: string;
  creator_handle?: string;
  /** Plan 02-03: user intent forwarded into the POST body (mode=remix routes decode+adapt). */
  mode?: "score" | "remix";
  /** Plan 05-01: source remix analysis id forwarded into the POST body for developed-child lineage (D-07). */
  parent_id?: string;
}

/**
 * Permissive shape for the hook's initialData option. Real callers pass either a
 * completed PredictionResult (Pitfall #3 short-circuit) or an in-flight row
 * (`{ id, overall_score: null }`) when permalink-replaying. Kept as an
 * intersection of optional pieces rather than `Partial<PredictionResult>` so that
 * test callers can pass `{ id, overall_score: null }` without `Partial` widening
 * `overall_score` to `number | undefined`.
 */
export type AnalysisStreamInitialData =
  | (Partial<Omit<PredictionResult, "overall_score">> & {
      id?: string;
      overall_score?: number | null;
    })
  | null;

export interface UseAnalysisStreamOptions {
  /** Pitfall #3 — if initialData has overall_score!=null, hook starts in 'complete' and never opens stream. */
  initialData?: AnalysisStreamInitialData;
}

/** @public Type alias for the return type of useAnalysisStream. Consumed by VerdictNode (Plan 5.2, W5 typed import). */
export type AnalysisStream = AnalysisStreamReturn;

export interface AnalysisStreamReturn {
  start: (input: AnalysisStreamInput) => Promise<void>;
  result: PredictionResult | null;
  stages: StageEvent[];
  partial: PartialStreamState;
  panelReady: Record<PanelId, PanelReadyState>;
  phase: AnalysisStreamPhase;
  error: string | null;
  /**
   * Set when the run was refused for a spent allowance (402), NOT when it failed. A quota wall
   * is not an error the user can retry their way out of — it's a paywall, and it carries the
   * numbers needed to say something honest. Null on every other outcome.
   */
  quotaError: ReadingQuotaExceeded | null;
  /** Dismiss the paywall. */
  clearQuotaError: () => void;
  reconnect: () => void;
  // 9th key — D-02 iter-1 lock; surfaced from `event: started` frame (pitfall #6)
  // for /analyze/[id] nav + polling key + P6 permalink replay
  analysisId: string | null;
  /** Live map of segment_idx → signed keyframe URL. Populated by filmstrip_segment_ready SSE events (Phase 4). */
  filmstrips: Record<number, string>;
  /** Fix 3 (05-ux): Cancel an in-flight analysis. Aborts the POST body-reader,
   *  closes any open EventSource, and transitions phase → 'idle'. */
  abort: () => void;
  /** Full state wipe for "New analysis" nav — calls abort() then clears analysisId, result, stages, partial, filmstrips. */
  reset: () => void;
}

function initialPanelReady(): Record<PanelId, PanelReadyState> {
  const out = {} as Record<PanelId, PanelReadyState>;
  for (const id of PANEL_IDS) out[id] = "idle";
  return out;
}

export function useAnalysisStream(opts?: UseAnalysisStreamOptions): AnalysisStreamReturn {
  const queryClient = useQueryClient();

  // Pitfall #3 — completed initialData short-circuits everything.
  const completedFromInitial =
    opts?.initialData && opts.initialData.overall_score != null
      ? (opts.initialData as PredictionResult)
      : null;

  const [phase, setPhase] = useState<AnalysisStreamPhase>(
    completedFromInitial ? "complete" : "idle",
  );
  const [stages, setStages] = useState<StageEvent[]>([]);
  const [partial, setPartial] = useState<PartialStreamState>({ personas: [] });
  const [result, setResult] = useState<PredictionResult | null>(completedFromInitial);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<ReadingQuotaExceeded | null>(null);
  const [filmstrips, setFilmstrips] = useState<Record<number, string>>({});
  const [analysisId, setAnalysisId] = useState<string | null>(
    (opts?.initialData && (opts.initialData as { id?: string }).id) ?? null,
  );

  // Strict-mode reducer (Pitfall #8): one active transport.
  const phaseRef = useRef<AnalysisStreamPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const analysisIdRef = useRef<string | null>(analysisId);
  useEffect(() => {
    analysisIdRef.current = analysisId;
  }, [analysisId]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const panelReady = useMemo(() => {
    if (stages.length === 0 && phase === "complete") {
      // Completed initialData path — mark all 'ready'
      const r = initialPanelReady();
      for (const id of PANEL_IDS) r[id] = "ready";
      return r;
    }
    return panelReadyFromStages(stages);
  }, [stages, phase]);

  // ---- SSE dispatch (shared by POST body-reader + GET EventSource paths) ----
  const dispatch = useCallback((eventType: string, data: unknown) => {
    if (eventType === "started") {
      const id = (data as { id?: string }).id;
      if (id) {
        // Sync the ref immediately: `started` and `complete` can arrive in the
        // same body-reader loop iteration, before the effect that mirrors
        // analysisId → analysisIdRef runs. The `complete` handler below reads
        // the ref to key the shared-cache write.
        analysisIdRef.current = id;
        setAnalysisId(id);
      }
    } else if (eventType === "stage") {
      setStages((prev) => [...prev, data as StageEvent]);
      const ev = data as StageEvent;
      if (ev.type === "stage_start" && ev.stage === "wave_3_personas") {
        // D-08 — seed empty personas array on Wave 3 start; per-persona events fill it.
        setPartial((p) => (p.personas.length ? p : { personas: [] }));
      } else if (ev.type === "pass2_persona_start") {
        setPartial((prev) => {
          const idx = prev.personas.findIndex((p) => p.id === ev.persona_id);
          if (idx === -1) {
            return {
              personas: [
                ...prev.personas,
                { id: ev.persona_id, status: "pending", pass2_status: "streaming" },
              ],
            };
          }
          const next = [...prev.personas];
          next[idx] = { ...next[idx]!, pass2_status: "streaming" };
          return { personas: next };
        });
      } else if (ev.type === "pass2_persona_end") {
        setPartial((prev) => {
          const idx = prev.personas.findIndex((p) => p.id === ev.persona_id);
          const updated = {
            id: ev.persona_id,
            status: (prev.personas[idx]?.status ?? "complete") as
              | "pending"
              | "streaming"
              | "complete",
            verdict: prev.personas[idx]?.verdict,
            reasoning: prev.personas[idx]?.reasoning,
            pass2_status: (ev.ok ? "complete" : "pending") as
              | "pending"
              | "streaming"
              | "complete",
            attentions: ev.attentions,
            swipe_predicted_at: ev.swipe_predicted_at ?? undefined,
          };
          if (idx === -1) return { personas: [...prev.personas, updated] };
          const next = [...prev.personas];
          next[idx] = updated;
          return { personas: next };
        });
      } else if (ev.type === "filmstrip_segment_ready") {
        setFilmstrips((prev) => ({
          ...prev,
          [ev.segment_idx]: ev.keyframe_uri,
        }));
      }
    } else if (eventType === "partial") {
      // Reconnect / fallback path — /api/analyze/[id]/stream emits accumulated
      // partial.personas state on poll deltas. Replace local state authoritatively.
      const personas = (data as { personas?: PerPersonaPartial[] }).personas;
      if (Array.isArray(personas)) {
        setPartial({ personas });
      }
    } else if (eventType === "phase") {
      const ph = (data as { phase?: string }).phase;
      if (ph === "complete") setPhase("complete");
      else if (ph === "error") setPhase("error");
      else if (phaseRef.current === "idle" || phaseRef.current === "analyzing") {
        setPhase("analyzing");
      }
    } else if (eventType === "complete") {
      setResult(data as PredictionResult);
      setPhase("complete");
      // Push the finalized result into the shared detail cache so every OTHER
      // useAnalysisStream instance (Audience/Verdict/Engine/Content/Actions —
      // none of which opened this stream) hydrates instantly. Without this they
      // sit on the null-score placeholder cached at /analyze/[id] nav time
      // (staleTime:Infinity → never refetched) and show "Calculating…"/empty.
      const completeId = analysisIdRef.current;
      if (completeId) {
        queryClient.setQueryData(queryKeys.analysis.detail(completeId), data);
      }
    } else if (eventType === "error") {
      const msg = (data as { error?: string }).error ?? "Unknown error";
      setError(msg);
      setPhase("error");
    }
    // Unknown event types silently ignored (matches useAnalyze backward compat).
  }, [queryClient]);

  // ---- Reconnect: EventSource path on /api/analyze/[id]/stream ----
  // preserve filmstrips across reconnect — segments delivered before drop must persist
  const reconnect = useCallback(() => {
    const id = analysisIdRef.current;
    if (!id) return;
    if (eventSourceRef.current) eventSourceRef.current.close();
    setPhase("reconnecting");

    const es = new EventSource(`/api/analyze/${id}/stream`);
    eventSourceRef.current = es;

    // Per Pitfall #2 — EventSource cannot set headers. Cookie-based Supabase auth
    // attaches automatically because same-origin GET. Last-Event-ID is set by browser
    // on auto-reconnect (we don't manage it).
    es.addEventListener("started", (e) =>
      dispatch("started", JSON.parse((e as MessageEvent).data)),
    );
    es.addEventListener("phase", (e) =>
      dispatch("phase", JSON.parse((e as MessageEvent).data)),
    );
    es.addEventListener("stage", (e) =>
      dispatch("stage", JSON.parse((e as MessageEvent).data)),
    );
    es.addEventListener("complete", (e) => {
      dispatch("complete", JSON.parse((e as MessageEvent).data));
      es.close();
    });
    es.addEventListener("error", () => {
      // Browser-native EventSource auto-retries with Last-Event-ID.
      // After retry fails, readyState === CLOSED — fall back to polling.
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        setPhase("polling");
      }
    });
  }, [dispatch]);

  // ---- POST + body-reader path (verbatim SSE parse loop from useAnalyze 67-99) ----
  const mutation = useMutation({
    mutationFn: async (input: AnalysisStreamInput) => {
      // start() is user-initiated ONLY (the command-bar submit at Board.tsx) —
      // it is never auto-called. So a fresh start always supersedes a permalink
      // hydrated from completed initialData: clear the stale result + id so the
      // new run's `started` event repopulates analysisId. That null→string
      // transition is what fires Board's /analyze/[id] push, which re-keys every
      // read-only node instance to the new analysis. Pitfall #3 ("never auto-open
      // on mount") stays enforced by the initial phase state + start() being
      // user-only — NOT by short-circuiting the POST here, which was silently
      // swallowing every "new analysis" submitted from a completed board.
      setResult(null);
      setAnalysisId(null);
      setPhase("analyzing");
      setStages([]);
      setError(null);
      setQuotaError(null);
      setFilmstrips({});

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed" }));

        // 402 = the allowance is spent. Not a failure — a paywall. Keep the payload (tier,
        // used, limit, inTrial) so the UI can say which wall was hit and what to do about it;
        // throwing the bare slug is how `reading_quota_exceeded` ended up on screen.
        if (res.status === 402 && isReadingQuotaExceeded(err)) {
          setQuotaError(err);
          throw new Error(err.message);
        }

        // Prefer the server's human `message` over the machine slug in `error`.
        throw new Error(err.message ?? err.error ?? "Analysis failed");
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // WR-03: proper SSE frame accumulator — split on double-newline (SSE frame boundary),
        // then extract event:, id:, and data: fields from each frame. The prior line-pair
        // assumption (event: immediately followed by data:) silently dropped frames
        // containing id: prefixes (e.g. the id:complete event from the server).
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const frameLines = frame.split("\n");
          let eventType = "message";
          let dataLine = "";
          for (const fLine of frameLines) {
            if (fLine.startsWith("event: ")) eventType = fLine.slice(7).trim();
            else if (fLine.startsWith("data: ")) dataLine = fLine.slice(6);
            // id: lines are intentionally skipped — browser EventSource manages Last-Event-ID
          }
          if (dataLine) {
            try {
              const data = JSON.parse(dataLine);
              dispatch(eventType, data);
            } catch {
              // Malformed JSON — silently drop frame.
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis.history() });
      // Reconcile the shared detail cache to the canonical server row. Covers
      // the case where the POST body-reader finished without a `complete` frame
      // (the dispatch setQueryData above never ran). invalidateQueries refetches
      // even with staleTime:Infinity, replacing the null-score placeholder.
      const id = analysisIdRef.current;
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.analysis.detail(id) });
      }
    },
    onError: (err: Error) => {
      // Intentional abort (component unmounted / navigated away mid-stream): the
      // POST was cancelled on purpose. Do NOT reconnect — a reconnect here spawns
      // a rogue EventSource on the unmounting component and the rejection surfaces
      // as an unhandled error during the navigation commit (WSOD). Just bail.
      if (abortRef.current?.signal.aborted || err.name === "AbortError") {
        return;
      }
      // If we have an analysisId, try GET-stream reconnect (D-03 single retry).
      if (analysisIdRef.current && phaseRef.current !== "reconnecting") {
        reconnect();
      } else {
        setError(err.message);
        setPhase("error");
      }
    },
  });

  // ---- Polling fallback: TanStack useQuery against /api/analysis/[id] ----
  // Pitfall #8 — visibilitychange-aware via document.hidden gate.
  const [pollEnabled, setPollEnabled] = useState(false);
  useEffect(() => {
    setPollEnabled(phase === "polling");
  }, [phase]);

  const pollQuery = useQuery({
    queryKey: queryKeys.analysis.detail(analysisId ?? ""),
    queryFn: async () => {
      const res = await fetch(`/api/analysis/${analysisId}`);
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return res.json() as Promise<PredictionResult & { overall_score: number | null }>;
    },
    enabled: pollEnabled && !!analysisId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    // Live-poll completion gate — only runs when phase === "polling" (pollEnabled is true).
    // Does NOT run on a fresh remix permalink reload: remix rows start phase "idle"
    // (completedFromInitial at line 127 keys on overall_score != null, which is null for
    // remix rows), so pollEnabled is false. Permalink-reload hydration for remix rows is
    // handled at the frame level by Phase 3's dual-read (DecodeShellNode ~181-189).
    const d = pollQuery.data;
    const isScoreComplete = d?.overall_score != null;
    const isRemixComplete =
      (d as { variants?: { remix?: unknown } } | undefined)?.variants?.remix != null;
    if (isScoreComplete || isRemixComplete) {
      setResult(d as PredictionResult);
      setPhase("complete");
      // Sibling instances hydrate off the shared detail cache on the polling path too.
      if (analysisId) {
        queryClient.setQueryData(queryKeys.analysis.detail(analysisId), d);
      }
    }
  }, [pollQuery.data, analysisId, queryClient]);

  // Lift polling ceiling from 90s → 360s to accommodate developed-child full pipeline
  // runs (D-13). Developed children run the full ~90-332s prediction pipeline; the old
  // 90s ceiling caused false-timeouts on long analyses.
  const POLLING_CEILING_MS = 360_000;
  useEffect(() => {
    if (phase !== "polling") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "polling") {
        setError("Stream timed out — analysis still running");
        setPhase("error");
      }
    }, POLLING_CEILING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Visibility-change pause/resume (Pitfall #8)
  useEffect(() => {
    const onVis = () => {
      if (phaseRef.current !== "polling") return;
      setPollEnabled(!document.hidden);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      abortRef.current?.abort();
    };
  }, []);

  // Pitfall #3 extension — permalink replay hydration.
  //
  // /analyze/[id] direct-nav: every <useAnalysisStream/> caller (Board,
  // VerdictNode, ActionsNode, ContentAnalysisFrame, EngineGroup, AudienceNode)
  // mounts independently with no shared context. Without this effect, only the
  // caller that received `initialData` would hydrate — the rest stay idle and
  // sit on "Calculating…" forever.
  //
  // Strategy: regardless of opts, also subscribe to the
  // `queryKeys.analysis.detail(urlAnalysisId)` cache. The first caller (Board)
  // populates that cache via TanStack useQuery; every other caller piggybacks
  // off the same cache entry. When a row with overall_score!=null is present
  // and phase==='idle', short-circuit to phase='complete'.
  const routeParams = useParams();
  const urlAnalysisId =
    routeParams && typeof (routeParams as { id?: unknown }).id === "string"
      ? ((routeParams as { id: string }).id)
      : null;
  const permalinkQuery = useQuery({
    queryKey: queryKeys.analysis.detail(urlAnalysisId ?? ""),
    queryFn: async () => {
      const r = await fetch(`/api/analysis/${urlAnalysisId}`);
      if (!r.ok) throw new Error(`Failed to load analysis ${urlAnalysisId}`);
      return r.json() as Promise<PredictionResult & { overall_score: number | null }>;
    },
    enabled: !!urlAnalysisId,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

  const initialFromOpts = opts?.initialData;
  const initialOptsScore = initialFromOpts?.overall_score;
  const initialOptsId =
    initialFromOpts && (initialFromOpts as { id?: string }).id;

  const permalinkRow = permalinkQuery.data ?? null;
  const permalinkScore = permalinkRow?.overall_score ?? null;

  useEffect(() => {
    if (phaseRef.current !== "idle") return;
    if (initialFromOpts && initialOptsScore != null) {
      setResult(initialFromOpts as PredictionResult);
      if (initialOptsId) setAnalysisId(initialOptsId);
      setPhase("complete");
      return;
    }
    if (permalinkRow && permalinkScore != null) {
      setResult(permalinkRow as PredictionResult);
      if (urlAnalysisId) setAnalysisId(urlAnalysisId);
      setPhase("complete");
      return;
    }
    // Resume-on-mount for an IN-FLIGHT child (Develop & Predict handoff, D-07/D-13).
    // Develop's stream is owned by AdaptFrameBody, which unmounts on navigate-to-child
    // — so the board that lands on /analyze/[child] has no live POST reader. The row is
    // a null-score placeholder (engine_version:'pending') whose pipeline is still running
    // server-side. Flip this instance to 'polling' so the existing pollQuery converges on
    // the score (then the completion effect at ~420 hydrates + broadcasts to siblings).
    // Gate on mode!=='remix': remix decode rows are also null-score+pending but are owned
    // by Phase 3's DecodeShellNode dual-read, NOT by polling.
    if (permalinkRow && permalinkScore == null) {
      const row = permalinkRow as {
        engine_version?: string | null;
        mode?: string | null;
        variants?: { remix?: unknown } | null;
      };
      const isInFlightScore =
        row.engine_version === "pending" &&
        row.mode !== "remix" &&
        row.variants?.remix == null;
      if (isInFlightScore && urlAnalysisId) {
        setAnalysisId(urlAnalysisId);
        setPhase("polling");
      }
    }
  }, [
    initialFromOpts,
    initialOptsId,
    initialOptsScore,
    permalinkRow,
    permalinkScore,
    urlAnalysisId,
  ]);

  // "New analysis" reset — applies to EVERY hook instance, not just Board.
  //
  // The board mounts independent useAnalysisStream callers (Board, AudienceNode,
  // VerdictNode, ActionsNode, ContentAnalysisFrame, EngineGroup) inside a
  // persistent analyze/layout.tsx — none of them remount on /analyze ↔
  // /analyze/[id] nav. Board's explicit stream.reset() only clears Board's
  // instance; the node instances each hold their own completed `result` and
  // would keep rendering the old analysis. This wipe runs in every instance.
  const wipeToIdle = useCallback(() => {
    abortRef.current?.abort();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setAnalysisId(null);
    setResult(null);
    setStages([]);
    setPartial({ personas: [] });
    setFilmstrips({});
    setError(null);
    setPhase("idle");
  }, []);

  // Primary trigger: the board store's newAnalysisSignal, bumped by
  // triggerNewAnalysis() on every "New analysis" click. This is URL-independent
  // — a freshly-completed analysis sets the URL via history.replaceState (which
  // bypasses Next's router, so useParams never reports the id), so the route
  // transition below can't be relied on for the run→complete→New-analysis flow.
  const newAnalysisSignal = useBoardStore((s) => s.newAnalysisSignal);
  const prevSignalRef = useRef(newAnalysisSignal);
  useEffect(() => {
    if (prevSignalRef.current !== newAnalysisSignal) {
      prevSignalRef.current = newAnalysisSignal;
      wipeToIdle();
    }
  }, [newAnalysisSignal, wipeToIdle]);

  // Secondary trigger: route leaves a permalink (/analyze/[id] → /analyze base),
  // e.g. browser back button without clicking the CTA. Guard on phase so an
  // in-flight run (urlAnalysisId=null, phase 'analyzing') is never wiped.
  const prevUrlAnalysisIdRef = useRef(urlAnalysisId);
  useEffect(() => {
    const prev = prevUrlAnalysisIdRef.current;
    prevUrlAnalysisIdRef.current = urlAnalysisId;
    if (prev !== null && urlAnalysisId === null) {
      const ph = phaseRef.current;
      if (ph === "complete" || ph === "error" || ph === "idle") {
        wipeToIdle();
      }
    }
  }, [urlAnalysisId, wipeToIdle]);

  const start = useCallback(
    async (input: AnalysisStreamInput) => {
      await mutation.mutateAsync(input);
    },
    [mutation],
  );

  // Fix 3 (05-ux): abort() — cancels the in-flight POST body-reader and/or EventSource,
  // then resets phase to 'idle'. Safe to call when phase is already 'idle' or 'complete'.
  const abort = useCallback(() => {
    abortRef.current?.abort();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setPhase("idle");
    setError(null);
  }, []);

  // reset() — full state wipe for "New analysis" nav. Calls abort() then clears
  // all accumulated stream state so the board renders a blank slate.
  const reset = useCallback(() => {
    abort();
    setAnalysisId(null);
    setResult(null);
    setStages([]);
    setPartial({ personas: [] });
    setFilmstrips({});
  }, [abort]);

  const clearQuotaError = useCallback(() => setQuotaError(null), []);

  return { start, result, stages, partial, panelReady, phase, error, quotaError, clearQuotaError, reconnect, analysisId, filmstrips, abort, reset };
}
