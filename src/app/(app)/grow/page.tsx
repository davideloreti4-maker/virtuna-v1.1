import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import { getMockCalendar } from "@/lib/room-contract/mock-room";
import { generateReferralCode } from "@/lib/referral/code-generator";
import { getUserTier } from "@/lib/whop/subscription";
import { hasAccessToTier } from "@/lib/whop/config";
import { GrowHub, type GrowTab } from "@/components/grow/grow-hub";

export const metadata: Metadata = {
  title: "Grow | Maven",
  description: "Your business — numbers, monetization, and referrals, pre-tested on your people.",
};

const TAB_SET = new Set<GrowTab>(["numbers", "monetize", "referrals"]);

/**
 * /grow — the GROW hub (Surfaces IA rationalization). Folds the old /analytics, /grow, and
 * /referrals surfaces into one tabbed destination. Auth-gated, inside (app) so it inherits
 * AppShell + ToastProvider. `?tab=` deep-links a tab (the /analytics + /referrals redirects
 * set it); default is Numbers.
 *
 * Data spine: Numbers is REAL (account_snapshots); Monetize is MOCK v1 (Directional forecasts);
 * Referrals is REAL (referral_codes/clicks/conversions), Pro-gated.
 */
export default async function GrowRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { tab } = await searchParams;
  const initialTab: GrowTab = TAB_SET.has(tab as GrowTab) ? (tab as GrowTab) : "numbers";

  // Numbers tab — real account metrics + pillars for the recommendations block.
  let snapshots: AccountSnapshot[] = [];
  try {
    snapshots = await getAccountSnapshots(supabase, user.id, 100);
  } catch {
    snapshots = [];
  }
  const pillars = getMockCalendar().pillars;

  // Referrals tab — Pro-gated; only fetch the code + stats when the user is eligible.
  const tier = await getUserTier();
  const eligible = hasAccessToTier(tier, "pro");
  let referral = {
    eligible,
    referralLink: "",
    clicks: 0,
    conversions: 0,
    earningsCents: 0,
  };

  if (eligible) {
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

    referral = {
      eligible,
      referralLink: `${appUrl}/?ref=${referralCode}`,
      clicks: clicksCount ?? 0,
      conversions: conversions?.length ?? 0,
      earningsCents: conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) ?? 0,
    };
  }

  return (
    <GrowHub initialTab={initialTab} snapshots={snapshots} pillars={pillars} referral={referral} />
  );
}
