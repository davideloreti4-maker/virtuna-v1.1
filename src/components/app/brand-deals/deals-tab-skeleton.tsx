import { Skeleton } from "@/components/ui/skeleton";

export function DealsTabSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true">
      {/* Filter bar: search + category pills */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[42px] w-full max-w-sm rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>
      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[200px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
