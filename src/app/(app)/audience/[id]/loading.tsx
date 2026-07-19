/**
 * /audience/[id] route loading skeleton.
 *
 * The page is a server component; this covers the segment-load window and
 * mirrors its shell — breadcrumb, header facts line, then the population-hero
 * zone — inside the same `max-w-[880px]` wrapper, so nothing shifts on mount.
 */
export default function AudienceDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="h-3.5 w-20 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="flex items-center gap-3.5">
        <div className="h-6 w-44 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-40 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_212px] lg:gap-12">
        <div className="h-[240px] animate-pulse rounded-2xl bg-white/[0.02]" />
        <div className="space-y-3">
          <div className="h-2.5 w-12 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
