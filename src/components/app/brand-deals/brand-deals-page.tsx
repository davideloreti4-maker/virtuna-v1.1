"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";

import { BrandDealsHeader } from "./brand-deals-header";
import { BrandDealsTabs } from "./brand-deals-tabs";
import { DealsTab } from "./deals-tab";

type ValidTab = "earnings" | "deals" | "affiliates";

const VALID_TABS: ValidTab[] = ["earnings", "deals", "affiliates"];

interface BrandDealsPageProps {
  defaultTab: ValidTab;
}

export function BrandDealsPage({ defaultTab }: BrandDealsPageProps) {
  const searchParams = useSearchParams();
  const [appliedDeals, setAppliedDeals] = useState<Set<string>>(new Set());

  function handleApplyDeal(dealId: string): void {
    setAppliedDeals((prev) => new Set(prev).add(dealId));
  }

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
    <div className="mx-auto max-w-5xl p-6">
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
                <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border-subtle">
                  <p className="text-foreground-muted">
                    Earnings tab content -- Phase 56
                  </p>
                </div>
              </Tabs.Content>

              <Tabs.Content
                value="deals"
                forceMount={currentTab === "deals" ? true : undefined}
                className="outline-none"
              >
                <DealsTab appliedDeals={appliedDeals} onApplyDeal={handleApplyDeal} />
              </Tabs.Content>

              <Tabs.Content
                value="affiliates"
                forceMount={currentTab === "affiliates" ? true : undefined}
                className="outline-none"
              >
                <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border-subtle">
                  <p className="text-foreground-muted">
                    Affiliates tab content -- Phase 55
                  </p>
                </div>
              </Tabs.Content>
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs.Root>
    </div>
  );
}
