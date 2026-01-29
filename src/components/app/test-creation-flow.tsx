"use client";

import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { TestTypeSelector } from "./test-type-selector";
import { ContentForm } from "./content-form";
import { SurveyForm } from "./survey-form";
import type { TestType } from "@/types/test";
import type { SurveySubmission } from "./survey-form";

interface TestCreationFlowProps {
  triggerButton: ReactNode;
  className?: string;
}

/**
 * TestCreationFlow orchestrator
 * Manages the full flow: type selector -> form -> loading -> results
 */
export function TestCreationFlow({ triggerButton, className }: TestCreationFlowProps) {
  const {
    currentStatus,
    currentTestType,
    currentResult,
    setStatus,
    setTestType,
    submitTest,
    reset,
  } = useTestStore();
  const { selectedSocietyId } = useSocietyStore();

  // Handle trigger button click
  const handleTriggerClick = () => {
    setStatus("selecting-type");
  };

  // Handle type selection
  const handleSelectType = (type: TestType) => {
    setTestType(type);
    setStatus("filling-form");
  };

  // Handle form submission (content-based forms)
  const handleContentSubmit = (content: string) => {
    if (selectedSocietyId) {
      submitTest(content, selectedSocietyId);
    }
  };

  // Handle survey submission
  const handleSurveySubmit = (data: SurveySubmission) => {
    if (selectedSocietyId) {
      // Convert survey data to content string
      const content = `Q: ${data.question}\nType: ${data.questionType}${
        data.options ? `\nOptions: ${data.options.join(", ")}` : ""
      }`;
      submitTest(content, selectedSocietyId);
    }
  };

  // Handle "change type" from forms
  const handleChangeType = () => {
    setStatus("selecting-type");
  };

  // Handle "run another test"
  const handleRunAnother = () => {
    reset();
  };

  // Close type selector
  const handleCloseSelector = () => {
    setStatus("idle");
    setTestType(null);
  };

  // Render based on current status
  if (currentStatus === "idle") {
    return (
      <div className={className} onClick={handleTriggerClick}>
        {triggerButton}
      </div>
    );
  }

  if (currentStatus === "selecting-type") {
    return (
      <>
        <div className={className} onClick={handleTriggerClick}>
          {triggerButton}
        </div>
        <TestTypeSelector
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCloseSelector();
          }}
          onSelectType={handleSelectType}
        />
      </>
    );
  }

  if (currentStatus === "filling-form" && currentTestType) {
    const isSurvey = currentTestType === "survey";

    return (
      <div className={cn("w-full max-w-2xl mx-auto p-6", className)}>
        {isSurvey ? (
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
    );
  }

  if (currentStatus === "simulating") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-400">Simulating response...</p>
      </div>
    );
  }

  if (currentStatus === "viewing-results" && currentResult) {
    return (
      <div className={cn("w-full max-w-md mx-auto", className)}>
        <SimulationResultsPanel
          impactScore={currentResult.impactScore}
          attention={currentResult.attention}
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

/**
 * SimulationResultsPanel
 * Displays test results with impact score and attention breakdown
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
  // Calculate stroke dash offset for circular progress
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (impactScore / 100) * circumference;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      {/* Header */}
      <h3 className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-zinc-500">
        Simulation Results
      </h3>

      {/* Impact Score with circular progress */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative h-32 w-32">
          {/* Background circle */}
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
            {/* Progress circle */}
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
                impactScore >= 80 ? "text-emerald-500" :
                impactScore >= 60 ? "text-blue-500" :
                "text-amber-500"
              )}
            />
          </svg>
          {/* Score number */}
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

        {/* Full Attention */}
        <AttentionBar label="Full Attention" value={attention.full} color="emerald" />

        {/* Partial Attention */}
        <AttentionBar label="Partial Attention" value={attention.partial} color="blue" />

        {/* Ignore */}
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
interface AttentionBarProps {
  label: string;
  value: number;
  color: "emerald" | "blue" | "zinc";
}

function AttentionBar({ label, value, color }: AttentionBarProps) {
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
