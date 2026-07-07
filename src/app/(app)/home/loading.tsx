import { Skeleton } from "@/components/ui/skeleton";

/**
 * /home route loading skeleton (Theme B, P0).
 *
 * Mirrors HomePageLayout's empty state — the hero-anchored greeting (logo mark + serif
 * line) above the centered composer — so navigating to /home shows a shape-matched
 * skeleton instead of the generic dashboard-grid fallback from (app)/loading.tsx.
 * Container classes match HomePageLayout / HomeGreeting / Composer verbatim so there is
 * no layout shift when the real client tree hydrates.
 */
export default function HomeLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center px-4">
      <div className="flex w-full max-w-[760px] flex-1 flex-col min-h-0">
        {/* Greeting hero anchor — MavenMark (40px) + the serif welcome line. */}
        <div className="shrink-0 flex flex-col items-center pt-[clamp(3rem,18vh,7rem)] pb-8">
          <Skeleton className="mb-5 h-10 w-10 rounded-xl" />
          <Skeleton className="h-9 w-[min(80%,420px)] rounded-lg" />
        </div>

        {/* Composer input block — matches the rounded-2xl composer surface. */}
        <Skeleton className="h-[128px] w-full rounded-2xl" />

        {/* HomeStarter — the creator quick-actions grid (6 cards, 2 columns). */}
        <div className="mx-auto mt-4 grid w-full max-w-[600px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full rounded-[12px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
