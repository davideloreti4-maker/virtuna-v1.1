import { Skeleton } from "@/components/ui/skeleton";

/**
 * /audience/[id] route loading skeleton.
 *
 * The page is a server component; this covers the segment-load window and
 * mirrors its shell — breadcrumb, header facts line, then the population-hero
 * zone — inside the same `max-w-[880px]` wrapper, so nothing shifts on mount.
 * Uses the shared Skeleton primitive (warm shimmer + reduced-motion guard).
 */
export default function AudienceDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-3.5 w-20 rounded" />
      </div>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-6 w-44 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
      <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_212px] lg:gap-12">
        <Skeleton className="h-[240px] rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-12 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}
