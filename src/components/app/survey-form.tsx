"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ClipboardList, ChevronDown, Check, GripVertical, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Survey question types
 */
type QuestionType = "single-select" | "open-response";

const QUESTION_TYPES = [
  { id: "single-select", label: "Single Select" },
  { id: "open-response", label: "Open Response" },
] as const;

/**
 * Survey submission data
 */
export interface SurveySubmission {
  question: string;
  questionType: QuestionType;
  options?: string[]; // Only for single-select
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [question]);

  // Option management
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const data: SurveySubmission = {
      question: question.trim(),
      questionType,
    };

    if (questionType === "single-select") {
      // Filter out empty options
      data.options = options.filter((opt) => opt.trim());
    }

    onSubmit(data);
  };

  const canSubmit = question.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4",
        className
      )}
    >
      {/* Question textarea - no separate border, integrated into card */}
      <textarea
        ref={textareaRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What would you like to ask?"
        rows={1}
        className="min-h-[80px] w-full resize-none overflow-hidden bg-transparent text-base text-white placeholder:text-zinc-600 focus:outline-none"
      />

      {/* Question type dropdown */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Question type
        </label>
        <QuestionTypeDropdown
          value={questionType}
          onChange={setQuestionType}
        />
      </div>

      {/* Options list (only for single-select) */}
      {questionType === "single-select" && (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Options
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                {/* Drag handle (visual only) */}
                <div className="cursor-grab text-zinc-600">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Option input */}
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove option ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Add option button */}
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <Plus className="h-4 w-4" />
              Add option
            </button>
          </div>
        </div>
      )}

      {/* Footer with type badge and submit */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
        {/* Type selector badge */}
        <button
          type="button"
          onClick={onChangeType}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ClipboardList className="h-4 w-4" />
          <span className="font-medium">Survey</span>
        </button>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </form>
  );
}

/**
 * Question type dropdown component
 */
function QuestionTypeDropdown({
  value,
  onChange,
}: {
  value: QuestionType;
  onChange: (value: QuestionType) => void;
}) {
  const selectedLabel = QUESTION_TYPES.find((t) => t.id === value)?.label ?? "Select type";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span>{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] py-2 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          sideOffset={4}
          align="start"
        >
          {QUESTION_TYPES.map((type) => (
            <DropdownMenu.Item
              key={type.id}
              onSelect={() => onChange(type.id)}
              className={cn(
                "flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm text-zinc-200 outline-none transition-colors hover:bg-zinc-800 focus:bg-zinc-800",
                value === type.id && "text-white"
              )}
            >
              <span>{type.label}</span>
              {value === type.id && (
                <Check className="h-4 w-4 text-indigo-500" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
