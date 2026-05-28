"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TikTokEmbedProps {
  /** Full TikTok video URL */
  videoUrl: string;
  /** TikTok video ID for cache busting and re-initialization */
  videoId: string;
  /** Additional className for the container */
  className?: string;
}

/**
 * TikTokEmbed - Embeds a TikTok video using their official embed script.
 *
 * Features:
 * - Script injection with cache-busting timestamp
 * - Re-injects script when videoId changes (for navigation)
 * - Loading skeleton while embed initializes
 * - Cleanup on unmount
 *
 * @example
 * ```tsx
 * <TikTokEmbed
 *   videoUrl="https://www.tiktok.com/@user/video/123456"
 *   videoId="123456"
 * />
 * ```
 */
export function TikTokEmbed({ videoUrl, videoId, className }: TikTokEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract video ID from URL for data-video-id attribute
  const extractedVideoId = extractVideoId(videoUrl);

  useEffect(() => {
    // Reset loading state when video changes
    setIsLoading(true);

    // Create and inject the TikTok embed script
    const script = document.createElement("script");
    script.src = `https://www.tiktok.com/embed.js?t=${Date.now()}`;
    script.async = true;

    // Mark loading complete when script loads
    script.onload = () => {
      // Give TikTok time to process the blockquote
      setTimeout(() => setIsLoading(false), 500);
    };

    script.onerror = () => {
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Clean up script on unmount or video change
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [videoId]); // Re-run when video changes

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface animate-pulse"
          style={{ maxWidth: "325px" }}
        >
          <div className="text-foreground-muted text-sm">Loading TikTok...</div>
        </div>
      )}

      {/* TikTok embed blockquote - TikTok script transforms this */}
      <blockquote
        className="tiktok-embed"
        cite={videoUrl}
        data-video-id={extractedVideoId}
        style={{ maxWidth: "325px", minWidth: "325px" }}
      >
        <section />
      </blockquote>
    </div>
  );
}

/**
 * Extract video ID from TikTok URL.
 * Handles URLs like: https://www.tiktok.com/@user/video/1234567890
 */
function extractVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? "";
}
