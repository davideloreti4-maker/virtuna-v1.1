import { Metadata } from "next";
import { SettingsPage } from "@/components/app/settings";

export const metadata: Metadata = {
  title: "Settings | Virtuna",
  description: "Manage your account settings and preferences",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = ["profile", "account", "notifications", "billing", "team"] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function Settings({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "profile";

  return <SettingsPage defaultTab={defaultTab} />;
}
