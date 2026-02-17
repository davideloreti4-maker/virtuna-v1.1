"use client";

import * as React from "react";
import { Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** TikTok URL validation pattern - matches tiktok.com, vm.tiktok.com, and @handle/video/ID */
const TIKTOK_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(tiktok\.com\/.+|vm\.tiktok\.com\/.+|@[\w.]+\/video\/\d+)$/i;

/**
 * Preview data for a TikTok URL
 */
export interface TikTokUrlPreview {
  /** Thumbnail URL */
  thumbnail?: string;
  /** Video caption */
  caption?: string;
  /** Creator name/handle */
  creator?: string;
}

/**
 * Props for the TikTokUrlInput component
 */
export interface TikTokUrlInputProps {
  /** Current URL value */
  url: string;
  /** Callback when URL changes */
  onUrlChange: (url: string) => void;
  /** Preview data (null = no preview) */
  preview: TikTokUrlPreview | null;
  /** Loading state for preview fetch */
  isLoading?: boolean;
  /** Server-side error message */
  error?: string | null;
  /** Callback to trigger preview fetch for a valid URL */
  onFetchPreview?: (url: string) => void;
  /** Additional className */
  className?: string;
}

/**
 * TikTokUrlInput component with URL validation, preview display, and loading/error states.
 *
 * Validates TikTok URLs on paste/change and triggers preview fetch for valid URLs.
 * Error prop is for server-side errors (URL unreachable, video not found).
 * Validation errors are not shown live (validation on submit only per design decision).
 */
const TikTokUrlInput = React.forwardRef<HTMLDivElement, TikTokUrlInputProps>(
  (
    { url, onUrlChange, preview, isLoading, error, onFetchPreview, className },
    ref
  ) => {
    const lastFetchedUrl = React.useRef<string>("");

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const newUrl = e.target.value;
      onUrlChange(newUrl);

      // Trigger preview fetch for valid URLs (avoid re-fetching same URL)
      if (
        newUrl &&
        TIKTOK_URL_PATTERN.test(newUrl) &&
        newUrl !== lastFetchedUrl.current
      ) {
        lastFetchedUrl.current = newUrl;
        onFetchPreview?.(newUrl);
      }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      // Get the pasted text to validate ahead of the change event
      const pastedText = e.clipboardData.getData("text").trim();
      if (
        pastedText &&
        TIKTOK_URL_PATTERN.test(pastedText) &&
        pastedText !== lastFetchedUrl.current
      ) {
        lastFetchedUrl.current = pastedText;
        // Defer to let the input update first
        setTimeout(() => {
          onFetchPreview?.(pastedText);
        }, 0);
      }
    }

    return (
      <div ref={ref} className={cn("w-full", className)}>
        {/* URL input */}
        <Input
          id="tiktok-url"
          value={url}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder="Paste TikTok URL (tiktok.com/... or vm.tiktok.com/...)"
          leftIcon={<Link className="w-4 h-4" />}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Server-side error message */}
        {error && (
          <p className="mt-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}

        {/* Loading state */}
        {isLoading && !preview && (
          <div className="mt-3 flex items-center justify-center gap-2 py-4">
            <Spinner size="sm" />
            <span className="text-sm text-foreground-muted">
              Fetching preview...
            </span>
          </div>
        )}

        {/* Preview card */}
        {preview && !isLoading && (
          <div className="mt-3 bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              {preview.thumbnail && (
                <img
                  src={preview.thumbnail}
                  alt="TikTok video thumbnail"
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                {preview.creator && (
                  <p className="text-sm text-foreground-secondary">
                    {preview.creator}
                  </p>
                )}
                {preview.caption && (
                  <p className="text-sm text-foreground-muted line-clamp-2 mt-0.5">
                    {preview.caption}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
TikTokUrlInput.displayName = "TikTokUrlInput";

export { TikTokUrlInput };
