"use client";

import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type TrendingCategory } from "@/types/trending";

export interface EmptyStateProps {
  /** The active category to display in the message */
  category: TrendingCategory;
  /** Additional className for the container */
  className?: string;
}

/**
 * EmptyState - Displayed when no videos match the active filter.
 *
 * Shows a polished empty state with an icon, primary message including
 * the category label, and a secondary "check back soon" message.
 *
 * @example
 * ```tsx
 * {videos.length === 0 ? (
 *   <EmptyState category="breaking-out" />
 * ) : (
 *   <VideoGrid videos={videos} />
 * )}
 * ```
 */
export function EmptyState({ category, className }: EmptyStateProps) {
  const categoryLabel = CATEGORY_LABELS[category].toLowerCase();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-surface-elevated px-6 py-16",
        className
      )}
    >
      {/* Icon container */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        <Inbox className="h-7 w-7 text-foreground-muted" />
      </div>

      {/* Primary message */}
      <p className="text-sm font-medium text-foreground">
        No videos {categoryLabel} right now
      </p>

      {/* Secondary message */}
      <p className="mt-1.5 text-xs text-foreground-muted">
        Check back soon
      </p>
    </div>
  );
}
