"use client";

import type { BrandDeal } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPill } from "@/components/primitives/GlassPill";
import {
  formatPayout,
  CATEGORY_COLORS,
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/deal-utils";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DealCard Props
// ---------------------------------------------------------------------------

export interface DealCardProps {
  /** The brand deal to display */
  deal: BrandDeal;
  /** Whether the user has already applied to this deal */
  isApplied: boolean;
  /** Callback when user clicks the Apply button */
  onApply: (deal: BrandDeal) => void;
}

// ---------------------------------------------------------------------------
// DealCard Component
// ---------------------------------------------------------------------------

/**
 * DealCard -- Presentational component for a single brand deal.
 *
 * Uses solid bg-surface-elevated background (no glass/backdrop-filter).
 * Color semantics: green payout, orange creative categories, blue tech/analytics.
 * Featured (isNew) deals show a colored top border accent.
 *
 * @example
 * ```tsx
 * <DealCard deal={deal} isApplied={false} onApply={handleApply} />
 * ```
 */
export function DealCard({ deal, isApplied, onApply }: DealCardProps): React.JSX.Element {
  const payout = formatPayout(deal);
  const categoryColor = CATEGORY_COLORS[deal.category];
  const statusVariant = getStatusBadgeVariant(deal.status);
  const statusLabel = getStatusLabel(deal.status);
  const isExpired = deal.status === "expired";

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-surface-elevated p-5",
        "transition-all duration-200",
        "hover:border-border-hover hover:-translate-y-px hover:shadow-md",
        // Featured accent: colored top border for new deals
        deal.isNew && "border-t-2 border-t-orange-400",
        // Applied deals are muted
        isApplied && "opacity-60",
      )}
    >
      {/* Payout -- top-right absolute */}
      <span className="absolute right-5 top-5 text-lg font-bold text-green-400">
        {payout}
      </span>

      {/* Brand logo + name row */}
      <div className="mb-3 flex items-center gap-2.5 pr-28">
        <Avatar
          src={deal.brandLogo}
          alt={`${deal.brandName} logo`}
          fallback={deal.brandName.slice(0, 2).toUpperCase()}
          size="xs"
        />
        <span className="max-w-[60%] truncate text-sm font-medium text-foreground-secondary">
          {deal.brandName}
        </span>
      </div>

      {/* Description -- 3-line clamp */}
      <p className="mb-4 line-clamp-3 text-sm text-foreground-secondary">
        {deal.description}
      </p>

      {/* Bottom row: category + status + action */}
      <div className="flex items-center justify-between gap-2">
        {/* Left side: category pill + status badge */}
        <div className="flex items-center gap-2">
          <GlassPill color={categoryColor} size="sm">
            {deal.category.charAt(0).toUpperCase() + deal.category.slice(1)}
          </GlassPill>
          <Badge variant={statusVariant} size="sm">
            {statusLabel}
          </Badge>
        </div>

        {/* Right side: action */}
        <div className="flex-shrink-0">
          {isApplied ? (
            <Badge variant="success" size="sm">
              Applied
            </Badge>
          ) : !isExpired ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onApply(deal)}
            >
              Apply
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
