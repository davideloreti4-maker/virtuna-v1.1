import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWhopPlanId } from "@/lib/whop/config";
import { isPaidPlanId } from "@/lib/pricing";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { planId, trial } = body;

    if (!isPaidPlanId(planId)) {
      return NextResponse.json(
        { error: "Invalid planId. Must be 'starter', 'pro' or 'studio'" },
        { status: 400 }
      );
    }

    // 3. Resolve the Whop plan. `trial: true` buys the $1 / 3-day SKU, which renews into
    //    the plan at its monthly price. An unconfigured plan is a 503, NOT a silent grant:
    //    better to tell the buyer checkout is down than to let them through unbilled.
    const whopProductId = resolveWhopPlanId(planId, { trial: trial === true });

    if (!whopProductId) {
      console.error(
        `Whop plan id missing for "${planId}"${trial === true ? " (trial)" : ""} — set the env var.`
      );
      return NextResponse.json(
        { error: "Checkout is unavailable for this plan" },
        { status: 503 }
      );
    }

    // 4. Create Whop checkout session
    const whopResponse = await fetch(
      "https://api.whop.com/api/v5/checkout_sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: whopProductId,
          metadata: {
            supabase_user_id: user.id,
            supabase_email: user.email,
          },
          redirect_url: `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/settings?tab=billing&checkout=success`,
        }),
      }
    );

    // 5. Handle Whop API errors
    if (!whopResponse.ok) {
      const errorData = await whopResponse.json().catch(() => ({}));
      console.error("Whop API error:", errorData);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    // 6. Return checkout configuration
    const whopData = await whopResponse.json();
    return NextResponse.json(
      {
        checkoutConfigId: whopData.id,
        planId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
