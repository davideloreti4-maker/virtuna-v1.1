"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
];

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
}

/** Format bytes into human-readable string (e.g. "14.2 MB") */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
  ({ file, onFileSelect, uploadProgress, className }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [thumbnail, setThumbnail] = React.useState<string | null>(null);
    const [duration, setDuration] = React.useState<number | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Extract thumbnail and duration from video file
    React.useEffect(() => {
      if (!file) {
        setThumbnail(null);
        setDuration(null);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute("src");
        video.load();
      };

      video.onloadeddata = () => {
        setDuration(video.duration);

        // Seek to a small offset to get a meaningful frame
        video.currentTime = Math.min(0.5, video.duration / 4);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            setThumbnail(canvas.toDataURL("image/jpeg", 0.7));
          }
        } catch {
          // Thumbnail extraction failed silently — preview will show without thumbnail
        }
        cleanup();
      };

      video.onerror = () => {
        cleanup();
      };

      video.src = objectUrl;

      return () => {
        cleanup();
      };
    }, [file]);

    function validateFile(f: File): string | null {
      if (!ACCEPTED_VIDEO_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
        return "Please select a video file (MP4, MOV, WebM)";
      }
      if (f.size > MAX_FILE_SIZE) {
        return `File too large (${formatFileSize(f.size)}). Maximum size is 200MB.`;
      }
      return null;
    }

    function handleFileSelection(f: File) {
      const validationError = validateFile(f);
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
            "relative rounded-xl border transition-colors duration-150",
            // Base surface
            "bg-white/[0.03] border-white/[0.06]",
            // Drag hover
            isDragging && "bg-white/[0.05]",
            // Clickable in empty state
            !file && "cursor-pointer"
          )}
          onClick={!file ? () => inputRef.current?.click() : undefined}
          onDragOver={!file ? handleDragOver : undefined}
          onDragLeave={!file ? handleDragLeave : undefined}
          onDrop={!file ? handleDrop : undefined}
          role={!file ? "button" : undefined}
          tabIndex={!file ? 0 : undefined}
          onKeyDown={
            !file
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }
              : undefined
          }
        >
          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleInputChange}
          />

          {/* Empty state */}
          {!file && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05]">
                <Upload className="w-5 h-5 text-foreground-muted" />
              </div>
              <div className="text-center">
                <p className="text-sm text-foreground">
                  Drop your video here or click to browse
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  MP4, MOV, WebM up to 200MB
                </p>
              </div>
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
                  className="h-full bg-accent transition-all duration-300"
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
