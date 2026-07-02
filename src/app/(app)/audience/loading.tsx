import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { cn } from "@/lib/utils";

/**
 * /audience route loading skeleton (Theme B).
 *
 * Mirrors AudiencePage → AudienceManager's header ("Your audiences" + subtitle + actions)
 * above AudienceListSkeleton's 3 card rows, inside the page's `max-w-4xl` wrapper. Matches
 * the manager's own loading state verbatim (same READING_CARD rows + ConstellationMark) so
 * navigation shows a shape-matched skeleton — not the generic (app)/loading.tsx grid — with
 * no shift when the client tree hydrates.
 */
export default function AudienceLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="flex flex-col gap-6">
        {/* Header — heading + subtitle on the left, action buttons on the right */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-44 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-4 w-64 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-9 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="h-9 w-32 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Audience list (mirrors AudienceListSkeleton — 3 rows) */}
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(READING_CARD, "flex items-center gap-4 p-4 animate-pulse")}>
              <ConstellationMark width={56} litNodeIndex={-1} className="shrink-0 opacity-40" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-white/[0.06]" />
                <div className="h-3 w-48 rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
