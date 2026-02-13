// src/lib/deal-utils.ts

import type { BrandDeal, BrandDealCategory } from "@/types/brand-deals";
type GradientColor = "orange" | "blue" | "green" | "cyan" | "purple" | "pink";

// ---------------------------------------------------------------------------
// Payout Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a deal's payout information for display.
 *
 * Priority:
 * 1. payoutRange (if non-empty) -- returned as-is
 * 2. fixedFee + commission combined
 * 3. fixedFee only
 * 4. commission only
 * 5. Fallback: "TBD"
 *
 * Edge case: deal-010 with zero fee/commission but payoutRange "Revenue share TBD"
 * is handled by priority 1.
 */
export function formatPayout(deal: BrandDeal): string {
  // Priority 1: explicit payoutRange
  if (deal.payoutRange && deal.payoutRange.trim().length > 0) {
    return deal.payoutRange;
  }

  const hasFixedFee = (deal.fixedFee ?? 0) > 0;
  const hasCommission = deal.commission > 0;

  // Priority 2: both
  if (hasFixedFee && hasCommission) {
    return `$${deal.fixedFee} + ${deal.commission}%`;
  }

  // Priority 3: fixed fee only
  if (hasFixedFee) {
    return `$${deal.fixedFee}`;
  }

  // Priority 4: commission only
  if (hasCommission) {
    return `${deal.commission}% commission`;
  }

  // Priority 5: fallback
  return "TBD";
}

// ---------------------------------------------------------------------------
// Category Color Mapping
// ---------------------------------------------------------------------------

/**
 * Maps each BrandDealCategory to a GlassPill color for Brand Bible semantics:
 * - Orange family (creative): fashion, beauty, food
 * - Blue family (tech/analytics): tech, gaming, finance
 * - Green: fitness
 * - Cyan: travel
 */
export const CATEGORY_COLORS: Record<BrandDealCategory, GradientColor> = {
  fashion: "orange",
  beauty: "orange",
  food: "orange",
  tech: "blue",
  gaming: "blue",
  finance: "blue",
  fitness: "green",
  travel: "cyan",
} as const;

// ---------------------------------------------------------------------------
// Status Badge Mapping
// ---------------------------------------------------------------------------

type BadgeVariant = "success" | "warning" | "error" | "info" | "default";
type DealStatus = BrandDeal["status"];

/**
 * Maps a deal status to its corresponding Badge variant.
 */
export function getStatusBadgeVariant(status: DealStatus): BadgeVariant {
  const variantMap: Record<DealStatus, BadgeVariant> = {
    active: "success",
    pending: "warning",
    expired: "error",
    applied: "info",
  };

  return variantMap[status] ?? "default";
}

/**
 * Maps a deal status to its human-readable label.
 */
export function getStatusLabel(status: DealStatus): string {
  const labelMap: Record<DealStatus, string> = {
    active: "Active",
    pending: "Pending",
    expired: "Expired",
    applied: "Applied",
  };

  return labelMap[status] ?? status;
}
