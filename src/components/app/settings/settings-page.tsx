"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { User, Settings, Bell, CreditCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileSection } from "./profile-section";
import { AccountSection } from "./account-section";
import { NotificationsSection } from "./notifications-section";
import { BillingSection } from "./billing-section";
import { TeamSection } from "./team-section";

interface SettingsPageProps {
  defaultTab?: "profile" | "account" | "notifications" | "billing" | "team";
}

const TABS = [
  { value: "profile", label: "Profile", icon: User },
  { value: "account", label: "Account", icon: Settings },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "team", label: "Team", icon: Users },
] as const;

export function SettingsPage({ defaultTab = "profile" }: SettingsPageProps) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-semibold text-white">Settings</h1>

      <Tabs.Root
        defaultValue={defaultTab}
        className="flex flex-col gap-6 md:flex-row md:gap-8"
      >
        {/* Tab List - Horizontal scroll on mobile, vertical on desktop */}
        <Tabs.List className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-2 md:mx-0 md:w-48 md:flex-shrink-0 md:flex-col md:overflow-x-visible md:px-0 md:pb-0">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex min-h-[44px] flex-shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300",
                "data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
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
          </Tabs.Content>
          <Tabs.Content value="notifications" className="outline-none">
            <NotificationsSection />
          </Tabs.Content>
          <Tabs.Content value="billing" className="outline-none">
            <BillingSection />
          </Tabs.Content>
          <Tabs.Content value="team" className="outline-none">
            <TeamSection />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
