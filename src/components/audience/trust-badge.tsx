"use client";

/**
 * Phase 3 Plan 05 — TrustBadge (D-06 / TRUST-01).
 *
 * Presentation-only badge for an audience's trust tier. The CALLER resolves the
 * tier (`resolveTier(audience)`) and passes it in — this component never calls
 * `resolveTier`, so there is a single source of truth for the never-Validated-for-
 * general rule (T-03-11). Wraps the flat-warm `Badge` primitive only — no new
 * visual language, no coral/glass.
 *   - Validated  → `default` (calm, confident neutral surface)
 *   - Directional → `secondary` (muted elevated surface)
 */

import { Badge } from "@/components/ui/badge";
import type { TrustTier } from "@/lib/audience/resolve-tier";
import { cn } from "@/lib/utils";

const TIER_VARIANTS: Record<TrustTier, "default" | "secondary"> = {
  Validated: "default",
  Directional: "secondary",
};

export interface TrustBadgeProps {
  tier: TrustTier;
  className?: string;
}

export function TrustBadge({ tier, className }: TrustBadgeProps) {
  return (
    <Badge
      variant={TIER_VARIANTS[tier]}
      size="sm"
      className={cn("shrink-0", className)}
    >
      {tier}
    </Badge>
  );
}
