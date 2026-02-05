"use client";

import { useState, useCallback, useEffect } from "react";
import { ClipboardList, GripVertical, X, Plus } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTestStore } from "@/stores/test-store";
import { GlassTextarea } from "@/components/primitives/GlassTextarea";
import { GlassInput } from "@/components/primitives/GlassInput";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types (exported -- other components depend on these)
// ---------------------------------------------------------------------------

/**
 * Survey question types
 */
type QuestionType = "single-select" | "open-response";

/**
 * Survey submission data
 */
export interface SurveySubmission {
  question: string;
  questionType: QuestionType;
  options?: string[]; // Only for single-select
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const surveyFormSchema = z.object({
  question: z
    .string()
    .min(1, { error: "Required" })
    .min(5, { error: "At least 5 characters" }),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPE_OPTIONS = [
  { value: "single-select", label: "Single Select" },
  { value: "open-response", label: "Open Response" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SurveyFormProps {
  onChangeType: () => void; // Opens type selector
  onSubmit: (data: SurveySubmission) => void;
  className?: string;
}

/**
 * SurveyForm component
 * Unique structure for surveys: question + question type + dynamic options
 */
export function SurveyForm({ onChangeType, onSubmit, className }: SurveyFormProps) {
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("single-select");
  const [options, setOptions] = useState<string[]>(["", ""]); // Default 2 empty options
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Read-only mode when viewing history
  const isViewingHistory = useTestStore((s) => s.isViewingHistory);
  const currentResult = useTestStore((s) => s.currentResult);

  // Pre-fill survey data when viewing history
  useEffect(() => {
    if (isViewingHistory && currentResult) {
      // Parse content: "Q: ...\nType: ...\nOptions: ..."
      const lines = currentResult.content.split("\n");
      const questionLine = lines.find((l) => l.startsWith("Q: "));
      const typeLine = lines.find((l) => l.startsWith("Type: "));
      const optionsLine = lines.find((l) => l.startsWith("Options: "));

      if (questionLine) setQuestion(questionLine.replace("Q: ", ""));
      if (typeLine) {
        const typeValue = typeLine.replace("Type: ", "") as QuestionType;
        if (["single-select", "open-response"].includes(typeValue)) {
          setQuestionType(typeValue);
        }
      }
      if (optionsLine) {
        setOptions(optionsLine.replace("Options: ", "").split(", "));
      }
    }
  }, [isViewingHistory, currentResult]);

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  const validateField = useCallback((field: string, value: string) => {
    const fieldSchema = surveyFormSchema.shape[field as keyof typeof surveyFormSchema.shape];
    if (!fieldSchema) return;

    const result = fieldSchema.safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? "" : result.error.issues[0]?.message ?? "",
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const result = surveyFormSchema.safeParse({ question });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }, [question]);

  // Re-validate on change after first touch
  const handleQuestionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setQuestion(value);
      if (touched.question) {
        validateField("question", value);
      }
    },
    [touched.question, validateField]
  );

  const handleQuestionBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, question: true }));
    validateField("question", question);
  }, [question, validateField]);

  // ---------------------------------------------------------------------------
  // Option management
  // ---------------------------------------------------------------------------

  const addOption = useCallback(() => {
    setOptions((prev) => [...prev, ""]);
  }, []);

  const removeOption = useCallback((index: number) => {
    setOptions((prev) => {
      if (prev.length <= 2) return prev; // Min 2 options
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateOption = useCallback((index: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const data: SurveySubmission = {
        question: question.trim(),
        questionType,
      };

      if (questionType === "single-select") {
        // Filter out empty options
        data.options = options.filter((opt) => opt.trim());
      }

      onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = question.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-4 rounded-2xl border border-border bg-surface p-4",
        className
      )}
    >
      {/* Question textarea */}
      <div>
        <GlassTextarea
          value={question}
          onChange={handleQuestionChange}
          onBlur={handleQuestionBlur}
          readOnly={isViewingHistory}
          placeholder={isViewingHistory ? "" : "What would you like to ask?"}
          autoResize
          size="md"
          error={!!errors.question}
          className={cn(
            "border-0 bg-transparent",
            isViewingHistory && "cursor-default opacity-70"
          )}
          style={{ backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" }}
        />
        {errors.question && (
          <p className="mt-1.5 text-sm text-error" role="alert">
            {errors.question}
          </p>
        )}
      </div>

      {/* Question type dropdown */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground-muted">
          Question type
        </label>
        <Select
          options={QUESTION_TYPE_OPTIONS}
          value={questionType}
          onChange={(val) => setQuestionType(val as QuestionType)}
          placeholder="Select question type..."
          disabled={isViewingHistory}
          size="md"
        />
      </div>

      {/* Options list (only for single-select) */}
      {questionType === "single-select" && (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Options
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                {/* Drag handle (visual only) */}
                <div className={cn("text-foreground-muted", isViewingHistory ? "cursor-default" : "cursor-grab")}>
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Option input */}
                <GlassInput
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  readOnly={isViewingHistory}
                  placeholder={isViewingHistory ? "" : `Option ${index + 1}`}
                  size="sm"
                  className={cn(
                    isViewingHistory && "cursor-default opacity-70"
                  )}
                  wrapperClassName="flex-1"
                />

                {/* Remove button - hidden when viewing history */}
                {!isViewingHistory && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 2}
                    aria-label={`Remove option ${index + 1}`}
                    className="h-8 w-8 min-h-0 min-w-0 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {/* Add option button - hidden when viewing history */}
            {!isViewingHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addOption}
                className="gap-2 text-foreground-muted"
              >
                <Plus className="h-4 w-4" />
                Add option
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Footer with type badge and submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {/* Type badge */}
        {isViewingHistory ? (
          <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground-secondary">
            <ClipboardList className="h-4 w-4" />
            <span className="font-medium">Survey</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onChangeType}
            className="gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="font-medium">Survey</span>
          </Button>
        )}

        {/* Submit button - hidden when viewing history */}
        {!isViewingHistory && (
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={!canSubmit || isSubmitting}
          >
            Ask
          </Button>
        )}
      </div>
    </form>
  );
}
