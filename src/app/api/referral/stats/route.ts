import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count: clicksCount } = await supabase
    .from("referral_clicks")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", user.id);

  const { data: conversions } = await supabase
    .from("referral_conversions")
    .select("bonus_cents")
    .eq("referrer_user_id", user.id);

  const totalClicks = clicksCount || 0;
  const totalConversions = conversions?.length || 0;
  const totalEarningsCents =
    conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) || 0;

  return NextResponse.json({
    clicks: totalClicks,
    conversions: totalConversions,
    earningsCents: totalEarningsCents,
  });
}
