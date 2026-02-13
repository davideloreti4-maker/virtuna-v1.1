"use client";

import { useEffect, useMemo } from "react";
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
import { ContextualTooltip } from "@/components/tooltips/contextual-tooltip";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { useTooltipStore } from "@/stores/tooltip-store";
import type { TestType } from "@/types/test";
import type { SurveySubmission } from "@/components/app/survey-form";

/**
 * DashboardClient - Client component for dashboard page
 * Handles hydration and test creation flow
 */
export function DashboardClient() {
  const testStore = useTestStore();
  const societyStore = useSocietyStore();
  const tooltipStore = useTooltipStore();

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

  useEffect(() => {
    if (!tooltipStore._isHydrated) {
      tooltipStore._hydrate();
    }
  }, [tooltipStore]);

  // Mark onboarding as complete for tooltip visibility
  useEffect(() => {
    if (tooltipStore._isHydrated && !tooltipStore.onboardingComplete) {
      tooltipStore.setOnboardingComplete(true);
    }
  }, [tooltipStore]);

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

  // Stable mock data for hive visualization (seed ensures deterministic layout)
  const hiveData = useMemo(() => generateMockHiveData(), []);

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Top bar with context and filters */}
      <div className="flex items-center justify-between px-6 py-4">
        <ContextualTooltip
          id="test-creation"
          title="Run your first test"
          description="Create a test to see how AI audiences react to your content ideas"
          position="bottom"
        >
          <ContextBar location="Switzerland" />
        </ContextualTooltip>
        <div className="flex items-center gap-3 overflow-x-auto">
          <FilterPillGroup />
        </div>
      </div>

      {/* Hive network visualization background */}
      <div className="absolute inset-0 top-14">
        <ContextualTooltip
          id="hive-viz"
          title="Your AI Society"
          description="This network shows AI personas interacting — watch how they respond to your content"
          position="bottom"
        >
          <HiveCanvas data={hiveData} className="h-full w-full" />
        </ContextualTooltip>
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
