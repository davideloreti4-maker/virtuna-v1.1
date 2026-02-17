"use client";

import { CurrencyDollar, Handshake, LinkSimple } from "@phosphor-icons/react";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "motion/react";

const TABS = [
  { value: "earnings", label: "Earnings", icon: CurrencyDollar },
  { value: "deals", label: "Deals", icon: Handshake },
  { value: "affiliates", label: "Affiliates", icon: LinkSimple },
] as const;

interface BrandDealsTabsProps {
  activeTab: string;
}

export function BrandDealsTabs({ activeTab }: BrandDealsTabsProps) {
  return (
    <Tabs.List className="mt-6 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated/50 p-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.value;
        const TabIcon = tab.icon;

        return (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isActive && (
              <motion.div
                layoutId="brand-deals-tab-pill"
                className="absolute inset-0 z-0 rounded-full border border-white/10 bg-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 flex items-center gap-2 ${
                isActive
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground-secondary"
              }`}
            >
              <TabIcon size={16} weight={isActive ? "fill" : "regular"} />
              {tab.label}
            </span>
          </Tabs.Trigger>
        );
      })}
    </Tabs.List>
  );
}
