import { NextResponse } from "next/server";
import { getUserSubscription, getUserTier } from "@/lib/whop/subscription";

export async function GET() {
  try {
    const [tier, subscription] = await Promise.all([
      getUserTier(),
      getUserSubscription(),
    ]);

    if (!subscription) {
      return NextResponse.json({
        tier: "free",
        status: "active",
        whopConnected: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        isTrial: false,
        trialEndsAt: null,
      });
    }

    return NextResponse.json({
      tier,
      status: subscription.status,
      whopConnected: !!subscription.whop_membership_id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      currentPeriodEnd: subscription.current_period_end,
      isTrial: subscription.is_trial ?? false,
      trialEndsAt: subscription.trial_ends_at ?? null,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
