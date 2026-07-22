import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the competitor detail page.
 *
 * Mirrors the detail page layout with the shared Skeleton primitive (warm shimmer +
 * reduced-motion guard) for header, growth section, and engagement section. The card
 * frames + header divider are real structural borders, kept as-is.
 */
export default function CompetitorDetailLoading() {
  return (
    <div className="space-y-8 pb-8">
      {/* Header skeleton */}
      <div className="border-b border-white/[0.06] pb-6 mb-6">
        {/* Back link placeholder */}
        <Skeleton className="h-5 w-40 rounded mb-4" />

        {/* Profile info */}
        <div className="flex items-start gap-4 mb-6">
          {/* Avatar circle */}
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="border border-white/[0.06] rounded-xl p-4 space-y-2"
            >
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Growth section skeleton */}
      <div>
        <Skeleton className="h-5 w-20 rounded mb-4" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <Skeleton className="h-[300px] rounded" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Engagement section skeleton */}
      <div>
        <Skeleton className="h-5 w-28 rounded mb-4" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <Skeleton className="h-[300px] rounded" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="border border-white/[0.06] rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
