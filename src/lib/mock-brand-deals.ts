// src/lib/mock-brand-deals.ts

import type {
  BrandDeal,
  AffiliateLink,
  Product,
  EarningsSummary,
} from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Mock Deals (10 items)
// ---------------------------------------------------------------------------

export const MOCK_DEALS: BrandDeal[] = [
  {
    id: "deal-001",
    brandName: "Nike",
    brandLogo: "https://logo.clearbit.com/nike.com",
    category: "fashion",
    status: "active",
    commission: 15,
    fixedFee: 200,
    payoutRange: "$50 - $500 per post",
    startDate: "2026-01-15",
    description:
      "Promote Nike's latest running collection to your audience. Includes access to exclusive product drops.",
    requirements: "Min 10k followers, fitness or lifestyle niche",
    isNew: true,
    applicantCount: 342,
  },
  {
    id: "deal-002",
    brandName: "Spotify",
    brandLogo: "https://logo.clearbit.com/spotify.com",
    category: "tech",
    status: "active",
    commission: 25,
    payoutRange: "$20 - $150 per signup",
    startDate: "2025-11-01",
    description:
      "Drive Premium subscriptions through your content. Recurring commission on retained subscribers.",
    applicantCount: 1205,
  },
  {
    id: "deal-003",
    brandName: "Adobe",
    brandLogo: "https://logo.clearbit.com/adobe.com",
    category: "tech",
    status: "active",
    commission: 30,
    fixedFee: 500,
    payoutRange: "$100 - $1,000 per conversion",
    startDate: "2025-12-01",
    description:
      "Showcase Creative Cloud workflows in tutorials or reviews. High-value B2B conversions.",
    requirements: "Must create original tutorial content",
    applicantCount: 89,
  },
  {
    id: "deal-004",
    brandName: "Gymshark",
    brandLogo: "https://logo.clearbit.com/gymshark.com",
    category: "fitness",
    status: "pending",
    commission: 20,
    payoutRange: "$30 - $300 per post",
    startDate: "2026-02-01",
    description:
      "Join Gymshark's ambassador program. Create workout content featuring their latest drops.",
    requirements: "Active fitness content creator with engagement rate > 3%",
    applicantCount: 578,
  },
  {
    id: "deal-005",
    brandName: "Sephora",
    brandLogo: "https://logo.clearbit.com/sephora.com",
    category: "beauty",
    status: "active",
    commission: 18,
    payoutRange: "$25 - $400 per post",
    startDate: "2026-01-20",
    description:
      "Feature Sephora Collection products in tutorials or hauls. Early access to new launches.",
    isNew: true,
    applicantCount: 934,
  },
  {
    id: "deal-006",
    brandName: "HelloFresh",
    brandLogo: "https://logo.clearbit.com/hellofresh.com",
    category: "food",
    status: "active",
    commission: 12,
    fixedFee: 100,
    payoutRange: "$15 - $200 per signup",
    startDate: "2025-10-15",
    description:
      "Share meal prep content using HelloFresh boxes. Provide unique discount codes to your audience.",
  },
  {
    id: "deal-007",
    brandName: "Booking.com",
    brandLogo: "https://logo.clearbit.com/booking.com",
    category: "travel",
    status: "expired",
    commission: 8,
    startDate: "2025-06-01",
    endDate: "2025-12-31",
    description:
      "Promote hotel and travel deals. Earn commission on completed bookings through your referral link.",
  },
  {
    id: "deal-008",
    brandName: "Coinbase",
    brandLogo: "https://logo.clearbit.com/coinbase.com",
    category: "finance",
    status: "active",
    commission: 35,
    payoutRange: "$50 - $500 per signup",
    startDate: "2025-09-01",
    description:
      "Drive signups for Coinbase accounts. High commission on verified users who complete their first trade.",
    requirements: "Finance or tech niche, must include risk disclaimers",
    applicantCount: 267,
  },
  {
    id: "deal-009",
    brandName: "Razer",
    brandLogo: "https://logo.clearbit.com/razer.com",
    category: "gaming",
    status: "active",
    commission: 22,
    payoutRange: "$30 - $350 per sale",
    startDate: "2026-01-28",
    description:
      "Review and promote Razer peripherals. Access to pre-release hardware for content creation.",
    isNew: true,
    applicantCount: 156,
  },
  {
    // EDGE CASE: zero commission, zero fixed fee, very long brand name
    id: "deal-010",
    brandName: "Extraordinarily Long Brand Name Corp International",
    brandLogo: "https://logo.clearbit.com/example.com",
    category: "tech",
    status: "pending",
    commission: 0,
    fixedFee: 0,
    payoutRange: "Revenue share TBD",
    startDate: "2026-02-01",
    description:
      "Pilot partnership program. Commission structure pending final approval from brand team.",
    applicantCount: 3,
  },
];

// ---------------------------------------------------------------------------
// Mock Affiliate Links (5 items)
// ---------------------------------------------------------------------------

