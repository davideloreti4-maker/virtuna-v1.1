import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading placeholder matching CompetitorTable layout.
 *
 * Renders the real table header with 5 shimmer-animated body rows,
 * matching column widths and cell positions of the actual table.
 */
export function CompetitorTableSkeleton() {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
              Creator
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Followers
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Likes
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Videos
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Eng. Rate
            </th>
            <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
              Growth
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b border-white/[0.04]">
              {/* Creator: avatar + text */}
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </td>

              {/* Followers */}
              <td className="py-3 px-4 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16" />
                </div>
              </td>

              {/* Likes */}
              <td className="py-3 px-4 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-14" />
                </div>
              </td>

              {/* Videos */}
              <td className="py-3 px-4 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-12" />
                </div>
              </td>

              {/* Eng. Rate */}
              <td className="py-3 px-4 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-12" />
                </div>
              </td>

              {/* Growth */}
              <td className="py-3 px-4">
                <Skeleton className="h-5 w-16 rounded-full" />
              </td>

              {/* Trend */}
              <td className="py-3 px-4 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-6 w-16" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
