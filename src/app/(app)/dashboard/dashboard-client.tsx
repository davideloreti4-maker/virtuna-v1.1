"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FilterPillGroup,
  ContextBar,
  TestTypeSelector,
  ContentForm,
  SurveyForm,
  LoadingPhases,
  ResultsPanel,
} from "@/components/app";
import { HiveCanvas } from "@/components/hive/HiveCanvas";
import { generateMockHiveData } from "@/components/hive/hive-mock-data";
import { useTestStore, mapPredictionToTestResult } from "@/stores/test-store";
import type { SimulationPhase } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { useAnalyze } from "@/hooks/queries";
import type { TestType } from "@/types/test";
import type { SurveySubmission } from "@/components/app/survey-form";

const MINIMUM_THEATER_MS = 4500;

/**
 * DashboardClient - Client component for dashboard page
 * Handles hydration and test creation flow.
 *
 * Analysis submission is powered by the useAnalyze() TanStack Query mutation,
 * which handles SSE streaming and phase tracking. The Zustand test-store
 * manages only the UI flow state (currentStatus, currentTestType, reset).
 */
export function DashboardClient() {
  const {
    currentStatus,
    currentTestType,
    setStatus,
    setTestType,
    setCurrentResult,
    reset,
    _isHydrated,
    _hydrate,
  } = useTestStore();

  const { selectedSocietyId, _isHydrated: societyHydrated, _hydrate: hydratesSociety } = useSocietyStore();

  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url");

  const analyzeMutation = useAnalyze();
  const isCancelledRef = useRef(false);

  // Track submitted content for result mapping
  const [submittedContent, setSubmittedContent] = useState("");

  // Derive TestResult from mutation data for backward-compatible display
  const currentResult = useMemo(() => {
    if (!analyzeMutation.data || !currentTestType) return null;
    return mapPredictionToTestResult(
      analyzeMutation.data,
      submittedContent,
      currentTestType,
      selectedSocietyId ?? ""
    );
  }, [analyzeMutation.data, currentTestType, selectedSocietyId, submittedContent]);

  // Sync derived result to store for components that still read it
  useEffect(() => {
    setCurrentResult(currentResult);
  }, [currentResult, setCurrentResult]);

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

  const handleChangeType = () => {
    setStatus("selecting-type");
  };

  const contentTypeMap: Record<string, string> = {
    "tiktok-script": "video",
    "instagram-post": "reel",
    "x-post": "post",
    "linkedin-post": "post",
    "email-subject-line": "post",
    "email": "post",
    "article": "post",
    "website-content": "post",
    "advertisement": "post",
    "product-proposition": "post",
    "survey": "post",
  };

  const handleContentSubmit = (content: string) => {
    if (!selectedSocietyId || !currentTestType) return;

    const theatreStart = Date.now();
    isCancelledRef.current = false;
    setSubmittedContent(content);
    setStatus("simulating");

    analyzeMutation.mutate(
      {
        content_text: content,
        content_type: contentTypeMap[currentTestType] ?? "post",
        society_id: selectedSocietyId,
      },
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

  const handleSurveySubmit = (data: SurveySubmission) => {
    if (!selectedSocietyId || !currentTestType) return;

    const theatreStart = Date.now();
    isCancelledRef.current = false;
    const content = `Q: ${data.question}\nType: ${data.questionType}${
      data.options ? `\nOptions: ${data.options.join(", ")}` : ""
    }`;
    setSubmittedContent(content);
    setStatus("simulating");

    analyzeMutation.mutate(
      {
        content_text: content,
        content_type: contentTypeMap[currentTestType] ?? "post",
        society_id: selectedSocietyId,
      },
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
    setSubmittedContent("");
  };

  // Stable mock data for hive visualization (seed ensures deterministic layout)
  const hiveData = useMemo(() => generateMockHiveData(), []);

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Top bar with context and filters */}
      <div className="flex items-center justify-between px-6 py-4">
        <ContextBar location="Switzerland" />
        <div className="flex items-center gap-3">
          <FilterPillGroup />
        </div>
      </div>

      {/* Hive network visualization background */}
      <div className="absolute inset-0 top-14">
        <HiveCanvas data={hiveData} className="h-full w-full" />
      </div>

      {/* Floating content area at bottom center - above network */}
      {(currentStatus === "filling-form" ||
        currentStatus === "simulating" ||
        currentStatus === "viewing-results") && (
        <div className="absolute bottom-6 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-6">
          {currentStatus === "filling-form" && currentTestType ? (
            currentTestType === "survey" ? (
              <SurveyForm
                onChangeType={handleChangeType}
                onSubmit={handleSurveySubmit}
              />
            ) : (
              <ContentForm
                testType={currentTestType}
                onChangeType={handleChangeType}
                onSubmit={handleContentSubmit}
                initialContent={urlParam ?? undefined}
              />
            )
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
          ) : currentStatus === "viewing-results" && currentResult ? (
            <ResultsPanel
              result={currentResult}
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
