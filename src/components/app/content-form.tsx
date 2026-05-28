"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Type, Link, Video, ArrowUp, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoUpload } from "./video-upload";
import { useSimulationStore } from "@/stores/simulation-store";
import { usePendingProfileGate } from "@/hooks/use-pending-profile-gate";
import { ProfileInterviewModal } from "@/components/app/profile-interview-modal";
import { useBoardStore } from "@/stores/board-store";
import { APOLLO_TIERS } from "@/lib/models";
import type { ApolloTier } from "@/lib/models";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

const FRAME_COUNT = 10;
const FRAME_WIDTH = 120;

async function extractVideoFrames(file: File): Promise<{
  thumbnail: string;
  duration: number;
  frames: Record<number, string>;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const frames: Record<number, string> = {};
    let duration = 0;
    let idx = 0;
    let thumbnail = "";
    // Two-phase: first seek captures the thumbnail at the same offset
    // VideoUpload uses (Math.min(0.5, duration/4)), then 10 segment frames.
    let phase: "thumbnail" | "frames" = "thumbnail";

    function capture(): string {
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_WIDTH;
      canvas.height = Math.round(FRAME_WIDTH * ((video.videoHeight / video.videoWidth) || (16 / 9)));
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.6);
    }

    function seekNext() {
      if (phase === "thumbnail") {
        video.currentTime = Math.min(0.5, duration / 4);
        return;
      }
      if (idx >= FRAME_COUNT) {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        video.load();
        resolve({ frames, duration, thumbnail });
        return;
      }
      video.currentTime = (idx + 0.5) * (duration / FRAME_COUNT);
    }

    video.onloadeddata = () => {
      duration = video.duration;
      seekNext();
    };

    video.onseeked = () => {
      if (phase === "thumbnail") {
        thumbnail = capture();
        phase = "frames";
        idx = 0;
      } else {
        const dataUrl = capture();
        if (dataUrl) frames[idx] = dataUrl;
        idx++;
      }
      seekNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video extraction failed"));
    };

    video.src = url;
  });
}

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
  uploadProgress?: number;
  className?: string;
}

type InputMode = "text" | "tiktok_url" | "video_upload";

const MODE_CONFIG: { value: InputMode; icon: typeof Type; label: string }[] = [
  { value: "video_upload", icon: Video, label: "Video" },
  { value: "text", icon: Type, label: "Text" },
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

export function ContentForm({ onSubmit, uploadProgress, className }: ContentFormProps) {
  // On /analyze/[id] (result route) default to text input so the large
  // VideoUpload drop zone doesn't dominate the result page. User can still
  // tab to Video to upload another.
  const params = useParams();
  const isOnResultRoute =
    !!params && typeof (params as { id?: unknown }).id === "string";
  const [activeTab, setActiveTab] = useState<InputMode>(
    isOnResultRoute ? "text" : "video_upload",
  );
  const apolloTier = useSimulationStore((s) => s.apolloTier);
  const setApolloTier = useSimulationStore((s) => s.setApolloTier);
  const {
    isLoading: isProfileLoading,
    interceptOrProceed,
    resumeAfterModal,
  } = usePendingProfileGate();
  const [modalOpen, setModalOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const [formData, setFormData] = useState<ContentFormData>({
    input_mode: isOnResultRoute ? "text" : "video_upload",
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

  const setPendingVideo = useBoardStore((s) => s.setPendingVideo);
  const clearPendingVideo = useBoardStore((s) => s.clearPendingVideo);
  const extractingRef = useRef(false);

  useEffect(() => {
    const file = formData.video_file;
    if (!file) {
      clearPendingVideo();
      return;
    }

    let cancelled = false;
    extractingRef.current = true;

    extractVideoFrames(file).then(({ thumbnail, duration, frames }) => {
      if (!cancelled) {
        setPendingVideo({ thumbnail, duration, frames });
        extractingRef.current = false;
      }
    }).catch(() => {
      extractingRef.current = false;
    });

    return () => { cancelled = true; };
  }, [formData.video_file, setPendingVideo, clearPendingVideo]);

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
    const { intercepted } = interceptOrProceed(() => onSubmit(formData));
    if (intercepted) setModalOpen(true);
  };

  const isSubmitDisabled =
    isProfileLoading ||
    (activeTab === "text" && !formData.caption.trim()) ||
    (activeTab === "tiktok_url" && !formData.tiktok_url.trim()) ||
    (activeTab === "video_upload" && !formData.video_file);

  return (
    <>
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
        <div className="px-2 pt-2">
          <VideoUpload
            file={formData.video_file}
            onFileSelect={(file) => updateField("video_file", file)}
            uploadProgress={uploadProgress}
          />
          {errors.video_file && (
            <p className="text-xs text-error mt-1">{errors.video_file}</p>
          )}
        </div>
      )}

      {/* Text input area */}
      <textarea
        value={currentValue}
        onChange={(e) => updateField(currentField, e.target.value)}
        placeholder={PLACEHOLDERS[activeTab]}
        rows={1}
        className={cn(
          "w-full resize-none bg-transparent px-3 pt-2.5 pb-1",
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
        <p className="px-3 text-xs text-error">{errors[errorKey]}</p>
      )}

      {/* Bottom bar: mode switcher + model tier + submit */}
      <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
        {/* Mode switcher pills */}
        <div className="flex items-center gap-0.5">
          {MODE_CONFIG.map(({ value, icon: ModeIcon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                activeTab === value
                  ? "bg-white/[0.08] text-foreground"
                  : "text-foreground-muted hover:text-foreground hover:bg-white/[0.03]"
              )}
            >
              <ModeIcon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Right side: model tier label + submit */}
        <div className="flex items-center gap-2">
          <Popover open={tierOpen} onOpenChange={setTierOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                Apollo {apolloTier}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-52 p-1.5 border-white/[0.08] bg-[#111214]"
            >
              {APOLLO_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setApolloTier(tier.id as ApolloTier);
                    setTierOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors",
                    apolloTier === tier.id
                      ? "text-foreground bg-white/[0.06]"
                      : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04]"
                  )}
                >
                  <span className="font-medium capitalize">{tier.name}</span>
                  {apolloTier === tier.id && <Check className="h-3 w-3 text-accent" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Submit arrow */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              isSubmitDisabled
                ? "bg-white/5 text-foreground-muted cursor-not-allowed"
                : "bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
            )}
            aria-label="Submit test"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
    {modalOpen && (
      <ProfileInterviewModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resumeAfterModal();
        }}
      />
    )}
    </>
  );
}
