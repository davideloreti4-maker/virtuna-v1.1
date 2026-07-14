"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  User,
  Settings,
  Bell,
  CreditCard,
  Users,
  Sparkles,
  Gift,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileSection } from "./profile-section";
import { AccountSection } from "./account-section";
import { ConnectedAccountsSection } from "./connected-accounts-section";
import { NotificationsSection } from "./notifications-section";
import { BillingSection } from "./billing-section";
import { TeamSection } from "./team-section";
import { CreatorProfileSection } from "./creator-profile-section";
import { ReferralsSection } from "@/components/referral/referrals-section";
import type { ConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";

interface ReferralData {
  eligible: boolean;
  referralLink: string;
  clicks: number;
  conversions: number;
  earningsCents: number;
}

interface SettingsPageProps {
  defaultTab?:
    | "profile"
    | "account"
    | "connected"
    | "notifications"
    | "billing"
    | "team"
    | "creator-profile"
    | "referrals";
  referral?: ReferralData;
  connectedAccounts?: ConnectedAccount[];
}

const TABS = [
  { value: "profile", label: "Profile", icon: User },
  { value: "account", label: "Account", icon: Settings },
  { value: "connected", label: "Connected accounts", icon: AtSign },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "referrals", label: "Referrals", icon: Gift },
  { value: "team", label: "Team", icon: Users },
  { value: "creator-profile", label: "Creator Profile", icon: Sparkles },
] as const;

export function SettingsPage({ defaultTab = "profile", referral, connectedAccounts = [] }: SettingsPageProps) {
  return (
    // Left-anchored at the shared page rhythm (px-4/lg:px-6 pt-6) like every other
    // page header — the old mx-auto centering floated the block mid-canvas with a
    // dead left margin no sibling page has.
    <div className="max-w-4xl px-4 pb-24 pt-6 lg:px-6">
      <h1 className="mb-8 text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Settings</h1>

      <Tabs.Root
        defaultValue={defaultTab}
        className="flex flex-col gap-6 md:flex-row md:gap-8"
      >
        {/* Tab List - Horizontal scroll on mobile, vertical on desktop */}
        <Tabs.List className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:mx-0 md:w-48 md:flex-shrink-0 md:flex-col md:overflow-x-visible md:px-0 md:pb-0">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex min-h-[44px] flex-shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                "text-foreground-muted hover:bg-white/[0.04] hover:text-foreground-secondary",
                "data-[state=active]:bg-white/[0.06] data-[state=active]:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab Content - Right side on desktop, below on mobile */}
        <div className="flex-1 min-w-0">
          <Tabs.Content value="profile" className="outline-none">
            <ProfileSection />
          </Tabs.Content>
          <Tabs.Content value="account" className="outline-none">
            <AccountSection />
            <Credits />
          </Tabs.Content>
          <Tabs.Content value="connected" className="outline-none">
            <ConnectedAccountsSection accounts={connectedAccounts} />
          </Tabs.Content>
          <Tabs.Content value="notifications" className="outline-none">
            <NotificationsSection />
          </Tabs.Content>
          <Tabs.Content value="billing" className="outline-none">
            <BillingSection />
          </Tabs.Content>
          <Tabs.Content value="referrals" className="outline-none">
            <ReferralsSection
              eligible={referral?.eligible ?? false}
              referralLink={referral?.referralLink ?? ""}
              clicks={referral?.clicks ?? 0}
              conversions={referral?.conversions ?? 0}
              earningsCents={referral?.earningsCents ?? 0}
            />
          </Tabs.Content>
          <Tabs.Content value="team" className="outline-none">
            <TeamSection />
          </Tabs.Content>
          <Tabs.Content value="creator-profile" className="outline-none">
            <CreatorProfileSection />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

/**
 * CREDITS — the price of the licence, and it is not optional.
 *
 * The cortical surface the Room renders ("The brain") is a real FreeSurfer reconstruction from a
 * T1-weighted MRI, published by dgallichan under CC-BY-4.0. That licence permits commercial use and
 * requires credit, so the credit ships WITH the asset rather than as a follow-up. The same text is in
 * public/brain/LICENSE.txt, next to the file it describes.
 */
function Credits() {
  return (
    <section className="mt-10 border-t border-[var(--color-border)] pt-6">
      <h3 className="text-[12px] font-medium text-[var(--color-foreground-secondary)]">Credits</h3>
      <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-[var(--color-foreground-muted)]">
        The cortical surface rendered in The Room is based on{" "}
        <a
          href="https://sketchfab.com/3d-models/brain-cadd2bde67404c43b2359a6a3281d84a"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-[var(--cream-primary)]"
        >
          &ldquo;Brain&rdquo;
        </a>{" "}
        by{" "}
        <a
          href="https://sketchfab.com/dgallichan"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-[var(--cream-primary)]"
        >
          dgallichan
        </a>
        , licensed under{" "}
        <a
          href="http://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-[var(--cream-primary)]"
        >
          CC-BY-4.0
        </a>
        . Generated with FreeSurfer from a T1-weighted MRI scan, and modified for Maven.
      </p>
    </section>
  );
}
