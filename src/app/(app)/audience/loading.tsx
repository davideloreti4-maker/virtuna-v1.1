/**
 * /audience route loading skeleton.
 *
 * Mirrors AudiencePage → AudienceManager's shell (header + zone-framed borderless
 * rows) inside the same `max-w-[880px]` wrapper, so navigation shows a
 * shape-matched skeleton with no shift when the client tree hydrates.
 */
export default function AudienceLoading() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-6 lg:px-6">
      {/* Header — heading left, the two actions right */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="h-7 w-36 animate-pulse rounded bg-white/[0.06]" />
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-white/[0.06]" />
        </div>
      </div>

      {/* Zone-framed rows (mirrors AudienceListSkeleton) */}
      <div className="rounded-2xl bg-white/[0.02] px-2 pb-2 pt-3">
        <div className="mb-1.5 px-3.5">
          <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="flex flex-col divide-y divide-white/[0.045]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 px-3.5 py-4">
              <div className="h-4 w-32 flex-1 rounded bg-white/[0.06]" />
              <div className="h-3 w-40 rounded bg-white/[0.04]" />
              <div className="h-[7px] w-28 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
