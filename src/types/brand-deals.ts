// src/types/brand-deals.ts

export type BrandDealCategory =
  | "tech"
  | "fashion"
  | "gaming"
  | "fitness"
  | "beauty"
  | "food"
  | "travel"
  | "finance";

export type ProgramType = "ecommerce" | "marketplace" | "network";
export type PlatformType = "tiktok" | "instagram";
export type BarrierType = "open" | "approval" | "invite";

export interface BrandDeal {
  id: string;
  brandName: string;
  brandLogo: string; // URL -- clearbit CDN format
  category: BrandDealCategory;
  status: "active" | "pending" | "expired" | "applied";
  commission: number; // percentage 0-100
  fixedFee?: number; // optional fixed payment amount
  payoutRange?: string; // e.g. "$50 - $500 per post"
  startDate: string; // ISO date string
  endDate?: string; // optional, for ongoing deals
  description: string;
  requirements?: string; // optional eligibility requirements
  isNew?: boolean; // for "New This Week" section
  applicantCount?: number; // social proof
  // External affiliate program fields (all optional, backward-compat)
  source?: "virtuna" | "external";
  programType?: ProgramType;
  signUpUrl?: string;
  platforms?: PlatformType[];
  barrier?: BarrierType;
  isFeatured?: boolean;
  commissionRange?: string; // "5-20%" display string for external
}

export interface AffiliateProgram {
  id: string;
  name: string;
  logo: string;
  description: string;
  commissionRange: string;
  type: ProgramType;
  platforms: PlatformType[];
  signUpUrl: string;
  category: BrandDealCategory;
  barrier: BarrierType;
  isNew?: boolean;
  isFeatured?: boolean;
  hasLiveSearch?: boolean;
}

export interface CJProduct {
  adId: string;
  advertiserName: string;
  advertiserLogo?: string;
  productName: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  buyUrl: string;
  category: string;
  commission?: number;
}

export interface AffiliateLink {
  id: string;
  dealId: string; // references BrandDeal.id
  productName: string;
  productImage?: string;
  url: string; // full affiliate URL
  shortCode: string;
  clicks: number;
  conversions: number;
  earnings: number;
  commissionRate: number; // percentage
  status: "active" | "paused" | "expired";
  createdAt: string; // ISO date string
}

export interface Product {
  id: string;
  name: string;
  brandName: string;
  brandLogo: string;
  imageUrl?: string;
  price: number;
  commissionRate: number; // percentage
  category: BrandDealCategory;
}

export interface MonthlyEarning {
  month: string; // e.g. "2026-01"
  amount: number;
}

export interface EarningSource {
  brandName: string;
  brandLogo: string;
  totalEarned: number;
  clicks: number;
  conversions: number;
  dealCount: number;
}

export interface EarningsSummary {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  thisMonth: number;
  monthlyBreakdown: MonthlyEarning[];
  topSources: EarningSource[];
}
