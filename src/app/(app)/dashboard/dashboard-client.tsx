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
import { ContextualTooltip } from "@/components/tooltips/contextual-tooltip";
import { createClient } from "@/lib/supabase/client";
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
        <div className="absolute bottom-6 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-6">
          {currentStatus === "filling-form" ? (
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
