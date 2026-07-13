import { Skeleton } from "@/components/ui/skeleton";

/**
 * /home route loading skeleton (Theme B, P0).
 *
 * Mirrors HomePageLayout's empty state — the greeting → quick-actions grid →
 * composer group, vertically centered as a unit — so navigating to /home shows a
 * shape-matched skeleton instead of the generic dashboard-grid fallback from
 * (app)/loading.tsx. Container classes match HomePageLayout / HomeGreeting /
 * HomeQuickActions / Composer verbatim so there is no layout shift when the real
 * client tree hydrates.
 */
export default function HomeLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-[760px] flex-col">
        {/* Greeting hero — MavenMark (40px) + the serif welcome line. */}
        <div className="flex shrink-0 flex-col items-center pt-6 pb-9">
          <Skeleton className="mb-5 h-10 w-10 rounded-xl" />
          <Skeleton className="h-9 w-[min(80%,420px)] rounded-lg" />
        </div>

        {/* Quick-actions grid (6 cards, 2 columns) — ABOVE the composer. */}
        <div className="mb-5 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-[12px]" />
          ))}
        </div>

        {/* Composer input block — matches the rounded composer surface. */}
        <Skeleton className="h-[128px] w-full rounded-[24px]" />
      </div>
    </div>
  );
}
