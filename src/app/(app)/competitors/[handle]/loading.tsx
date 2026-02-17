/**
 * Loading skeleton for the competitor detail page.
 *
 * Mirrors the detail page layout with animated shimmer blocks
 * for header, growth section, and engagement section.
 */
export default function CompetitorDetailLoading() {
  return (
    <div className="space-y-8 pb-8">
      {/* Header skeleton */}
      <div className="border-b border-white/[0.06] pb-6 mb-6">
        {/* Back link placeholder */}
        <div className="h-5 w-40 bg-white/[0.06] rounded animate-pulse mb-4" />

        {/* Profile info */}
        <div className="flex items-start gap-4 mb-6">
          {/* Avatar circle */}
          <div className="h-16 w-16 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-64 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="border border-white/[0.06] rounded-xl p-4 space-y-2"
            >
              <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-6 w-24 bg-white/[0.06] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Growth section skeleton */}
      <div>
        <div className="h-5 w-20 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="h-[300px] bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Engagement section skeleton */}
      <div>
        <div className="h-5 w-28 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="h-[300px] bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
