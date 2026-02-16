import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading placeholder matching CompetitorCard layout.
 *
 * Renders a shimmer-animated card with placeholder shapes for
 * avatar, handle, stats grid, delta badge, and sparkline area.
 */
export function CompetitorCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        {/* Top row: Avatar + Handle */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Stats grid: 3 columns */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>

        {/* Bottom row: Delta + Sparkline */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid of 6 skeleton cards matching the competitor card grid layout.
 *
 * Used as a loading placeholder during page transitions and initial data fetch.
 */
export function CompetitorCardSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <CompetitorCardSkeleton key={i} />
      ))}
    </div>
  );
}
