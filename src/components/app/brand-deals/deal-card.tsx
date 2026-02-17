"use client";

import type { BrandDeal } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
// Helpers
// ---------------------------------------------------------------------------

const BARRIER_CONFIG = {
  open: { label: "Open", variant: "success" as const },
  approval: { label: "Approval Required", variant: "warning" as const },
  invite: { label: "Invite Only", variant: "default" as const },
};

// ---------------------------------------------------------------------------
// DealCard Component
// ---------------------------------------------------------------------------

export function DealCard({ deal, isApplied, onApply }: DealCardProps): React.JSX.Element {
  const payout = formatPayout(deal);
  const categoryColor = CATEGORY_COLORS[deal.category];
  const isExternal = deal.source === "external";
  const isExpired = deal.status === "expired";

  function handleCTA() {
    if (isExternal && deal.signUpUrl) {
      window.open(deal.signUpUrl, "_blank", "noopener,noreferrer");
    } else {
      onApply(deal);
    }
  }

  return (
    <Card
      tabIndex={0}
      role="article"
      aria-label={`${deal.brandName} deal: ${payout}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isApplied && !isExpired) {
          handleCTA();
        }
      }}
      className={cn(
        "relative p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isApplied && "opacity-60",
      )}
    >
      {/* Payout -- top-right absolute */}
      <span className="absolute right-5 top-5 text-lg font-semibold text-success">
        {payout}
      </span>

      {/* Brand logo + name + source badge row */}
      <div className="mb-3 flex items-center gap-2.5 pr-20">
        <Avatar
          src={deal.brandLogo}
          alt={`${deal.brandName} logo`}
          fallback={deal.brandName.slice(0, 2).toUpperCase()}
          size="xs"
        />
        <span className="max-w-[50%] truncate text-sm font-medium text-foreground-secondary">
          {deal.brandName}
        </span>
        {deal.isNew && (
          <Badge variant="info" size="sm">New</Badge>
        )}
      </div>

      {/* Description -- 3-line clamp */}
      <p className="mb-4 line-clamp-2 text-sm text-foreground-secondary">
        {deal.description}
      </p>

      {/* Bottom row: category + barrier/status + action */}
      <div className="flex items-center justify-between gap-2">
        {/* Left side: category pill + barrier or status badge */}
        <div className="flex flex-wrap items-center gap-1.5">
          <GlassPill color={categoryColor} size="sm">
            {deal.category.charAt(0).toUpperCase() + deal.category.slice(1)}
          </GlassPill>
          {isExternal && deal.barrier ? (
            <Badge variant={BARRIER_CONFIG[deal.barrier].variant} size="sm">
              {BARRIER_CONFIG[deal.barrier].label}
            </Badge>
          ) : (
            <Badge variant={getStatusBadgeVariant(deal.status)} size="sm">
              {getStatusLabel(deal.status)}
            </Badge>
          )}
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
              onClick={handleCTA}
            >
              {isExternal ? "Join Program" : "Apply"}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
