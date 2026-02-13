"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTestStore, mapPredictionToTestResult } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import { useAnalyze } from "@/hooks/queries";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { TestTypeSelector } from "./test-type-selector";
import { ContentForm } from "./content-form";
import { SurveyForm } from "./survey-form";
import { ResultsPanel } from "./simulation/results-panel";
import type { TestType } from "@/types/test";
import type { SurveySubmission } from "./survey-form";

const MINIMUM_THEATER_MS = 4500;

interface TestCreationFlowProps {
  triggerButton: ReactNode;
  className?: string;
}

/**
 * TestCreationFlow orchestrator
 * Manages the full flow: type selector -> form -> loading -> results
 *
 * Wired to useAnalyze() mutation for SSE streaming analysis.
 */
export function TestCreationFlow({ triggerButton, className }: TestCreationFlowProps) {
  const {
    currentStatus,
    currentTestType,
    setStatus,
    setTestType,
    reset,
  } = useTestStore();
  const { selectedSocietyId } = useSocietyStore();
  const analyzeMutation = useAnalyze();
  const isCancelledRef = useRef(false);
  const [submittedContent, setSubmittedContent] = useState("");

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

  // Derive result from mutation data
  const currentResult = useMemo(() => {
    if (!analyzeMutation.data || !currentTestType) return null;
    return mapPredictionToTestResult(
      analyzeMutation.data,
      submittedContent,
      currentTestType,
      selectedSocietyId ?? ""
    );
  }, [analyzeMutation.data, currentTestType, selectedSocietyId, submittedContent]);

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

  // Handle survey submission
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

  // Handle "change type" from forms
  const handleChangeType = () => {
    setStatus("selecting-type");
  };

  // Handle "run another test"
  const handleRunAnother = () => {
    reset();
    analyzeMutation.reset();
    setSubmittedContent("");
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
