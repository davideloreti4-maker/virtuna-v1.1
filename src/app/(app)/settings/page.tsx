import { Metadata } from "next";
import { SettingsPage } from "@/components/app/settings";
import { createClient } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral/code-generator";
import { getUserTier } from "@/lib/whop/subscription";
import { hasAccessToTier } from "@/lib/whop/config";

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

  const referral = {
    eligible,
    referralLink: "",
    clicks: 0,
    conversions: 0,
    earningsCents: 0,
  };

  if (user && eligible) {
    let { data: codeData } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!codeData) {
      for (let i = 0; i < 5; i++) {
        const code = generateReferralCode();
        const { data, error } = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id, code })
          .select("code")
          .single();
        if (!error && data) {
          codeData = data;
          break;
        }
        if (error?.code !== "23505") break; // retry only on unique-constraint collision
      }
    }

    const referralCode = codeData?.code ?? "";

    const { count: clicksCount } = await supabase
      .from("referral_clicks")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", user.id);

    const { data: conversions } = await supabase
      .from("referral_conversions")
      .select("bonus_cents")
      .eq("referrer_user_id", user.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    referral.referralLink = `${appUrl}/?ref=${referralCode}`;
    referral.clicks = clicksCount ?? 0;
    referral.conversions = conversions?.length ?? 0;
    referral.earningsCents = conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) ?? 0;
  }

  return <SettingsPage defaultTab={defaultTab} referral={referral} />;
}
