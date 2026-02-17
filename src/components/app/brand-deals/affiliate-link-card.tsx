"use client";

import { Copy, Check } from "@phosphor-icons/react";

import type { AffiliateLink } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { formatCurrency, formatNumber } from "@/lib/affiliate-utils";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AffiliateLinkCardProps {
  /** The affiliate link to display */
  link: AffiliateLink;
}

// ---------------------------------------------------------------------------
// Status Badge Variant Mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<AffiliateLink["status"], "success" | "warning" | "error"> = {
  active: "success",
  paused: "warning",
  expired: "error",
};

// ---------------------------------------------------------------------------
// Mini KPI Stat Block
// ---------------------------------------------------------------------------

function StatBlock({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-3 py-2">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AffiliateLinkCard Component
// ---------------------------------------------------------------------------

/**
 * AffiliateLinkCard -- Presentational component for a single active affiliate link.
 *
 * Displays product info with status badge, truncated URL with copy-to-clipboard
 * icon morph (Copy -> Check for 2s), and three mini KPI stat blocks for
 * clicks, conversions, and earnings.
 *
 * Each card instance has its own `useCopyToClipboard` hook to prevent
 * shared copy state across cards.
 *
 * @example
 * ```tsx
 * <AffiliateLinkCard link={affiliateLink} />
 * ```
 */
export function AffiliateLinkCard({ link }: AffiliateLinkCardProps): React.JSX.Element {
  const { copied, copy } = useCopyToClipboard(2000);

  return (
    <div
      tabIndex={0}
      role="article"
      aria-label={`${link.productName} affiliate link`}
      className={cn(
        "rounded-xl border border-border bg-surface-elevated p-5",
        "transition-all duration-200",
        "hover:border-border-hover hover:-translate-y-px hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {/* Top row: product info + status badge */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar
            src={link.productImage}
            alt={link.productName}
            fallback={link.productName.slice(0, 2).toUpperCase()}
            size="xs"
          />
          <span className="max-w-[180px] truncate text-sm font-medium text-foreground">
            {link.productName}
          </span>
        </div>
        <Badge variant={STATUS_VARIANT[link.status]} size="sm">
          {link.status.charAt(0).toUpperCase() + link.status.slice(1)}
        </Badge>
      </div>

      {/* URL + copy button row */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-foreground-muted">
          {link.url}
        </span>
        <button
          type="button"
          onClick={() => copy(link.url)}
          className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
          aria-label={copied ? "Link copied" : "Copy affiliate link"}
        >
          {copied ? (
            <Check size={16} className="text-green-400" weight="bold" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>

      {/* Mini KPI stat blocks */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Clicks" value={formatNumber(link.clicks)} />
        <StatBlock label="Conversions" value={formatNumber(link.conversions)} />
        <StatBlock label="Earned" value={formatCurrency(link.earnings)} />
      </div>
    </div>
  );
}
