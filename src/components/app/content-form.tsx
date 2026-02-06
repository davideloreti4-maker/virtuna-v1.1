"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as Icons from "lucide-react";
import { ImagePlus, Sparkles } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { TEST_TYPES } from "@/lib/test-types";
import { useTestStore } from "@/stores/test-store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { TestType, TestTypeIcon } from "@/types/test";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = MAX_LENGTH * 0.8;

const contentFormSchema = z.object({
  content: z
    .string()
    .min(1, { error: "Required" })
    .min(10, { error: "At least 10 characters" }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentFormProps {
  testType: TestType;
  onChangeType: () => void;
  onSubmit: (content: string) => void;
  className?: string;
}

/**
 * Map Lucide icon names to actual icon components
 */
const iconMap: Record<TestTypeIcon, React.ComponentType<{ className?: string }>> = {
  ClipboardList: Icons.ClipboardList,
  FileText: Icons.FileText,
  Globe: Icons.Globe,
  Megaphone: Icons.Megaphone,
  Linkedin: Icons.Linkedin,
  Instagram: Icons.Instagram,
  Twitter: Icons.Twitter,
  Video: Icons.Video,
  Mail: Icons.Mail,
  Send: Icons.Send,
  Package: Icons.Package,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentForm({
  testType,
  onChangeType,
  onSubmit,
  className,
}: ContentFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typeConfig = TEST_TYPES[testType];
  const IconComponent = iconMap[typeConfig.icon];

  // Read-only mode when viewing history
  const isViewingHistory = useTestStore((s) => s.isViewingHistory);
  const currentResult = useTestStore((s) => s.currentResult);

  // Pre-fill content when viewing history
  useEffect(() => {
    if (isViewingHistory && currentResult) {
      setContent(currentResult.content);
    }
  }, [isViewingHistory, currentResult]);

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  const validateField = useCallback((field: string, value: string) => {
    const fieldSchema = contentFormSchema.shape[field as keyof typeof contentFormSchema.shape];
    if (!fieldSchema) return;

    const result = fieldSchema.safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? "" : result.error.issues[0]?.message ?? "",
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const result = contentFormSchema.safeParse({ content });
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
  }, [content]);

  // Re-validate on change after first touch
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      if (touched.content) {
        validateField("content", value);
      }
    },
    [touched.content, validateField]
  );

  const handleBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, content: true }));
    validateField("content", content);
  }, [content, validateField]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      onSubmit(content);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadImages = () => {
    console.log("Upload images clicked");
  };

  const handleHelpMeCraft = () => {
    console.log("Help me craft clicked");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-white/[0.06] p-4",
        className
      )}
      style={{
        backgroundColor: "rgba(24, 25, 28, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
      }}
    >
      {/* Textarea */}
      <div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onBlur={handleBlur}
          readOnly={isViewingHistory}
          placeholder={isViewingHistory ? "" : typeConfig.placeholder}
          autoResize
          size="md"
          error={!!errors.content}
          maxLength={MAX_LENGTH}
          className={cn(
            "border-0 bg-transparent",
            isViewingHistory && "cursor-default opacity-70"
          )}
          style={{ backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" }}
        />

        {/* Error + counter row */}
        <div className="mt-1.5 flex items-center justify-between">
          {errors.content ? (
            <p className="text-sm text-error" role="alert">
              {errors.content}
            </p>
          ) : (
            <span />
          )}

          {content.length >= COUNTER_THRESHOLD && (
            <span
              className={cn(
                "text-sm",
                content.length >= MAX_LENGTH
                  ? "text-error"
                  : "text-foreground-muted"
              )}
            >
              {content.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Type selector badge */}
          {isViewingHistory ? (
            <div
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5",
                "border border-border bg-surface",
                "text-sm text-foreground-secondary"
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span className="font-medium">{typeConfig.name}</span>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onChangeType}
              className="gap-2"
            >
              <IconComponent className="h-4 w-4" />
              <span className="font-medium">{typeConfig.name}</span>
            </Button>
          )}

          {/* Action buttons - hidden when viewing history, hidden on mobile */}
          {!isViewingHistory && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleUploadImages}
                className="hidden gap-1.5 text-xs sm:flex"
              >
                <ImagePlus className="h-4 w-4" />
                <span>Upload Images</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleHelpMeCraft}
                className="hidden gap-1.5 text-xs sm:flex"
              >
                <Sparkles className="h-4 w-4" />
                <span>Help Me Craft</span>
              </Button>
            </>
          )}
        </div>

        {/* Submit button - hidden when viewing history */}
        {!isViewingHistory && (
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={!content.trim() || isSubmitting}
          >
            Simulate
          </Button>
        )}
      </div>
    </form>
  );
}
