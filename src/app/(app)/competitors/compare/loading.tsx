import { Skeleton } from "@/components/ui/skeleton";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * Loading skeleton for the comparison page.
 *
 * Shows selector placeholders and a grid of metric card skeletons. Uses the shared
 * Skeleton primitive so the wait carries the app's warm shimmer + reduced-motion guard
 * (no bare clinical pulse).
 */
export default function CompareLoading() {
  // Under the new look this address only redirects to the Watchlist: nothing to outline.
  if (NEW_LOOK_ENABLED) return null;
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Skeleton className="h-8 w-48 rounded-lg" />

      {/* Selector skeletons */}
      <div className="flex gap-4">
        <Skeleton className="h-[42px] flex-1 rounded-lg" />
        <Skeleton className="h-[42px] flex-1 rounded-lg" />
      </div>

      {/* Metric card skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[350px] rounded-xl" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    </div>
  );
}
