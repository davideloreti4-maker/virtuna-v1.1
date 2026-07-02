import { Skeleton } from "@/components/ui/skeleton";

/**
 * /audience/new route loading skeleton (Theme B).
 *
 * Mirrors NewAudiencePage's header ("Create audience" + subtitle) above AudienceForm's
 * stacked field groups (label + input), inside the page's `max-w-2xl` wrapper. Shows a
 * shape-matched skeleton on navigation instead of the generic (app)/loading.tsx grid.
 */
export default function NewAudienceLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      {/* Header — title + subtitle */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-52 rounded-lg" />
        <Skeleton className="h-4 w-[min(90vw,420px)] rounded-md" />
      </div>

      {/* Form — stacked label + input field groups + submit */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          </div>
        ))}
        <Skeleton className="h-10 w-36 rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
