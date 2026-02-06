import { Skeleton } from "@/components/ui/skeleton";

/**
 * VideoCardSkeleton - Loading placeholder for VideoCard.
 *
 * Matches the exact layout dimensions of VideoCard for zero-layout-shift loading.
 * Uses the same aspect ratio (4/5 thumbnail) and content spacing.
 *
 * @example
 * ```tsx
 * // In a grid with real cards
 * {isLoading ? (
 *   Array.from({ length: 6 }).map((_, i) => <VideoCardSkeleton key={i} />)
 * ) : (
 *   videos.map(v => <VideoCard key={v.id} video={v} />)
 * )}
 * ```
 */
export function VideoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-elevated">
      {/* Thumbnail skeleton - matches 4/5 aspect ratio */}
      <Skeleton className="aspect-[4/5] w-full rounded-none" />

      {/* Content area skeleton - matches VideoCard padding and spacing */}
      <div className="space-y-2.5 p-3">
        {/* Creator row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-10 rounded-md" />
        </div>

        {/* Title - two lines */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>

        {/* Bottom row: pill + velocity + views */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-3.5 w-10 rounded-md" />
            <Skeleton className="h-3 w-14 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
