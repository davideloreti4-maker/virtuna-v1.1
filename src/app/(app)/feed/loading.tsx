import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route skeleton for /feed. Mirrors FeedClient: a header block, a toolbar row, and a
 * filters sidebar beside the cover-forward card grid. Container matches the page's
 * `max-w-6xl px-6 py-8` root so there is no layout shift on hydrate.
 */
export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="h-9 w-64 max-w-[50%] rounded-md" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-80 w-full rounded-xl" />
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-white/[0.06]">
              <Skeleton className="aspect-[4/5] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
