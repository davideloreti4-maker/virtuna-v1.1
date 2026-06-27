import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route skeleton for /discover. Mirrors DiscoverClient: a header block
 * (title + subtitle) over a responsive outlier-tile grid. Container matches
 * the page's `space-y-6` root so there is no layout shift on hydrate.
 */
export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="relative min-h-[320px]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
