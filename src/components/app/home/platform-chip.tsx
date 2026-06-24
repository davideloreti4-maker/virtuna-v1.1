"use client";

/**
 * PlatformChip — first-class platform selector (D-07).
 *
 * Renders as a compact chip row for TikTok | Instagram | YouTube.
 * Defaults to the profile platform when provided, else "tiktok".
 * Persists only for the current message (per-send state, not session-wide).
 *
 * Raycast THEME-06 rules: 6% border, 10% hover, 8px radius, coral on active,
 * no glow, no tinting. Stays in the composer chip row (persistent, NOT a modal).
 */

import { cn } from "@/lib/utils";

export type Platform = "tiktok" | "instagram" | "youtube";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "IG",
  youtube: "YT",
};

export interface PlatformChipProps {
  value: Platform;
  onChange: (platform: Platform) => void;
  className?: string;
}

const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube"];

export function PlatformChip({ value, onChange, className }: PlatformChipProps) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label="Platform selection"
    >
      <span className="mr-0.5 text-[10px] text-foreground-muted/50 uppercase tracking-wide select-none">
        on
      </span>
      {PLATFORMS.map((platform) => {
        const isActive = platform === value;
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(platform)}
            className={cn(
              // Base: 8px radius, 6% border (Raycast)
              "rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive && [
                "border-border-hover bg-hover text-foreground",
              ],
              // Inactive: 6% border, hover 10%
              !isActive && [
                "border-white/[0.06] text-foreground-muted/60",
                "hover:border-white/[0.1] hover:bg-white/[0.03] hover:text-foreground-muted",
              ],
            )}
          >
            {PLATFORM_LABELS[platform]}
          </button>
        );
      })}
    </div>
  );
}
