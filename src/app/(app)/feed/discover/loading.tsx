import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/surfaces/surface-header";

/**
 * Route skeleton for /feed/discover. Mirrors DiscoverClient's real layout — header block
 * (title + mono subtitle + tab bar), the entry row, then the outlier-tile grid — inside the
 * same PageShell, so there is no layout shift on hydrate. It tracked the OLD standalone
 * layout (no tab bar, no entry row, a 3-col grid the real one never used) until the page
 * moved into the hub on 2026-07-29.
 */
export default function DiscoverLoading() {
  return (
    <PageShell>
      <div className="mb-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-1 h-3 w-96 max-w-full" />
        <Skeleton className="mt-3 h-9 w-[450px] max-w-full rounded-lg" />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-20 rounded-lg" />
      </div>

      <div className="relative min-h-[320px]">
        {/* Matches DiscoverGrid's GRID_CLASS, not a generic 3-col. */}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
