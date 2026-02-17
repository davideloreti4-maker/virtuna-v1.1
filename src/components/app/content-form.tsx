"use client";

import { useState, useCallback } from "react";
import { Type, Link, Video, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoUpload } from "./video-upload";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCIAL_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(tiktok\.com\/.+|vm\.tiktok\.com\/.+|@[\w.]+\/video\/\d+|instagram\.com\/(p|reel|reels|tv)\/.+)$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentFormData {
  input_mode: "text" | "tiktok_url" | "video_upload";
  caption: string;
  niche: string;
  hashtags: string;
  notes: string;
  tiktok_url: string;
  video_file: File | null;
  video_caption: string;
  video_niche: string;
  video_hashtags: string;
}

interface ContentFormProps {
  onSubmit: (data: ContentFormData) => void;
  className?: string;
}

type InputMode = "text" | "tiktok_url" | "video_upload";

const MODE_CONFIG: { value: InputMode; icon: typeof Type; label: string }[] = [
  { value: "text", icon: Type, label: "Text" },
  { value: "video_upload", icon: Video, label: "Video" },
  { value: "tiktok_url", icon: Link, label: "URL" },
];

const PLACEHOLDERS: Record<InputMode, string> = {
  text: "Paste your caption or script...",
  tiktok_url: "Paste a TikTok or Instagram URL...",
  video_upload: "Add a caption for your video...",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentForm({ onSubmit, className }: ContentFormProps) {
  const [activeTab, setActiveTab] = useState<InputMode>("text");
  const [formData, setFormData] = useState<ContentFormData>({
    input_mode: "text",
    caption: "",
    niche: "",
    hashtags: "",
    notes: "",
    tiktok_url: "",
    video_file: null,
    video_caption: "",
    video_niche: "",
    video_hashtags: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback(
    <K extends keyof ContentFormData>(field: K, value: ContentFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const handleTabChange = useCallback((mode: InputMode) => {
    setActiveTab(mode);
    setFormData((prev) => ({ ...prev, input_mode: mode }));
    setErrors({});
  }, []);

  // Current text value based on active mode
  const currentValue =
    activeTab === "text"
      ? formData.caption
      : activeTab === "tiktok_url"
        ? formData.tiktok_url
        : formData.video_caption;

  const currentField =
    activeTab === "text"
      ? "caption"
      : activeTab === "tiktok_url"
        ? "tiktok_url"
        : "video_caption";

  const errorKey =
    activeTab === "text"
      ? "caption"
      : activeTab === "tiktok_url"
        ? "tiktok_url"
        : "video_file";

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "text") {
      if (!formData.caption.trim()) {
        newErrors.caption = "Caption is required";
      } else if (formData.caption.trim().length < 10) {
        newErrors.caption = "Must be at least 10 characters";
      }
    } else if (activeTab === "tiktok_url") {
      if (!formData.tiktok_url.trim()) {
        newErrors.tiktok_url = "URL is required";
      } else if (!SOCIAL_URL_PATTERN.test(formData.tiktok_url.trim())) {
        newErrors.tiktok_url = "Enter a valid TikTok or Instagram URL";
      }
    } else if (activeTab === "video_upload") {
      if (!formData.video_file) {
        newErrors.video_file = "Please select a video file";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [activeTab, formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(formData);
  };

  const isSubmitDisabled =
    (activeTab === "text" && !formData.caption.trim()) ||
    (activeTab === "tiktok_url" && !formData.tiktok_url.trim()) ||
    (activeTab === "video_upload" && !formData.video_file);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col rounded-lg border border-white/[0.06] overflow-hidden",
        className
      )}
      style={{
        background:
          "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow:
          "rgba(255,255,255,0.15) 0px 1px 1px 0px inset, 0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* Video upload zone (only when video mode active) */}
      {activeTab === "video_upload" && (
        <div className="px-4 pt-4">
          <VideoUpload
            file={formData.video_file}
            onFileSelect={(file) => updateField("video_file", file)}
          />
          {errors.video_file && (
            <p className="text-sm text-error mt-1">{errors.video_file}</p>
          )}
        </div>
      )}

      {/* Text input area */}
      <textarea
        value={currentValue}
        onChange={(e) => updateField(currentField, e.target.value)}
        placeholder={PLACEHOLDERS[activeTab]}
        rows={3}
        className={cn(
          "w-full resize-none bg-transparent px-5 pt-5 pb-2",
          "text-sm text-foreground placeholder:text-foreground-muted/50",
          "focus:outline-none",
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handleSubmit(e);
          }
        }}
      />

      {/* Error message */}
      {errors[errorKey] && (
        <p className="px-5 text-xs text-error">{errors[errorKey]}</p>
      )}

      {/* Bottom bar: mode switcher + submit */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        {/* Mode switcher pills */}
        <div className="flex items-center gap-0.5">
          {MODE_CONFIG.map(({ value, icon: ModeIcon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === value
                  ? "bg-white/[0.08] text-foreground"
                  : "text-foreground-muted hover:text-foreground hover:bg-white/[0.03]"
              )}
            >
              <ModeIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Submit arrow */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            isSubmitDisabled
              ? "bg-white/5 text-foreground-muted cursor-not-allowed"
              : "bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
          )}
          aria-label="Submit test"
        >
          <ArrowUp className="h-4.5 w-4.5" />
        </button>
      </div>
    </form>
  );
}
