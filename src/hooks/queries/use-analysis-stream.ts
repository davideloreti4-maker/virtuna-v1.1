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
import { queryKeys } from "@/lib/queries/query-keys";
import type { PredictionResult } from "@/lib/engine/types";
import type { StageEvent } from "@/lib/engine/events";
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

export interface AnalysisStreamReturn {
  start: (input: AnalysisStreamInput) => Promise<void>;
  result: PredictionResult | null;
  stages: StageEvent[];
  partial: PartialStreamState;
  panelReady: Record<PanelId, PanelReadyState>;
  phase: AnalysisStreamPhase;
  error: string | null;
  reconnect: () => void;
  // 9th key — D-02 iter-1 lock; surfaced from `event: started` frame (pitfall #6)
  // for /analyze/[id] nav + polling key + P6 permalink replay
  analysisId: string | null;
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
      if (id) setAnalysisId(id);
    } else if (eventType === "stage") {
      setStages((prev) => [...prev, data as StageEvent]);
      const ev = data as StageEvent;
      if (ev.type === "stage_start" && ev.stage === "wave_3_personas") {
        // D-08 — seed empty personas array on Wave 3 start; per-persona events fill it.
        setPartial((p) => (p.personas.length ? p : { personas: [] }));
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
    } else if (eventType === "error") {
      const msg = (data as { error?: string }).error ?? "Unknown error";
      setError(msg);
      setPhase("error");
    }
    // Unknown event types silently ignored (matches useAnalyze backward compat).
  }, []);

  // ---- Reconnect: EventSource path on /api/analyze/[id]/stream ----
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
      if (completedFromInitial) return; // Pitfall #3 — never re-open
      setPhase("analyzing");
      setStages([]);
      setError(null);

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
        throw new Error(err.error ?? "Analysis failed");
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7).trim();
            const dataLine = lines[i + 1];
            if (dataLine?.startsWith("data: ")) {
              try {
                const data = JSON.parse(dataLine.slice(6));
                dispatch(eventType, data);
              } catch {
                // Malformed JSON — silently drop frame.
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis.history() });
    },
    onError: (err: Error) => {
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
    if (pollQuery.data?.overall_score != null) {
      setResult(pollQuery.data as PredictionResult);
      setPhase("complete");
    }
  }, [pollQuery.data]);

  // 90s ceiling on polling
  useEffect(() => {
    if (phase !== "polling") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "polling") {
        setError("Stream timed out — analysis still running");
        setPhase("error");
      }
    }, 90_000);
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

  const start = useCallback(
    async (input: AnalysisStreamInput) => {
      await mutation.mutateAsync(input);
    },
    [mutation],
  );

  return { start, result, stages, partial, panelReady, phase, error, reconnect, analysisId };
}
