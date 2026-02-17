"use client";

import { useMemo } from "react";

import type { AffiliateLink } from "@/types/brand-deals";
import { useAffiliateLinks } from "@/hooks/queries";
import { Badge } from "@/components/ui/badge";

import { AffiliateLinkCard } from "./affiliate-link-card";
import { AffiliatesTabSkeleton } from "./affiliates-tab-skeleton";
import { AffiliatesEmptyState } from "./affiliates-empty-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map API row to frontend AffiliateLink type */
function toAffiliateLink(row: Record<string, unknown>): AffiliateLink {
  return {
    id: row.id as string,
    dealId: (row.deal_id as string) ?? "",
    productName: row.product_name as string,
    url: row.url as string,
    shortCode: row.short_code as string,
    clicks: row.clicks as number,
    conversions: row.conversions as number,
    earnings: (row.earnings_cents as number) / 100,
    commissionRate: Number(row.commission_rate_pct),
    status: row.status as AffiliateLink["status"],
    createdAt: (row.created_at as string).split("T")[0] ?? "",
  };
}

// ---------------------------------------------------------------------------
// AffiliatesTab Container
// ---------------------------------------------------------------------------

export function AffiliatesTab(): React.JSX.Element {
  const { data, isLoading } = useAffiliateLinks();

  const activeLinks = useMemo(
    () => (data?.data ?? []).map((row) => toAffiliateLink(row as unknown as Record<string, unknown>)),
    [data],
  );

  if (isLoading) return <AffiliatesTabSkeleton />;

  return (
    <div className="space-y-8">
      {/* Active Links section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Active Links</h2>
          <Badge variant="default" size="sm">
            {activeLinks.length}
          </Badge>
        </div>
        {activeLinks.length === 0 ? (
          <AffiliatesEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeLinks.map((link) => (
              <AffiliateLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
