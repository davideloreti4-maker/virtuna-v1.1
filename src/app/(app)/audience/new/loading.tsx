import { NewAudienceLoading as NewAudienceNextLoading } from "@/components/audience-next/new-audience-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * /audience/new route loading skeleton (Theme B).
 *
 * Mirrors NewAudiencePage's header ("New audience") above the three door cards and
 * the active door's step zone, inside the page's `max-w-2xl` wrapper. Shows a
 * shape-matched skeleton on navigation instead of the generic (app)/loading.tsx grid.
 */
export default function NewAudienceLoading() {
  if (NEW_LOOK_ENABLED) return <NewAudienceNextLoading />;
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      {/* Header — title */}
      <Skeleton className="h-8 w-52 rounded-lg" />

      {/* Three doors */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] w-full rounded-xl" />
        ))}
      </div>

      {/* Step zone — input row */}
      <Skeleton className="h-[68px] w-full rounded-2xl" />
    </div>
  );
}
