import type { Tables } from "@/types/database.types";
import type { BrandDeal, BrandDealCategory } from "@/types/brand-deals";

const VALID_CATEGORIES: BrandDealCategory[] = [
  "tech",
  "fashion",
  "gaming",
  "fitness",
  "beauty",
  "food",
  "travel",
  "finance",
];

const VALID_STATUSES = ["active", "pending", "expired", "applied"] as const;
type DealStatus = (typeof VALID_STATUSES)[number];

/**
 * Maps a deals DB row (snake_case) to BrandDeal UI type (camelCase).
 *
 * - Converts compensation_fixed_cents to dollars
 * - Derives payoutRange from compensation_type + values
 * - Derives requirements from min_followers, min_engagement_rate, required_niches
 * - Marks isNew if created_at is within the last 7 days
 */
export function mapDealRowToUI(row: Tables<"deals">): BrandDeal {
  const category: BrandDealCategory = VALID_CATEGORIES.includes(
    row.brand_category as BrandDealCategory
  )
    ? (row.brand_category as BrandDealCategory)
    : "tech";

  const status: DealStatus = VALID_STATUSES.includes(
    row.status as DealStatus
  )
    ? (row.status as DealStatus)
    : "active";

  const fixedFee = row.compensation_fixed_cents
    ? row.compensation_fixed_cents / 100
    : undefined;

  const payoutRange = derivePayoutRange(
    row.compensation_type,
    row.compensation_rev_share_percent,
    fixedFee
  );

  const requirements = deriveRequirements(
    row.min_followers,
    row.min_engagement_rate,
    row.required_niches
  );

  const createdAt = row.created_at ?? new Date().toISOString();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isNew = new Date(createdAt).getTime() > sevenDaysAgo;

  return {
    id: row.id,
    brandName: row.brand_name,
    brandLogo: row.brand_logo_url ?? "",
    category,
    status,
    commission: row.compensation_rev_share_percent ?? 0,
    fixedFee,
    payoutRange,
    startDate: createdAt,
    endDate: row.expires_at ?? undefined,
    description: row.description ?? "",
    requirements: requirements || undefined,
    isNew,
    applicantCount: undefined, // Not in DB schema
  };
}

function derivePayoutRange(
  compensationType: string,
  revSharePercent: number | null,
  fixedFeeDollars: number | undefined
): string {
  switch (compensationType) {
    case "rev_share":
      return `Revenue share: ${revSharePercent ?? 0}%`;
    case "fixed":
      return fixedFeeDollars != null ? `Fixed: $${fixedFeeDollars}` : "Fixed fee";
    case "hybrid":
      return [
        revSharePercent ? `${revSharePercent}% rev share` : null,
        fixedFeeDollars != null ? `$${fixedFeeDollars} fixed` : null,
      ]
        .filter(Boolean)
        .join(" + ") || "Hybrid";
    default:
      return compensationType;
  }
}

function deriveRequirements(
  minFollowers: number | null,
  minEngagementRate: number | null,
  requiredNiches: string[] | null
): string {
  const parts: string[] = [];

  if (minFollowers != null && minFollowers > 0) {
    parts.push(
      `${minFollowers >= 1000 ? `${(minFollowers / 1000).toFixed(0)}K` : minFollowers}+ followers`
    );
  }

  if (minEngagementRate != null && minEngagementRate > 0) {
    parts.push(`${minEngagementRate}%+ engagement rate`);
  }

  if (requiredNiches != null && requiredNiches.length > 0) {
    parts.push(`Niches: ${requiredNiches.join(", ")}`);
  }

  return parts.join(" | ");
}
