"use client";

import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { useAnalyze } from "@/hooks/queries";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { ContentForm } from "./content-form";
import type { ContentFormData } from "./content-form";
import { ResultsPanel } from "./simulation/results-panel";

const MINIMUM_THEATER_MS = 4500;

interface TestCreationFlowProps {
  triggerButton: ReactNode;
  className?: string;
}

/**
 * TestCreationFlow orchestrator (v2)
 *
 * Simplified flow: trigger -> form -> simulating -> results.
 * No type selector step -- the content form handles input modes via tabs.
 * Wired to useAnalyze() mutation for SSE streaming analysis with v2 AnalysisInput payload.
 *
 * v2: Passes PredictionResult directly to ResultsPanel (no TestResult shim).
 */
export function TestCreationFlow({ triggerButton, className }: TestCreationFlowProps) {
  const {
    currentStatus,
    setStatus,
    setTestType,
    reset,
  } = useTestStore();
  const { selectedSocietyId, _isHydrated: societyHydrated, _hydrate: hydrateSociety } = useSocietyStore();
  const analyzeMutation = useAnalyze();
  const isCancelledRef = useRef(false);

  // Hydrate society store on mount (needed when rendered outside dashboard)
  useEffect(() => {
    if (!societyHydrated) hydrateSociety();
  }, [societyHydrated, hydrateSociety]);

  // Handle trigger button click -- go directly to form (skip type selector)
  const handleTriggerClick = () => {
    setTestType("tiktok-script");
    setStatus("filling-form");
  };

  // Handle form submission with v2 ContentFormData
  const handleContentSubmit = (data: ContentFormData) => {
    if (!selectedSocietyId) return;

    const theatreStart = Date.now();
    isCancelledRef.current = false;
    setStatus("simulating");

    // Build v2 AnalysisInput payload
    const payload: Record<string, unknown> = {
      input_mode: data.input_mode,
      content_type: "video", // TikTok content is always video type
      society_id: selectedSocietyId,
    };

    if (data.input_mode === "text") {
      payload.content_text = data.caption;
      if (data.niche) payload.niche = data.niche;
    } else if (data.input_mode === "tiktok_url") {
      payload.tiktok_url = data.tiktok_url;
    } else if (data.input_mode === "video_upload") {
      // For now, set video_storage_path to empty -- actual Supabase upload is Phase 8+
      payload.video_storage_path = "pending-upload";
      payload.content_text = data.video_caption;
      if (data.video_niche) payload.niche = data.video_niche;
    }

    analyzeMutation.mutate(
      payload as Parameters<typeof analyzeMutation.mutate>[0],
      {
        onSuccess: async () => {
          const elapsed = Date.now() - theatreStart;
          const remaining = MINIMUM_THEATER_MS - elapsed;
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
          if (!isCancelledRef.current) {
            setStatus("viewing-results");
          }
        },
        onError: () => setStatus("filling-form"),
      }
    );
  };

  // Handle "run another test"
  const handleRunAnother = () => {
    reset();
    analyzeMutation.reset();
  };

  // Render based on current status
  if (currentStatus === "idle") {
    return (
      <div className={className} onClick={handleTriggerClick}>
        {triggerButton}
      </div>
    );
  }

  if (currentStatus === "filling-form" || currentStatus === "selecting-type") {
    return (
      <div className={cn("w-full max-w-2xl mx-auto p-6", className)}>
        <ContentForm onSubmit={handleContentSubmit} />
      </div>
    );
  }

  if (currentStatus === "simulating") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)}>
        <Spinner size="lg" />
        <Text size="sm" muted>Simulating response...</Text>
      </div>
    );
  }

  if (currentStatus === "viewing-results" && analyzeMutation.data) {
    return (
      <div className={cn("w-full max-w-md mx-auto", className)}>
        <ResultsPanel
          result={analyzeMutation.data}
          onRunAnother={handleRunAnother}
        />
      </div>
    );
  }

  // Fallback: render trigger button
  return (
    <div className={className} onClick={handleTriggerClick}>
      {triggerButton}
    </div>
  );
}