export const MOCK_AFFILIATE_LINKS: AffiliateLink[] = [
  {
    // High performer
    id: "link-001",
    dealId: "deal-002",
    productName: "Spotify Premium Annual",
    url: "https://open.spotify.com/ref/vtna-sp-001",
    shortCode: "vtna-sp-001",
    clicks: 5420,
    conversions: 218,
    earnings: 2725,
    commissionRate: 25,
    status: "active",
    createdAt: "2025-11-15",
  },
  {
    // Medium performer
    id: "link-002",
    dealId: "deal-001",
    productName: "Nike Air Max 2026",
    productImage: "https://logo.clearbit.com/nike.com",
    url: "https://nike.com/ref/vtna-nk-002",
    shortCode: "vtna-nk-002",
    clicks: 520,
    conversions: 48,
    earnings: 864,
    commissionRate: 15,
    status: "active",
    createdAt: "2026-01-20",
  },
  {
    // Low performer
    id: "link-003",
    dealId: "deal-006",
    productName: "HelloFresh Classic Box",
    url: "https://hellofresh.com/ref/vtna-hf-003",
    shortCode: "vtna-hf-003",
    clicks: 25,
    conversions: 2,
    earnings: 36,
    commissionRate: 12,
    status: "active",
    createdAt: "2026-01-28",
  },
  {
    // EDGE CASE: zero clicks, zero conversions, zero earnings (new link)
    id: "link-004",
    dealId: "deal-008",
    productName: "Coinbase Signup",
    url: "https://coinbase.com/ref/vtna-cb-004",
    shortCode: "vtna-cb-004",
    clicks: 0,
    conversions: 0,
    earnings: 0,
    commissionRate: 35,
    status: "active",
    createdAt: "2026-02-05",
  },
  {
    // Paused link
    id: "link-005",
    dealId: "deal-007",
    productName: "Booking.com Hotel Deals",
    url: "https://booking.com/ref/vtna-bk-005",
    shortCode: "vtna-bk-005",
    clicks: 1340,
    conversions: 67,
    earnings: 1072,
    commissionRate: 8,
    status: "paused",
    createdAt: "2025-07-10",
  },
];

// ---------------------------------------------------------------------------
// Mock Products (8 items)
// ---------------------------------------------------------------------------

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    name: "Air Max 2026",
    brandName: "Nike",
    brandLogo: "https://logo.clearbit.com/nike.com",
    price: 189.99,
    commissionRate: 15,
    category: "fashion",
  },
  {
    id: "prod-002",
    name: "Creative Cloud All Apps",
    brandName: "Adobe",
    brandLogo: "https://logo.clearbit.com/adobe.com",
    price: 59.99,
    commissionRate: 30,
    category: "tech",
  },
  {
    id: "prod-003",
    name: "Premium Individual",
    brandName: "Spotify",
    brandLogo: "https://logo.clearbit.com/spotify.com",
    price: 11.99,
    commissionRate: 25,
    category: "tech",
  },
  {
    id: "prod-004",
    name: "Vital Seamless 2.0 Leggings",
    brandName: "Gymshark",
    brandLogo: "https://logo.clearbit.com/gymshark.com",
    price: 52.0,
    commissionRate: 20,
    category: "fitness",
  },
  {
    id: "prod-005",
    name: "Sephora Favorites Set",
    brandName: "Sephora",
    brandLogo: "https://logo.clearbit.com/sephora.com",
    price: 39.0,
    commissionRate: 18,
    category: "beauty",
  },
  {
    id: "prod-006",
    name: "Classic Veggie Box",
    brandName: "HelloFresh",
    brandLogo: "https://logo.clearbit.com/hellofresh.com",
    price: 69.99,
    commissionRate: 12,
    category: "food",
  },
  {
    id: "prod-007",
    name: "DeathAdder V3 Pro",
    brandName: "Razer",
    brandLogo: "https://logo.clearbit.com/razer.com",
    price: 89.99,
    commissionRate: 22,
    category: "gaming",
  },
  {
    id: "prod-008",
    name: "Coinbase One Subscription",
    brandName: "Coinbase",
    brandLogo: "https://logo.clearbit.com/coinbase.com",
    price: 29.99,
    commissionRate: 35,
    category: "finance",
  },
];

// ---------------------------------------------------------------------------
// Mock Earnings Summary (1 object)
// ---------------------------------------------------------------------------

export const MOCK_EARNINGS_SUMMARY: EarningsSummary = {
  totalEarned: 12487.5,
  pendingPayout: 1852.0,
  paidOut: 10635.5,
  thisMonth: 2134.0,
  monthlyBreakdown: [
    { month: "2025-09", amount: 845.0 },
    { month: "2025-10", amount: 1120.5 },
    { month: "2025-11", amount: 1560.0 },
    { month: "2025-12", amount: 2340.0 },
    { month: "2026-01", amount: 4488.0 },
    { month: "2026-02", amount: 2134.0 },
  ],
  topSources: [
    {
      brandName: "Spotify",
      brandLogo: "https://logo.clearbit.com/spotify.com",
      totalEarned: 5230.0,
      clicks: 12400,
      conversions: 496,
      dealCount: 2,
    },
    {
      brandName: "Adobe",
      brandLogo: "https://logo.clearbit.com/adobe.com",
      totalEarned: 3150.0,
      clicks: 3200,
      conversions: 105,
      dealCount: 1,
    },
    {
      brandName: "Nike",
      brandLogo: "https://logo.clearbit.com/nike.com",
      totalEarned: 2450.0,
      clicks: 8900,
      conversions: 320,
      dealCount: 3,
    },
    {
      brandName: "Booking.com",
      brandLogo: "https://logo.clearbit.com/booking.com",
      totalEarned: 1072.0,
      clicks: 5600,
      conversions: 134,
      dealCount: 1,
    },
    {
      brandName: "HelloFresh",
      brandLogo: "https://logo.clearbit.com/hellofresh.com",
      totalEarned: 585.5,
      clicks: 1800,
      conversions: 45,
      dealCount: 1,
    },
  ],
};
