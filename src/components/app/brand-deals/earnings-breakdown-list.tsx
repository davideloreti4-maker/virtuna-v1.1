"use client";

import type { EarningSource } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency, formatNumber } from "@/lib/affiliate-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EarningsBreakdownListProps {
  sources: EarningSource[];
}

// ---------------------------------------------------------------------------
// EarningsBreakdownList Component
// ---------------------------------------------------------------------------

/**
 * EarningsBreakdownList -- Table-style breakdown of per-source earnings.
 *
 * Displays brand logo, source name, clicks, conversions, and formatted
 * earnings sorted by totalEarned descending. Top earners appear first.
 *
 * Uses a scrollable container (max 320px) to keep the layout compact
 * when many sources exist.
 *
 * @example
 * ```tsx
 * <EarningsBreakdownList sources={earningsSummary.topSources} />
 * ```
 */
export function EarningsBreakdownList({
  sources,
}: EarningsBreakdownListProps): React.JSX.Element {
  const sorted = [...sources].sort((a, b) => b.totalEarned - a.totalEarned);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Earnings Breakdown
      </h3>

      <div
        className="overflow-hidden rounded-[12px] border border-border"
        style={{
          background: "transparent",
          boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
        }}
      >
        {/* Header row */}
        <div className="grid grid-cols-2 gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider text-foreground-muted sm:grid-cols-4">
          <span>Source</span>
          <span className="hidden text-right sm:block">Clicks</span>
          <span className="hidden text-right sm:block">Conversions</span>
          <span className="text-right">Earnings</span>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[320px] overflow-y-auto">
          {sorted.map((source) => (
            <div
              key={source.brandName}
              className="grid grid-cols-2 items-center gap-4 border-b border-white/[0.06] px-4 py-3 last:border-b-0 sm:grid-cols-4"
            >
              {/* Source column: logo + name */}
              <div className="flex items-center gap-2.5">
                <Avatar
                  src={source.brandLogo}
                  alt={source.brandName}
                  fallback={source.brandName.slice(0, 2).toUpperCase()}
                  size="xs"
                />
                <span className="truncate text-sm font-medium text-foreground">
                  {source.brandName}
                </span>
              </div>

              {/* Clicks */}
              <span className="hidden text-right text-sm text-foreground-secondary sm:block">
                {formatNumber(source.clicks)}
              </span>

              {/* Conversions */}
              <span className="hidden text-right text-sm text-foreground-secondary sm:block">
                {formatNumber(source.conversions)}
              </span>

              {/* Earnings */}
              <span className="text-right text-sm font-semibold text-success">
                {formatCurrency(source.totalEarned)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
