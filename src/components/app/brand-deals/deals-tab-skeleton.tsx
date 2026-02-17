import { Skeleton } from "@/components/ui/skeleton";

/**
 * DealsTabSkeleton -- Loading skeleton matching DealsTab layout shape.
 *
 * Mirrors the exact grid classes and spacing of DealsTab so content
 * replaces skeleton without layout shift.
 *
 * Sections:
 * 1. New This Week horizontal scroll row
 * 2. Filter bar (search input + category pills)
 * 3. Deal card grid (responsive 1/2/3 columns)
 */
export function DealsTabSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true">
      {/* Section 1: New This Week row */}
      <div className="mb-6">
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="flex gap-4">
          <Skeleton className="h-[200px] w-[300px] shrink-0 rounded-xl" />
          <Skeleton className="h-[200px] w-[300px] shrink-0 rounded-xl" />
          <Skeleton className="h-[200px] w-[300px] shrink-0 rounded-xl" />
        </div>
      </div>

      {/* Section 2: Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-[42px] w-full max-w-sm rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      {/* Section 3: Deal grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  );
}
