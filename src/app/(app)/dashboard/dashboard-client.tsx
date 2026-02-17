"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  FilterPillGroup,
  ContextBar,
  TestTypeSelector,
  ContentForm,
  LoadingPhases,
  ResultsPanel,
} from "@/components/app";
import type { ContentFormData } from "@/components/app";
import { HiveCanvas } from "@/components/hive/HiveCanvas";
import { generateMockHiveData } from "@/components/hive/hive-mock-data";
import { useTestStore } from "@/stores/test-store";
import type { SimulationPhase } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { useAnalyze } from "@/hooks/queries";
import type { TestType } from "@/types/test";

const MINIMUM_THEATER_MS = 4500;

/**
 * DashboardClient - Client component for dashboard page
 * Handles hydration and test creation flow.
 *
 * Analysis submission is powered by the useAnalyze() TanStack Query mutation,
 * which handles SSE streaming and phase tracking. The Zustand test-store
 * manages only the UI flow state (currentStatus, currentTestType, reset).
 *
 * v2: Passes PredictionResult directly to ResultsPanel (no TestResult shim).
 */
export function DashboardClient() {
  const {
    currentStatus,
    setStatus,
    setTestType,
    reset,
    _isHydrated,
    _hydrate,
  } = useTestStore();

  const { selectedSocietyId, _isHydrated: societyHydrated, _hydrate: hydratesSociety } = useSocietyStore();

  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url");

  const analyzeMutation = useAnalyze();
  const isCancelledRef = useRef(false);

  // Hydrate stores on mount
  useEffect(() => {
    if (!_isHydrated) {
      _hydrate();
    }
  }, [_isHydrated, _hydrate]);

  useEffect(() => {
    if (!societyHydrated) {
      hydratesSociety();
    }
  }, [societyHydrated, hydratesSociety]);

  // Auto-start flow when URL param is present (e.g., from trending video analyze button)
  useEffect(() => {
    if (urlParam && currentStatus === "idle") {
      setTestType("tiktok-script" as TestType);
      setStatus("filling-form");
    }
  }, [urlParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleCloseSelector = () => {
    setStatus("idle");
    setTestType(null);
  };

  const handleSelectType = (type: TestType) => {
    setTestType(type);
    setStatus("filling-form");
  };

  const handleContentSubmit = (data: ContentFormData) => {
    if (!selectedSocietyId) return;

    const theatreStart = Date.now();
    isCancelledRef.current = false;
    setStatus("simulating");

    // Build v2 AnalysisInput payload
    const payload: Record<string, unknown> = {
      input_mode: data.input_mode,
      content_type: "video",
      society_id: selectedSocietyId,
    };

    if (data.input_mode === "text") {
      payload.content_text = data.caption;
      if (data.niche) payload.niche = data.niche;
    } else if (data.input_mode === "tiktok_url") {
      payload.tiktok_url = data.tiktok_url;
    } else if (data.input_mode === "video_upload") {
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

  const handleRunAnother = () => {
    reset();
    analyzeMutation.reset();
  };

  // Intentional: Hive visualization uses procedural data for the interactive demo canvas.
  // Will wire to real analysis data when the hive feature moves beyond demo stage.
  const hiveData = useMemo(() => generateMockHiveData(), []);

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Top bar with context and filters */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <ContextBar location="Switzerland" />
        <div className="flex items-center gap-3">
          <FilterPillGroup />
        </div>
      </div>

      {/* Hive network visualization background — bleeds behind sidebar + top bar for glass effect */}
      <div className="absolute inset-0 md:-ml-[var(--sidebar-offset,0px)] md:w-[calc(100%+var(--sidebar-offset,0px))]">
        <HiveCanvas data={hiveData} className="h-full w-full" />
      </div>

      {/* Floating content area at bottom center - above network */}
      {(currentStatus === "idle" ||
        currentStatus === "filling-form" ||
        currentStatus === "simulating" ||
        currentStatus === "viewing-results") && (
        <div className="absolute bottom-6 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-6">
          {(currentStatus === "idle" || currentStatus === "filling-form") ? (
            <ContentForm
              onSubmit={handleContentSubmit}
            />
          ) : currentStatus === "simulating" ? (
            <LoadingPhases
              simulationPhase={analyzeMutation.phase as SimulationPhase | null}
              phaseMessage={analyzeMutation.phaseMessage}
              onCancel={() => {
                isCancelledRef.current = true;
                setStatus("filling-form");
                analyzeMutation.reset();
              }}
            />
          ) : currentStatus === "viewing-results" && analyzeMutation.data ? (
            <ResultsPanel
              result={analyzeMutation.data}
              onRunAnother={handleRunAnother}
            />
          ) : null}
        </div>
      )}

      {/* Test Type Selector Modal */}
      <TestTypeSelector
        open={currentStatus === "selecting-type"}
        onOpenChange={(open) => {
          if (!open) handleCloseSelector();
        }}
        onSelectType={handleSelectType}
      />

      {/* Accessible heading - hidden visually */}
      <h1 className="sr-only">Dashboard</h1>
    </div>
  );
}
