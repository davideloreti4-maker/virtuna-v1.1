"use client";

import { useState, useCallback } from "react";
import { Type, Link, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { VideoUpload } from "./video-upload";
import { TikTokUrlInput } from "./tiktok-url-input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIKTOK_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(tiktok\.com\/.+|vm\.tiktok\.com\/.+|@[\w.]+\/video\/\d+)$/i;

const NICHE_OPTIONS = [
  { value: "", label: "Select niche (optional)" },
  { value: "comedy", label: "Comedy" },
  { value: "dance", label: "Dance" },
  { value: "education", label: "Education" },
  { value: "fashion", label: "Fashion & Beauty" },
  { value: "fitness", label: "Fitness & Health" },
  { value: "food", label: "Food & Cooking" },
  { value: "gaming", label: "Gaming" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "music", label: "Music" },
  { value: "pets", label: "Pets & Animals" },
  { value: "sports", label: "Sports" },
  { value: "tech", label: "Tech & Science" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentFormData {
  input_mode: "text" | "tiktok_url" | "video_upload";
  // Text mode fields
  caption: string;
  niche: string;
  hashtags: string;
  notes: string;
  // TikTok URL mode
  tiktok_url: string;
  // Video mode
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

  // ---------------------------------------------------------------------------
  // Field updaters
  // ---------------------------------------------------------------------------

  const updateField = useCallback(
    <K extends keyof ContentFormData>(field: K, value: ContentFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field when user edits it
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const handleTabChange = useCallback(
    (value: string) => {
      const mode = value as InputMode;
      setActiveTab(mode);
      setFormData((prev) => ({ ...prev, input_mode: mode }));
      setErrors({});
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Validation (on submit only)
  // ---------------------------------------------------------------------------

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "text") {
      if (!formData.caption.trim()) {
        newErrors.caption = "Caption is required";
      } else if (formData.caption.trim().length < 10) {
        newErrors.caption = "Caption must be at least 10 characters";
      }
    } else if (activeTab === "tiktok_url") {
      if (!formData.tiktok_url.trim()) {
        newErrors.tiktok_url = "URL is required";
      } else if (!TIKTOK_URL_PATTERN.test(formData.tiktok_url.trim())) {
        newErrors.tiktok_url = "Enter a valid TikTok URL";
      }
    } else if (activeTab === "video_upload") {
      if (!formData.video_file) {
        newErrors.video_file = "Please select a video file";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [activeTab, formData]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(formData);
  };

  // ---------------------------------------------------------------------------
  // Disable logic
  // ---------------------------------------------------------------------------

  const isSubmitDisabled =
    (activeTab === "text" && !formData.caption.trim()) ||
    (activeTab === "tiktok_url" && !formData.tiktok_url.trim()) ||
    (activeTab === "video_upload" && !formData.video_file);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.06] p-5",
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
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="text" className="gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Text
          </TabsTrigger>
          <TabsTrigger value="tiktok_url" className="gap-1.5">
            <Link className="h-3.5 w-3.5" />
            TikTok URL
          </TabsTrigger>
          <TabsTrigger value="video_upload" className="gap-1.5">
            <Video className="h-3.5 w-3.5" />
            Video
          </TabsTrigger>
        </TabsList>

        {/* --- Text Tab --- */}
        <TabsContent value="text">
          <div className="flex flex-col gap-4">
            {/* Caption */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Caption / Script
              </label>
              <Textarea
                value={formData.caption}
                onChange={(e) => updateField("caption", e.target.value)}
                placeholder="Paste your caption or script..."
                autoResize
                minRows={3}
                maxRows={8}
              />
              {errors.caption && (
                <p className="text-sm text-error mt-1">{errors.caption}</p>
              )}
            </div>

            {/* Niche */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Niche
              </label>
              <Select
                options={NICHE_OPTIONS}
                value={formData.niche}
                onChange={(value) => updateField("niche", value)}
                placeholder="Select niche (optional)"
                size="md"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Hashtags
              </label>
              <Input
                value={formData.hashtags}
                onChange={(e) => updateField("hashtags", e.target.value)}
                placeholder="#viral #fyp #trending"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Notes
              </label>
              <Input
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional context or notes"
              />
            </div>
          </div>
        </TabsContent>

        {/* --- TikTok URL Tab --- */}
        <TabsContent value="tiktok_url">
          <div className="flex flex-col gap-4">
            <TikTokUrlInput
              url={formData.tiktok_url}
              onUrlChange={(url) => updateField("tiktok_url", url)}
              preview={null}
              onFetchPreview={(url) => {
                // Preview fetching is a Phase 8+ concern
                console.log("Fetch preview for:", url);
              }}
            />
            {errors.tiktok_url && (
              <p className="text-sm text-error mt-1">{errors.tiktok_url}</p>
            )}
          </div>
        </TabsContent>

        {/* --- Video Upload Tab --- */}
        <TabsContent value="video_upload">
          <div className="flex flex-col gap-4">
            {/* Upload zone */}
            <div>
              <VideoUpload
                file={formData.video_file}
                onFileSelect={(file) => updateField("video_file", file)}
              />
              {errors.video_file && (
                <p className="text-sm text-error mt-1">{errors.video_file}</p>
              )}
            </div>

            {/* Caption */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Caption / Script
              </label>
              <Textarea
                value={formData.video_caption}
                onChange={(e) => updateField("video_caption", e.target.value)}
                placeholder="Paste your caption or script..."
                autoResize
                minRows={3}
                maxRows={8}
              />
            </div>

            {/* Niche */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Niche
              </label>
              <Select
                options={NICHE_OPTIONS}
                value={formData.video_niche}
                onChange={(value) => updateField("video_niche", value)}
                placeholder="Select niche (optional)"
                size="md"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Hashtags
              </label>
              <Input
                value={formData.video_hashtags}
                onChange={(e) => updateField("video_hashtags", e.target.value)}
                placeholder="#viral #fyp #trending"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitDisabled}
          className="w-full sm:w-auto"
        >
          Test
        </Button>
      </div>
    </form>
  );
}
