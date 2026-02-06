"use client";

import type { BrandDeal } from "@/types/brand-deals";
import { Badge } from "@/components/ui/badge";
import { DealCard } from "./deal-card";

// ---------------------------------------------------------------------------
// NewThisWeekRow Props
// ---------------------------------------------------------------------------

export interface NewThisWeekRowProps {
  /** Deals marked as new this week (isNew: true) */
  deals: BrandDeal[];
  /** Set of deal IDs the user has applied to */
  appliedDeals: Set<string>;
  /** Callback when user clicks Apply on a deal */
  onApply: (deal: BrandDeal) => void;
}

// ---------------------------------------------------------------------------
// NewThisWeekRow Component
// ---------------------------------------------------------------------------

/**
 * NewThisWeekRow -- Horizontal scrollable row of featured new deals.
 *
 * Renders a "New This Week" section with an info badge showing count.
 * Cards snap to start on scroll. Hidden scrollbar for clean appearance.
 * Only renders when there are deals to show.
 *
 * @example
 * ```tsx
 * <NewThisWeekRow
 *   deals={newDeals}
 *   appliedDeals={appliedSet}
 *   onApply={handleApply}
 * />
 * ```
 */
export function NewThisWeekRow({
  deals,
  appliedDeals,
  onApply,
}: NewThisWeekRowProps): React.JSX.Element | null {
  if (deals.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      {/* Header row */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          New This Week
        </h2>
        <Badge variant="info" size="sm">
          {deals.length}
        </Badge>
      </div>

      {/* Horizontal scroll container */}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        }}
      >
        {deals.map((deal) => (
          <div
            key={deal.id}
            className="min-w-[300px] flex-shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <DealCard
              deal={deal}
              isApplied={appliedDeals.has(deal.id)}
              onApply={onApply}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
