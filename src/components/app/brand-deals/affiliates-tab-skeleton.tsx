import { Skeleton } from "@/components/ui/skeleton";

/**
 * AffiliatesTabSkeleton -- Loading skeleton matching AffiliatesTab layout shape.
 *
 * Mirrors the two-section layout with matching grid breakpoints
 * so content replaces skeleton without layout shift.
 *
 * Sections:
 * 1. Active Links (heading + badge + 2-column grid)
 * 2. Available Products (heading + 3-column grid)
 */
export function AffiliatesTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-8" aria-hidden="true">
      {/* Section 1: Active Links */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
        </div>
      </section>

      {/* Section 2: Available Products */}
      <section>
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      </section>
    </div>
  );
}
