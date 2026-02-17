"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PredictionResult } from "@/lib/engine/types";
import { useState, useCallback } from "react";

type AnalysisPhase =
  | "idle"
  | "analyzing"
  | "reasoning"
  | "scoring"
  | "complete"
  | "error";

interface SSEPhaseEvent {
  phase: AnalysisPhase;
  message: string;
}

/**
 * QUERY-07: Mutation hook for content analysis with SSE streaming
 *
 * v2: Updated phase names (analyzing/reasoning/scoring) and input type
 * to match AnalysisInput schema.
 */
export function useAnalyze() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");

  const reset = useCallback(() => {
    setPhase("idle");
    setPhaseMessage("");
  }, []);

  const mutation = useMutation({
    mutationFn: async (input: {
      input_mode: "text" | "tiktok_url" | "video_upload";
      content_text?: string;
      content_type: string;
      tiktok_url?: string;
      video_storage_path?: string;
      society_id?: string;
      niche?: string;
      creator_handle?: string;
    }) => {
      setPhase("analyzing");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error ?? "Analysis failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result: PredictionResult | null = null;
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

            // Next line should be data:
            const dataLine = lines[i + 1];
            if (dataLine?.startsWith("data: ")) {
              const data = JSON.parse(dataLine.slice(6));

              if (eventType === "phase") {
                const phaseEvent = data as SSEPhaseEvent;
                setPhase(phaseEvent.phase);
                setPhaseMessage(phaseEvent.message);
              } else if (eventType === "complete") {
                result = data as PredictionResult;
                setPhase("complete");
              } else if (eventType === "error") {
                setPhase("error");
                throw new Error(data.error);
              }
            }
          }
        }
      }

      if (!result) throw new Error("No result received");
      return result;
    },
    onSuccess: () => {
      // QUERY-10: Invalidate analysis history after new analysis
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis.history() });
    },
    onError: () => {
      setPhase("error");
    },
  });

  return { ...mutation, phase, phaseMessage, reset };
}

/**
 * QUERY-06: Analysis history query
 */
export function useAnalysisHistory() {
  return useQuery({
    queryKey: queryKeys.analysis.history(),
    queryFn: async () => {
      const res = await fetch("/api/analysis/history");
      if (!res.ok) throw new Error("Failed to fetch analysis history");
      return res.json();
    },
  });
}
