import { Skeleton } from "@/components/ui/skeleton";
import { SURFACE_RADIAL_BG } from "@/components/surfaces/surface-canvas";

/**
 * Route skeleton for /feed — the DISCOVER hub. Mirrors the hub shell: radial backdrop,
 * "Discover" header + subtitle, the Watching·Trending·Competitors tab bar, a control row,
 * and the filters sidebar beside the 9:16 cover-forward card grid. Container matches the
 * hub's max-w-[1180px] root so there is no layout shift on hydrate.
 */
export default function FeedLoading() {
  return (
    <div className="relative min-h-full" style={{ background: SURFACE_RADIAL_BG }}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        {/* Header: title + subtitle + tab bar */}
        <div className="mb-4 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="mt-3 h-8 w-64 rounded-lg" />
        </div>

        {/* Control row */}
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64 max-w-[50%] rounded-md" />
        </div>

        {/* Filters sidebar + 9:16 card grid */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-white/[0.06]">
                <Skeleton className="aspect-[9/16] w-full rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-5/6 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <div className="flex gap-1.5 pt-0.5">
                    <Skeleton className="h-5 w-12 rounded-md" />
                    <Skeleton className="h-5 w-12 rounded-md" />
                    <Skeleton className="h-5 w-10 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
