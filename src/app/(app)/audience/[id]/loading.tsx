import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { cn } from "@/lib/utils";

/**
 * /audience/[id] route loading skeleton (Theme B).
 *
 * The page is a client component that renders its own DetailSkeleton while it fetches the
 * audience. This route-level skeleton covers the earlier window (segment JS load / hydration)
 * and mirrors that DetailSkeleton verbatim — back affordance + title lines above a framed
 * ConstellationMark card, inside the page's `max-w-4xl` wrapper — so there is no shift as the
 * client mounts and shows the identical shape.
 */
export default function AudienceDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-4 w-32 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
        <div className={cn(READING_CARD, "flex items-center justify-center py-16 animate-pulse")}>
          <ConstellationMark width={64} litNodeIndex={-1} className="opacity-40" />
        </div>
      </div>
    </div>
  );
}
