import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWhopPlanId, WHOP_TRIAL_PLAN_IDS } from "@/lib/whop/config";
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

    // 3. ONE TRIAL PER ACCOUNT. `trial_used_at` is write-once history (stamped by the
    //    webhook the first time a trial window opens, never cleared) — an account that has
    //    already spent its $1 trial gets the FULL-PRICE SKU, quietly. The Whop embed shows
    //    the real price before any charge, and the response says which price was resolved
    //    (`trialApplied`) so the modal's copy can tell the truth too.
    //    `trial_started_at` is checked as a belt on pre-`trial_used_at` rows.
    //    Fail-open on a read error: never block a purchase to protect a $1 guard.
    let effectiveTrial = trial === true;
    let trialDenied = false;
    if (effectiveTrial) {
      try {
        // `*` not a column list — `trial_used_at` may predate its migration on some
        // environment, and naming a missing column rejects the whole SELECT.
        const { data } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        const row = data as Record<string, unknown> | null;
        if (row?.trial_used_at || row?.trial_started_at) {
          effectiveTrial = false;
          trialDenied = true;
        }
      } catch (err) {
        console.error("[checkout] trial-history read failed — allowing the trial", err);
      }
    }

    // 4. Resolve the Whop plan. A trial buys the $1 / 3-day SKU, which renews into the
    //    plan at its monthly price. An unconfigured plan is a 503, NOT a silent grant:
    //    better to tell the buyer checkout is down than to let them through unbilled.
    const whopProductId = resolveWhopPlanId(planId, { trial: effectiveTrial });

    if (!whopProductId) {
      console.error(
        `Whop plan id missing for "${planId}"${trial === true ? " (trial)" : ""} — set the env var.`
      );
      return NextResponse.json(
        { error: "Checkout is unavailable for this plan" },
        { status: 503 }
      );
    }

    // 5. Create Whop checkout session
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

    // 6. Handle Whop API errors
    if (!whopResponse.ok) {
      const errorData = await whopResponse.json().catch(() => ({}));
      console.error("Whop API error:", errorData);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    // 7. Return checkout configuration. `trialApplied` is what was actually RESOLVED —
    //    false when the trial was denied (already used) or its SKU isn't configured —
    //    so the modal's heading can match the price the embed will show.
    const trialApplied = effectiveTrial && whopProductId === WHOP_TRIAL_PLAN_IDS[planId];
    const whopData = await whopResponse.json();
    return NextResponse.json(
      {
        checkoutConfigId: whopData.id,
        planId,
        trialApplied,
        trialDenied,
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
