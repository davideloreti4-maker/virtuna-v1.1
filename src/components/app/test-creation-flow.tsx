"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { TestTypeSelector } from "./test-type-selector";
import { ContentForm } from "./content-form";
import { SurveyForm } from "./survey-form";
import { ResultsPanel } from "./simulation/results-panel";
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
        <Spinner size="lg" />
        <Text size="sm" muted>Simulating response...</Text>
      </div>
    );
  }

  if (currentStatus === "viewing-results" && currentResult) {
    return (
      <div className={cn("w-full max-w-md mx-auto", className)}>
        <ResultsPanel
          result={currentResult}
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
