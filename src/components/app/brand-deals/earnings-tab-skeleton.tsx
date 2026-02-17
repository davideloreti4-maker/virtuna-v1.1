import { Skeleton } from "@/components/ui/skeleton";

/**
 * EarningsTabSkeleton -- Loading skeleton matching EarningsTab layout shape.
 *
 * Mirrors the three-section layout with matching spacing so content
 * replaces skeleton without layout shift.
 *
 * Sections:
 * 1. Stat cards (2x2 grid)
 * 2. Chart area (heading + period selector + chart placeholder)
 * 3. Earnings breakdown (heading + table placeholder)
 */
export function EarningsTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* Section 1: Stat cards -- 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[12px] border border-border p-5"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Section 2: Chart area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      {/* Section 3: Earnings breakdown */}
      <div>
        <Skeleton className="mb-3 h-4 w-36" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  );
}
