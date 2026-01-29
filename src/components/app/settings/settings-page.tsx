"use client";

import { useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { User, Settings, Bell, CreditCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
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
  const _hydrate = useSettingsStore((s) => s._hydrate);
  const _isHydrated = useSettingsStore((s) => s._isHydrated);

  // Hydrate store on mount
  useEffect(() => {
    _hydrate();
  }, [_hydrate]);

  if (!_isHydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-semibold text-white">Settings</h1>

      <Tabs.Root
        defaultValue={defaultTab}
        orientation="vertical"
        className="flex gap-8"
      >
        {/* Tab List - Left side */}
        <Tabs.List className="flex w-48 flex-shrink-0 flex-col gap-1">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300",
                "data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab Content - Right side */}
        <div className="flex-1">
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
