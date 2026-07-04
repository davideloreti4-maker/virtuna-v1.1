"use client";

/**
 * GrowHub — the GROW hub shell (Surfaces IA rationalization): one destination that folds
 * the old /analytics, /grow, and /referrals surfaces into three tabs (Numbers · Monetize ·
 * Referrals). Owns the radial backdrop, page header, and segmented tab bar; each tab is a
 * shell-less body (AnalyticsView / GrowView / ReferralsTab). rv-in replays on tab switch.
 *
 * /analytics + /referrals redirect here with the right tab (deep-link preservation, mirrors
 * /discover→/feed). URL is kept in sync client-side via history.replaceState (no refetch).
 */

import { useState } from "react";
import { SURFACE_RADIAL_BG } from "@/components/surfaces/surface-canvas";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { GrowView } from "@/components/grow/grow-view";
import { ReferralsTab } from "@/components/grow/tabs/referrals-tab";
import { cn } from "@/lib/utils";

export type GrowTab = "numbers" | "monetize" | "referrals";

const TABS: { id: GrowTab; label: string }[] = [
  { id: "numbers", label: "Numbers" },
  { id: "monetize", label: "Monetize" },
  { id: "referrals", label: "Referrals" },
];

export function GrowHub({
  initialTab,
  snapshots,
  pillars,
  referral,
}: {
  initialTab: GrowTab;
  snapshots: AccountSnapshot[];
  pillars: Pillar[];
  referral: {
    eligible: boolean;
    referralLink: string;
    clicks: number;
    conversions: number;
    earningsCents: number;
  };
}) {
  const [tab, setTab] = useState<GrowTab>(initialTab);

  const select = (t: GrowTab) => {
    setTab(t);
    // Keep the URL shareable/deep-linkable without a navigation (no server refetch).
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", t === "numbers" ? "/grow" : `/grow?tab=${t}`);
    }
  };

  return (
    <div className="relative min-h-full text-foreground" style={{ background: SURFACE_RADIAL_BG }}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        <header className="mb-4">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Grow</h1>
          <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
            your business — pre-tested on your people
          </p>

          <div
            className="mt-3 inline-flex rounded-lg border border-border bg-surface-elevated p-0.5"
            role="tablist"
            aria-label="Grow sections"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => select(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                  tab === t.id
                    ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                    : "text-foreground-secondary hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* key on the tab so rv-in replays the fade-up each switch */}
        <div key={tab} className="rv-in">
          {tab === "numbers" && <AnalyticsView snapshots={snapshots} pillars={pillars} />}
          {tab === "monetize" && <GrowView />}
          {tab === "referrals" && <ReferralsTab {...referral} />}
        </div>
      </div>
    </div>
  );
}
