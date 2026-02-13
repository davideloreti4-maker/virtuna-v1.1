"use client";

import { useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";

import { useDealEnrollments } from "@/hooks/queries";

import { AffiliatesTab } from "./affiliates-tab";
import { BrandDealsHeader } from "./brand-deals-header";
import { BrandDealsTabs } from "./brand-deals-tabs";
import { DealsTab } from "./deals-tab";
import { EarningsTab } from "./earnings-tab";

type ValidTab = "earnings" | "deals" | "affiliates";

const VALID_TABS: ValidTab[] = ["earnings", "deals", "affiliates"];

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
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <BrandDealsHeader activeTab={currentTab} />

      <Tabs.Root value={currentTab} onValueChange={handleTabChange}>
        <BrandDealsTabs activeTab={currentTab} />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tabs.Content
                value="earnings"
                forceMount={currentTab === "earnings" ? true : undefined}
                className="outline-none"
              >
                <EarningsTab />
              </Tabs.Content>

              <Tabs.Content
                value="deals"
                forceMount={currentTab === "deals" ? true : undefined}
                className="outline-none"
              >
                <DealsTab appliedDeals={appliedDeals} />
              </Tabs.Content>

              <Tabs.Content
                value="affiliates"
                forceMount={currentTab === "affiliates" ? true : undefined}
                className="outline-none"
              >
                <AffiliatesTab />
              </Tabs.Content>
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs.Root>
    </div>
  );
}
