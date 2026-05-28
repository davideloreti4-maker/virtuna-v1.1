"use client";

import { Inbox } from "lucide-react";
import { BookmarkSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type FilterTab, type TrendingCategory } from "@/types/trending";

export interface EmptyStateProps {
  /** The active filter tab to display in the message */
  filterTab: FilterTab;
  /** Additional className for the container */
  className?: string;
}

/**
 * EmptyState - Displayed when no videos match the active filter.
 *
 * Shows a polished empty state with an icon, primary message including
 * the category label, and a secondary "check back soon" message.
 * For the "saved" tab, shows a bookmark hint.
 *
 * @example
 * ```tsx
 * {videos.length === 0 ? (
 *   <EmptyState filterTab="breaking-out" />
 * ) : (
 *   <VideoGrid videos={videos} />
 * )}
 * ```
 */
export function EmptyState({ filterTab, className }: EmptyStateProps) {
  const isSaved = filterTab === "saved";
  const categoryLabel = isSaved
    ? "saved"
    : CATEGORY_LABELS[filterTab as TrendingCategory].toLowerCase();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-surface-elevated px-6 py-16",
        className
      )}
    >
      {/* Icon container */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        {isSaved ? (
          <BookmarkSimple className="h-7 w-7 text-foreground-muted" />
        ) : (
          <Inbox className="h-7 w-7 text-foreground-muted" />
        )}
      </div>

      {/* Primary message */}
      <p className="text-sm font-medium text-foreground">
        {isSaved ? "No saved videos yet" : `No videos ${categoryLabel} right now`}
      </p>

      {/* Secondary message */}
      <p className="mt-1.5 text-xs text-foreground-muted">
        {isSaved
          ? "Click the bookmark icon to save videos"
          : "Check back soon"}
      </p>
    </div>
  );
}
