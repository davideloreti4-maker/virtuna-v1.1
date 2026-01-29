"use client";

import { useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NetworkVisualization,
  FilterPillGroup,
  ContextBar,
  TestTypeSelector,
  ContentForm,
  SurveyForm,
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

  // Determine what to show in main content area
  const showNetworkViz = currentStatus === "idle" || currentStatus === "selecting-type";

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Top bar with context, filters, and create button */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <ContextBar location="Switzerland" />
        <div className="flex items-center gap-3">
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

      {/* Main content area */}
      <div className="relative flex-1">
        {showNetworkViz ? (
          <NetworkVisualization />
        ) : currentStatus === "filling-form" && currentTestType ? (
          <div className="flex h-full items-start justify-center overflow-auto pt-8">
            <div className="w-full max-w-2xl px-6">
              {currentTestType === "survey" ? (
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
              )}
            </div>
          </div>
        ) : currentStatus === "simulating" ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-400">Simulating response...</p>
          </div>
        ) : currentStatus === "viewing-results" && currentResult ? (
          <div className="flex h-full items-start justify-center overflow-auto pt-8">
            <SimulationResultsPanel
              impactScore={currentResult.impactScore}
              attention={currentResult.attention}
              onRunAnother={handleRunAnother}
            />
          </div>
        ) : (
          <NetworkVisualization />
        )}
      </div>

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

/**
 * SimulationResultsPanel - Displays test results
 */
interface SimulationResultsPanelProps {
  impactScore: number;
  attention: {
    full: number;
    partial: number;
    ignore: number;
  };
  onRunAnother: () => void;
}

function SimulationResultsPanel({
  impactScore,
  attention,
  onRunAnother,
}: SimulationResultsPanelProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (impactScore / 100) * circumference;

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      {/* Header */}
      <h3 className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-zinc-500">
        Simulation Results
      </h3>

      {/* Impact Score with circular progress */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative h-32 w-32">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-zinc-800"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-1000 ease-out",
                impactScore >= 80
                  ? "text-emerald-500"
                  : impactScore >= 60
                    ? "text-blue-500"
                    : "text-amber-500"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{impactScore}</span>
            <span className="text-xs text-zinc-500">Impact Score</span>
          </div>
        </div>
      </div>

      {/* Attention Breakdown */}
      <div className="mb-8 space-y-4">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Attention Breakdown
        </h4>
        <AttentionBar label="Full Attention" value={attention.full} color="emerald" />
        <AttentionBar label="Partial Attention" value={attention.partial} color="blue" />
        <AttentionBar label="Ignore" value={attention.ignore} color="zinc" />
      </div>

      {/* Run Another Test Button */}
      <button
        type="button"
        onClick={onRunAnother}
        className={cn(
          "w-full rounded-xl px-6 py-3",
          "bg-white text-zinc-900",
          "text-sm font-medium",
          "transition-colors hover:bg-zinc-200"
        )}
      >
        Run another test
      </button>
    </div>
  );
}

/**
 * AttentionBar - horizontal bar for attention breakdown
 */
function AttentionBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "blue" | "zinc";
}) {
  const colorClasses = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    zinc: "bg-zinc-600",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-white">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            colorClasses[color]
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
