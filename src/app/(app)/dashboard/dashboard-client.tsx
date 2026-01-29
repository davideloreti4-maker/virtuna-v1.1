"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NetworkVisualization,
  FilterPillGroup,
  ContextBar,
  TestTypeSelector,
  ContentForm,
  SurveyForm,
  LoadingPhases,
  ResultsPanel,
  LegendPills,
} from "@/components/app";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import type { TestType } from "@/types/test";
import type { SurveySubmission } from "@/components/app/survey-form";

/**
 * DashboardClient - Client component for dashboard page
 * Handles hydration and test creation flow
 */
export function DashboardClient() {
  const testStore = useTestStore();
  const societyStore = useSocietyStore();

  const {
    currentStatus,
    currentTestType,
    currentResult,
    setStatus,
    setTestType,
    submitTest,
    reset,
  } = testStore;

  const { selectedSocietyId } = societyStore;

  // Hydrate stores on mount
  useEffect(() => {
    if (!testStore._isHydrated) {
      testStore._hydrate();
    }
  }, [testStore]);

  useEffect(() => {
    if (!societyStore._isHydrated) {
      societyStore._hydrate();
    }
  }, [societyStore]);

  // Handlers
  const handleOpenSelector = () => {
    setStatus("selecting-type");
  };

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

  const handleContentSubmit = (content: string) => {
    if (selectedSocietyId) {
      submitTest(content, selectedSocietyId);
    }
  };

  const handleSurveySubmit = (data: SurveySubmission) => {
    if (selectedSocietyId) {
      const content = `Q: ${data.question}\nType: ${data.questionType}${
        data.options ? `\nOptions: ${data.options.join(", ")}` : ""
      }`;
      submitTest(content, selectedSocietyId);
    }
  };

  const handleRunAnother = () => {
    reset();
  };

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Network visualization - always visible in background */}
      <NetworkVisualization className="absolute inset-0 z-0" />

      {/* Top bar with context, filters, and create button - above network */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <ContextBar location="Switzerland" />
        <div className="flex items-center gap-3">
          {/* Legend pills for role level view - hidden on mobile */}
          <LegendPills className="hidden md:flex" />
          <FilterPillGroup />
          <button
            type="button"
            onClick={handleOpenSelector}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2",
              "bg-white text-zinc-900",
              "text-sm font-medium",
              "transition-colors hover:bg-zinc-200"
            )}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create a new test</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
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
              />
            )
          ) : currentStatus === "simulating" ? (
            <LoadingPhases />
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
