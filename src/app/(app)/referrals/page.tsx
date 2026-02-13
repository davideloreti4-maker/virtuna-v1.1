import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral/code-generator";
import { ReferralLinkCard } from "@/components/referral/ReferralLinkCard";
import { ReferralStatsCard } from "@/components/referral/ReferralStatsCard";

export const metadata: Metadata = {
  title: "Referrals | Artificial Societies",
  description: "Share Virtuna and earn rewards for every conversion.",
};

export default async function ReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch existing referral code
  let { data: codeData } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  // If no code exists, generate and insert one
  if (!codeData) {
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
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
      // Unique constraint violation — retry
      if (error?.code !== "23505") break;
    }
  }

  const referralCode = codeData?.code ?? "";

  // Fetch stats
  const { count: clicksCount } = await supabase
    .from("referral_clicks")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", user.id);

  const { data: conversions } = await supabase
    .from("referral_conversions")
    .select("bonus_cents")
    .eq("referrer_user_id", user.id);

  const totalClicks = clicksCount ?? 0;
  const totalConversions = conversions?.length ?? 0;
  const totalEarningsCents =
    conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) ?? 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referralLink = `${appUrl}/?ref=${referralCode}`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Referral Program
        </h1>
        <p className="text-muted">
          Invite friends to Virtuna and earn $10 for every successful
          conversion.
        </p>
      </div>

      <ReferralLinkCard referralLink={referralLink} />
      <ReferralStatsCard
        clicks={totalClicks}
        conversions={totalConversions}
        earningsCents={totalEarningsCents}
      />
    </div>
  );
}
