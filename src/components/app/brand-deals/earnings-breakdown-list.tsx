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

      <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
          <span>Source</span>
          <span className="text-right">Clicks</span>
          <span className="text-right">Conversions</span>
          <span className="text-right">Earnings</span>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[320px] overflow-y-auto">
          {sorted.map((source) => (
            <div
              key={source.brandName}
              className="grid grid-cols-4 items-center gap-4 border-b border-white/[0.04] px-4 py-3 last:border-b-0"
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
              <span className="text-right text-sm text-foreground-secondary">
                {formatNumber(source.clicks)}
              </span>

              {/* Conversions */}
              <span className="text-right text-sm text-foreground-secondary">
                {formatNumber(source.conversions)}
              </span>

              {/* Earnings */}
              <span className="text-right text-sm font-semibold text-green-400">
                {formatCurrency(source.totalEarned)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
