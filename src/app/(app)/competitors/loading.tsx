import { CompetitorCardSkeletonGrid } from "@/components/competitors/competitor-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Next.js App Router loading.tsx for the competitors page.
 *
 * Renders a page shell with skeleton header and card grid placeholders
 * while the server component fetches competitor data.
 */
export default function CompetitorsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-foreground">Competitors</h1>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* Card grid skeleton */}
      <CompetitorCardSkeletonGrid />
    </div>
  );
}
