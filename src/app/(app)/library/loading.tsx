import { Skeleton } from "@/components/ui/skeleton";

/**
 * /library route loading skeleton (Theme B).
 *
 * Mirrors LibraryPage → SavedShelf's always-rendered chrome (heading, search/sort/view
 * toolbar, the flat type-filter segmented control) above SavedShelfSkeleton's 6-card grid,
 * inside the page's `max-w-5xl` wrapper. Shows a shape-matched skeleton on navigation
 * instead of the generic dashboard grid from (app)/loading.tsx — and because it matches
 * SavedShelf's own loading state verbatim there is no shift when the client tree hydrates.
 */
export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:p-6">
      <div className="flex flex-col gap-6">
        {/* Header — "Library" heading + subtitle */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-4 w-[min(80vw,360px)] rounded-md" />
          </div>
        </div>

        {/* Toolbar — search + sort + grid/list toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 min-w-[200px] flex-1 rounded-[var(--radius-md)] sm:max-w-sm" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-[var(--radius-md)]" />
            <Skeleton className="h-9 w-[68px] rounded-[var(--radius-md)]" />
          </div>
        </div>

        {/* Flat type-filter segmented control */}
        <div className="flex flex-wrap gap-1 self-start rounded-[var(--radius-md)] p-1">
          {["w-12", "w-16", "w-14", "w-16", "w-16", "w-20", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-[var(--radius-sm)] ${w}`} />
          ))}
        </div>

        {/* Masonry card grid (mirrors SavedShelfSkeleton) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-white/[0.06] p-4"
              style={{ backgroundColor: "var(--color-charcoal-composer)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-24 rounded-[var(--radius-sm)]" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-[90%] rounded-md" />
                <Skeleton className="h-4 w-[60%] rounded-md" />
              </div>
              <Skeleton className="h-12 w-full rounded-[10px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
