"use client";

/**
 * PanelSkeleton — per-panel loading primitive.
 *
 * Three visual states based on PanelReadyState:
 *  - "idle"    → faint, static (analysis not yet started for this panel)
 *  - "loading" → animate-pulse (wave in progress for this panel)
 *  - "error"   → red border accent
 *  - "ready"   → component not rendered (caller renders content instead)
 *
 * Reuses the existing Skeleton component from @/components/ui/skeleton
 * (shimmer animation, no new animation authored).
 */

import { Skeleton } from "@/components/ui/skeleton";
import type { PanelReadyState } from "@/lib/engine/panel-mapping";

interface PanelSkeletonProps {
  ready: PanelReadyState;
}

export function PanelSkeleton({ ready }: PanelSkeletonProps) {
  const animClass =
    ready === "loading"
      ? "animate-pulse"
      : ready === "error"
        ? "border border-red-500/40 rounded-md"
        : "opacity-50";

  return (
    <div
      data-skeleton-state={ready}
      className={`space-y-2 ${animClass}`}
    >
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
