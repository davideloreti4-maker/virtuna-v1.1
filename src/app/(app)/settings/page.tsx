import { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/app/settings";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";
import { ensureReferralCode, referralLink } from "@/lib/referral/ensure-code";
import { getUserTier } from "@/lib/whop/subscription";
import { hasAccessToTier } from "@/lib/whop/config";
import {
  listConnectedAccounts,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";

export const metadata: Metadata = {
  title: "Settings | Maven",
  description: "Manage your account settings and preferences",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = [
  "profile",
  "account",
  "connected",
  "notifications",
  "billing",
  "team",
  "creator-profile",
  "referrals",
] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function Settings({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  // New look (Earn, ruling 3): the referral link lives on /earn, for every account; Settings has no
  // Referrals tab there, so its address leads to Earn. Flag off: as before.
  if (NEW_LOOK_ENABLED && tabParam === "referrals") redirect("/earn");
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "profile";

  // Referrals tab — Pro-gated; only fetch the code + stats when the user is eligible.
  // (Demoted here from the retired /grow hub — it's Maven's growth mechanic, not creator
  // content value, so it lives with account/billing.)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tier = await getUserTier();
  const eligible = hasAccessToTier(tier, "pro");

  // Connected accounts — the "Connected accounts" tab lists them with connect / make-primary /
  // disconnect. Read server-side (RLS-scoped); empty on error → the section shows its empty state.
  let connectedAccounts: ConnectedAccount[] = [];
  if (user) {
    try {
      connectedAccounts = await listConnectedAccounts(supabase, user.id);
    } catch {
      connectedAccounts = [];
    }
  }

  const referral = {
    eligible,
    referralLink: "",
    clicks: 0,
    conversions: 0,
    earningsCents: 0,
  };

  // Under the new look the tab is not listed (ruling 3), so nothing of it is read or made here.
  if (user && eligible && !NEW_LOOK_ENABLED) {
    // Made on first view; retried only when the code was taken (src/lib/referral/ensure-code.ts).
    const referralCode = (await ensureReferralCode(supabase, user.id)) ?? "";

    const { count: clicksCount } = await supabase
      .from("referral_clicks")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", user.id);

    const { data: conversions } = await supabase
      .from("referral_conversions")
      .select("bonus_cents")
      .eq("referrer_user_id", user.id);

    referral.referralLink = referralLink(referralCode);
    referral.clicks = clicksCount ?? 0;
    referral.conversions = conversions?.length ?? 0;
    referral.earningsCents = conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) ?? 0;
  }

  return (
    <SettingsPage
      defaultTab={defaultTab}
      referral={referral}
      connectedAccounts={connectedAccounts}
    />
  );
}
