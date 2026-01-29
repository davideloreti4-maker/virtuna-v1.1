"use client";

import { useRef, useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { ChevronDown, ImagePlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEST_TYPES } from "@/lib/test-types";
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
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-4", className)}>
      {/* Type selector button */}
      <button
        type="button"
        onClick={onChangeType}
        className={cn(
          "flex items-center gap-2 self-start",
          "rounded-lg px-3 py-2",
          "bg-zinc-800/50 border border-zinc-700/50",
          "text-sm text-zinc-400",
          "transition-colors hover:text-white hover:border-zinc-600"
        )}
      >
        <IconComponent className="h-4 w-4" />
        <span>{typeConfig.name}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Textarea container */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={typeConfig.placeholder}
          className={cn(
            "w-full min-h-[120px] resize-none",
            "rounded-xl border border-zinc-800 bg-zinc-900",
            "px-4 py-3",
            "text-white text-base",
            "placeholder:text-zinc-600",
            "focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent",
            "transition-colors"
          )}
        />
      </div>

      {/* Action buttons row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Upload Images button */}
          <button
            type="button"
            onClick={handleUploadImages}
            className={cn(
              "flex items-center gap-1.5",
              "text-xs text-zinc-500",
              "transition-colors hover:text-zinc-300"
            )}
          >
            <ImagePlus className="h-4 w-4" />
            <span>Upload Images</span>
          </button>

          {/* Help Me Craft button */}
          <button
            type="button"
            onClick={handleHelpMeCraft}
            className={cn(
              "flex items-center gap-1.5",
              "text-xs text-zinc-500",
              "transition-colors hover:text-zinc-300"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>Help Me Craft</span>
          </button>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!content.trim()}
          className={cn(
            "rounded-xl px-6 py-3",
            "bg-white text-zinc-900",
            "text-sm font-medium",
            "transition-colors",
            "hover:bg-zinc-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          )}
        >
          Simulate
        </button>
      </div>
    </form>
  );
}
