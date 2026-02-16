"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
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

  // Fetch user profile: onboarding status + primary goal
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);

  useEffect(() => {
    if (!tooltipStore._isHydrated) return;

    async function fetchProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("onboarding_completed_at, primary_goal")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed_at && !tooltipStore.onboardingComplete) {
        tooltipStore.setOnboardingComplete(true);
      }

      if (profile?.primary_goal) {
        setPrimaryGoal(profile.primary_goal as string);
      }
    }

    fetchProfile();
  }, [tooltipStore._isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Map goal to context bar location text
  const goalLocationMap: Record<string, string> = {
    monetization: "Monetization Focus",
    viral_content: "Viral Content Focus",
    affiliate_revenue: "Affiliate Revenue Focus",
  };
  const contextLocation = primaryGoal ? goalLocationMap[primaryGoal] ?? "Switzerland" : "Switzerland";

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
          <ContextBar location={contextLocation} />
        </ContextualTooltip>
        <ContextualTooltip
          id="settings"
          title="Filter your view"
          description="Use these filters to focus on the content categories that matter most to you"
          position="bottom"
        >
          <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
            <FilterPillGroup />
          </div>
        </ContextualTooltip>
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
        <div className="absolute bottom-6 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-6 max-h-[70vh] overflow-y-auto">
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
