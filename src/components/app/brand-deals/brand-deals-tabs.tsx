"use client";

import { CurrencyDollar, Handshake, LinkSimple } from "@phosphor-icons/react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "deals", label: "Deals", icon: Handshake },
  { value: "affiliates", label: "Affiliates", icon: LinkSimple },
  { value: "earnings", label: "Earnings", icon: CurrencyDollar },
] as const;

export function BrandDealsTabs() {
  return (
    <TabsList>
      {TABS.map((tab) => {
        const TabIcon = tab.icon;
        return (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
            <TabIcon size={16} />
            {tab.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
