"use client";

import { useRef, useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { ImagePlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEST_TYPES } from "@/lib/test-types";
import { useTestStore } from "@/stores/test-store";
import type { TestType, TestTypeIcon } from "@/types/test";

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

export function ContentForm({
  testType,
  onChangeType,
  onSubmit,
  className,
}: ContentFormProps) {
  const [content, setContent] = useState("");
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

  // Auto-expand textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set height to scrollHeight (with minimum of 120px)
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content);
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
        "flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4",
        className
      )}
    >
      {/* Textarea container - no separate border, integrated into card */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={isViewingHistory}
        placeholder={isViewingHistory ? "" : typeConfig.placeholder}
        className={cn(
          "w-full min-h-[100px] resize-none overflow-hidden",
          "bg-transparent",
          "text-white text-base",
          "placeholder:text-zinc-600",
          "focus:outline-none",
          "transition-colors",
          isViewingHistory && "cursor-default text-zinc-300"
        )}
        rows={1}
      />

      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Type selector badge */}
          {isViewingHistory ? (
            <div
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5",
                "border border-zinc-700 bg-zinc-800/50",
                "text-sm text-zinc-400"
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span className="font-medium">{typeConfig.name}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onChangeType}
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5",
                "border border-zinc-700 bg-zinc-800/50",
                "text-sm text-zinc-400",
                "transition-colors hover:bg-zinc-800 hover:text-white"
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span className="font-medium">{typeConfig.name}</span>
            </button>
          )}

          {/* Action buttons - hidden when viewing history, hidden on mobile */}
          {!isViewingHistory && (
            <>
              {/* Upload Images button - hidden on small screens */}
              <button
                type="button"
                onClick={handleUploadImages}
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg px-3 py-1.5 sm:flex",
                  "border border-zinc-700 bg-zinc-800/50",
                  "text-xs text-zinc-500",
                  "transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                )}
              >
                <ImagePlus className="h-4 w-4" />
                <span>Upload Images</span>
              </button>

              {/* Help Me Craft button - hidden on small screens */}
              <button
                type="button"
                onClick={handleHelpMeCraft}
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg px-3 py-1.5 sm:flex",
                  "border border-zinc-700 bg-zinc-800/50",
                  "text-xs text-zinc-500",
                  "transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>Help Me Craft</span>
              </button>
            </>
          )}
        </div>

        {/* Submit button - hidden when viewing history */}
        {!isViewingHistory && (
          <button
            type="submit"
            disabled={!content.trim()}
            className={cn(
              "rounded-xl px-6 py-2.5",
              "bg-white text-zinc-900",
              "text-sm font-medium",
              "transition-colors",
              "hover:bg-zinc-200",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            )}
          >
            Simulate
          </button>
        )}
      </div>
    </form>
  );
}
