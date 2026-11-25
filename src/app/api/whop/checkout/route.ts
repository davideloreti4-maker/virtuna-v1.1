import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWhopPlanId, WHOP_TRIAL_PLAN_IDS } from "@/lib/whop/config";
import { isPaidPlanId } from "@/lib/pricing";
import { hasUsedTrial } from "@/lib/billing/trial-eligibility";
import { checkoutReferrer, recordAttributed, type SubscriptionRead } from "@/lib/earn/referrer-of";
import { whopBaseUrl, whopSettings } from "@/lib/earn/whop-affiliates";

/** Whop's current checkout-session endpoint. Exported so the test can pin it. */
export const WHOP_CHECKOUT_ENDPOINT =
  "https://api.whop.com/api/v1/checkout_configurations";

/**
 * Where the checkout is created. One address for Whop (Earn, ruling 25): with `WHOP_API_BASE_URL` set (the
 * sandbox) the checkout follows it, as the affiliate calls do, so a sandbox test runs the whole path there.
 * Absent or blank, it is `WHOP_CHECKOUT_ENDPOINT`, exactly as before; an address that is not https is not
 * used either (the key would travel in the clear).
 */
function checkoutEndpoint(): string {
  return process.env.WHOP_API_BASE_URL?.trim() ? `${whopBaseUrl()}/checkout_configurations` : WHOP_CHECKOUT_ENDPOINT;
}

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
    const { planId, trial, funnel } = body;

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
    //    The predicate lives in `lib/billing/trial-eligibility` because `/api/subscription`
    //    has to answer the SAME question for the UI — a CTA that promises a price this route
    //    then refuses is the chargeback shape we are avoiding.
    //    Fail-open on a read error: never block a purchase to protect a $1 guard.
    //    The row is read at most ONCE per request: Earn's attribution (step 5) asks for the same
    //    read instead of making a second one.
    let subscriptionRead: Promise<SubscriptionRead> | undefined;
    const readSubscription = () =>
      (subscriptionRead ??= (async () => {
        // `*` not a column list — `trial_used_at` may predate its migration on some
        // environment, and naming a missing column rejects the whole SELECT.
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        return { data: data as Record<string, unknown> | null, error };
      })());
    let effectiveTrial = trial === true;
    let trialDenied = false;
    if (effectiveTrial) {
      try {
        const { data } = await readSubscription();
        if (hasUsedTrial(data)) {
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

    // 5. Create the Whop checkout session.
    //    ⚠️ ENDPOINT: `/api/v1/checkout_configurations`. This used to POST
    //    `/api/v5/checkout_sessions`, which Whop has REMOVED — it answers 404, so every
    //    checkout would have 500'd on the first real customer. It was never caught because
    //    the route's test stubs `fetch` wholesale and asserted only the request body, never
    //    the URL (the test below now pins the URL too). The v1 endpoint takes the same
    //    fields and returns `id` as a `ch_…` checkout-session id, which is exactly what
    //    `<WhopCheckoutEmbed sessionId>` consumes.
    //    Earn (rulings 29 to 32 and 35, any look): the first purchase of a buyer who opened an
    //    enrolled creator's link names that creator's Whop username as `affiliate_code`, so Whop
    //    tracks the sale and pays them. Who that is comes from the request's own referral cookies
    //    and the server's reads (src/lib/earn/referrer-of.ts), never from the body. The lookup never
    //    throws and gives up after a second; without a referrer the request is exactly what it was
    //    before, and nothing is looked up when there is no cookie or Whop is not configured.
    const referrer = await checkoutReferrer({
      configured: whopSettings() !== null,
      buyer: user,
      cookies: request.headers.get("cookie"),
      subscription: readSubscription,
    });
    const createCheckout = (affiliateCode: string | null) =>
      fetch(
        checkoutEndpoint(),
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
            // The funnel's buyer is an anonymous visitor mid-drill: any full-page redirect
            // out of the embed must land them back in their room, not on /settings. The two
            // paths are server-side literals (never client-supplied), so no open-redirect
            // surface is added.
            redirect_url: `${
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
            }${
              funnel === true
                ? "/home?checkout=success"
                : "/settings?tab=billing&checkout=success"
            }`,
            ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
          }),
        }
      );
    let whopResponse = await createCheckout(referrer?.affiliateCode ?? null);
    const attributed = referrer !== null && whopResponse.ok;
    if (referrer && !whopResponse.ok) {
      // A referral never costs a sale (ruling 32): whatever Whop refused, the same checkout is
      // sent once more without the code, and from here the route answers as it always has. Only
      // the status is logged: the refusal's body may name the referrer.
      console.error(
        `[checkout] whop refused a checkout with an affiliate code (${whopResponse.status}); sent again without it`
      );
      // The refused answer is never read: its body is let go, so its connection is not held. Not
      // waited for, and it cannot throw into the checkout.
      void whopResponse.body?.cancel().catch(() => {});
      whopResponse = await createCheckout(null);
    }

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
    // Earn (ruling 31): the attributed buyer's referral row, written by the server once the
    // checkout exists. It never throws and gives up after a second: the answer below is the same
    // whether or not the row was written.
    if (referrer && attributed) await recordAttributed(referrer, user.id);
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
