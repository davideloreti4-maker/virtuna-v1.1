import { Metadata } from "next";
import { BrandDealsPage } from "@/components/app/brand-deals";

export const metadata: Metadata = {
  title: "Partnerships | Virtuna",
  description: "Manage brand deals, affiliate links, and earnings",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = ["deals", "affiliates", "earnings"] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function BrandDeals({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "deals";

  return <BrandDealsPage defaultTab={defaultTab} />;
}
