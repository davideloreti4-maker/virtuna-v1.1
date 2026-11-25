import { CompetitorCardSkeletonGrid } from "@/components/competitors/competitor-card-skeleton";
import { CompetitorTableSkeleton } from "@/components/competitors/competitor-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorNextLoading } from "@/components/discover-next/creator-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * Next.js App Router loading.tsx for the competitors page.
 *
 * Renders a page shell with skeleton header and card grid placeholders
 * while the server component fetches competitor data.
 */
export default function CompetitorsLoading() {
  // Under the new look this address only redirects, but Next wraps every page under this folder in this
  // file's boundary, so a creator's page opened from Discover shows it first: the creator's page outline.
  if (NEW_LOOK_ENABLED) return <CreatorNextLoading />;
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Competitors</h1>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* Card grid skeleton (default view mode is "grid").
          CompetitorTableSkeleton is imported but not rendered here because
          loading.tsx is a server component and cannot read the Zustand
          viewMode store. The card skeleton matches the default first-load. */}
      <CompetitorCardSkeletonGrid />
    </div>
  );
}

// Re-export for potential use in client-side view transitions
export { CompetitorTableSkeleton };
