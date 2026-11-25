"use client";

import * as React from "react";
import { Info, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useVideoMeta } from "@/hooks/use-video-meta";
import { VIDEO_ACCEPT, formatFileSize, validateVideoFile } from "@/lib/video-file";

/**
 * Props for the VideoUpload component
 */
export interface VideoUploadProps {
  /** Currently selected file (null = empty state) */
  file: File | null;
  /** Callback when a file is selected or removed */
  onFileSelect: (file: File | null) => void;
  /** Upload progress 0-100, undefined = no upload in progress */
  uploadProgress?: number;
  /** Additional className */
  className?: string;
  /**
   * Seamless variant — drops the bordered card chrome so the drop zone reads as
   * native content of its host surface (e.g. the composer panel) instead of a
   * nested box-in-a-box. Drag feedback becomes a coral wash.
   */
  bare?: boolean;
}

/** Format seconds into "m:ss" duration string */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * VideoUpload component with drag-drop, thumbnail preview, progress bar, and file removal.
 *
 * States:
 * - Empty: Drop zone with upload icon and instructions
 * - Uploading: File selected + uploadProgress defined, shows progress bar
 * - Preview: File selected, no progress, shows thumbnail + metadata
 */
const VideoUpload = React.forwardRef<HTMLDivElement, VideoUploadProps>(
  ({ file, onFileSelect, uploadProgress, className, bare = false }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [dataDisclosureOpen, setDataDisclosureOpen] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Thumbnail and duration from the video file
    const { durationSec: duration, thumbnail } = useVideoMeta(file);

    function handleFileSelection(f: File) {
      const validationError = validateVideoFile(f);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      onFileSelect(f);
    }

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }

    function handleDragLeave(e: React.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelection(droppedFile);
      }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelection(selectedFile);
      }
      // Reset input so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }

    function handleRemove() {
      setError(null);
      onFileSelect(null);
    }

    const isUploading = file !== null && uploadProgress !== undefined;
    const isPreview = file !== null && uploadProgress === undefined;

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div
          className={cn(
            "relative rounded-xl transition-colors duration-150",
            bare
              ? isDragging
                ? "bg-[var(--color-foreground-secondary)]/[0.07] ring-1 ring-inset ring-[var(--color-foreground-secondary)]/30"
                : ""
              : cn(
                  "border bg-white/[0.03]",
                  isDragging
                    ? "border-white/[0.12] bg-white/[0.05]"
                    : "border-white/[0.06]",
                ),
          )}
          onDragOver={!file ? handleDragOver : undefined}
          onDragLeave={!file ? handleDragLeave : undefined}
          onDrop={!file ? handleDrop : undefined}
        >
          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            aria-label="Upload video file"
            className="hidden"
            onChange={handleInputChange}
          />

          {/* Empty state — compact horizontal drop zone + data disclosure (INT-06) */}
          {!file && (
            <div className="flex flex-col">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "group/drop flex flex-1 items-center gap-3 text-left transition-colors",
                    bare
                      ? "h-[54px] rounded-xl px-1 hover:bg-white/[0.02]"
                      : "h-[52px] rounded-lg px-3 hover:bg-white/[0.03]",
                    !bare && isDragging && "bg-white/[0.05]",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isDragging
                        ? "bg-[var(--color-foreground-secondary)]/15 text-[var(--color-foreground-secondary)]"
                        : "bg-white/[0.05] text-foreground-muted group-hover/drop:bg-white/[0.08]",
                    )}
                  >
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground/90 leading-tight">
                      Drop video or click to upload
                    </span>
                    <span className="text-[11px] text-foreground-muted/60 leading-tight tabular-nums">
                      MP4, MOV, WebM · Max 200MB
                    </span>
                  </div>
                </button>

                {/* Privacy disclosure — sibling so it never triggers the picker */}
                <button
                  type="button"
                  aria-label="About your data"
                  aria-expanded={dataDisclosureOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDataDisclosureOpen((prev) => !prev);
                  }}
                  className={cn(
                    "mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors motion-reduce:transition-none pointer-coarse:h-11 pointer-coarse:w-11",
                    dataDisclosureOpen
                      ? "bg-white/[0.06] text-foreground/80"
                      : "text-foreground-muted/40 hover:bg-white/[0.05] hover:text-foreground/80",
                  )}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>

              {dataDisclosureOpen && (
                <p
                  className={cn(
                    "pb-1.5 pt-0.5 text-[11px] leading-relaxed text-foreground-muted/70",
                    bare ? "px-1" : "px-3",
                  )}
                >
                  Videos auto-delete after 30 days. Keep them for re-analysis in Settings.
                </p>
              )}
            </div>
          )}

          {/* Upload progress state */}
          {isUploading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
              <div className="text-center">
                <p className="text-sm text-foreground truncate max-w-[280px]">
                  {file.name}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  Uploading...
                </p>
              </div>
              {/* Progress bar overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06] rounded-b-xl overflow-hidden">
                <div
                  className="h-full bg-action transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview state */}
          {isPreview && (
            <div className="relative p-4">
              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.05] border border-white/[0.06] text-foreground-muted hover:text-foreground hover:bg-white/[0.1] transition-colors"
                aria-label="Remove video"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={`Thumbnail of ${file.name}`}
                    className="rounded-lg object-cover flex-shrink-0"
                    style={{ maxHeight: 120, maxWidth: 160 }}
                  />
                ) : (
                  <div className="w-[120px] h-[80px] rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-foreground-muted" />
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-col gap-1.5 min-w-0 pt-1">
                  <p className="text-sm text-foreground truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-foreground-muted">
                      {formatFileSize(file.size)}
                    </span>
                    {duration !== null && (
                      <Badge size="sm">{formatDuration(duration)}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
VideoUpload.displayName = "VideoUpload";

export { VideoUpload };
