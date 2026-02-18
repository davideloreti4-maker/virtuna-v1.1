"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useDealEnrollments } from "@/hooks/queries";

import { AffiliatesTab } from "./affiliates-tab";
import { BrandDealsHeader } from "./brand-deals-header";
import { BrandDealsTabs } from "./brand-deals-tabs";
import { DealsTab } from "./deals-tab";
import { EarningsTab } from "./earnings-tab";

type ValidTab = "deals" | "affiliates" | "earnings";

const VALID_TABS: ValidTab[] = ["deals", "affiliates", "earnings"];

interface BrandDealsPageProps {
  defaultTab: ValidTab;
}

export function BrandDealsPage({ defaultTab }: BrandDealsPageProps) {
  const searchParams = useSearchParams();
  const { data: enrollmentsData } = useDealEnrollments();

  const appliedDeals = useMemo(() => {
    if (!enrollmentsData?.data) return new Set<string>();
    return new Set(enrollmentsData.data.map((e) => e.deal_id));
  }, [enrollmentsData]);

  const tabParam = searchParams.get("tab") || "";
  const currentTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : defaultTab;

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <BrandDealsHeader />

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <BrandDealsTabs />

        <TabsContent value="deals">
          <DealsTab appliedDeals={appliedDeals} />
        </TabsContent>

        <TabsContent value="affiliates">
          <AffiliatesTab />
        </TabsContent>

        <TabsContent value="earnings">
          <EarningsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
