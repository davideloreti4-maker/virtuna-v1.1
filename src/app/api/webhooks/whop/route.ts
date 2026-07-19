import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/whop/webhook-verification";
import { mapWhopProductToTier, isTrialPlanId } from "@/lib/whop/config";
import { TRIAL } from "@/lib/pricing";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "webhook/whop" });

/** The trial window a $1 purchase opens: `TRIAL.days` from the moment it is granted. */
function trialWindowFrom(now: Date) {
  const ends = new Date(now.getTime() + TRIAL.days * 24 * 60 * 60 * 1000);
  return {
    trial_started_at: now.toISOString(),
    trial_ends_at: ends.toISOString(),
    is_trial: true, // denormalised flag; the window is the truth the quota check reads
    // HISTORY, not state: never cleared (the full-price branch nulls the window fields but
    // not this). The one-trial-per-account guard in api/whop/checkout reads it.
    trial_used_at: now.toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    // Read raw body
    const body = await request.text();

    // Get webhook headers
    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    };

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      body,
      headers,
      process.env.WHOP_WEBHOOK_SECRET!
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const { event, data } = payload;

    // Create service role client (bypasses RLS)
    const supabase = createServiceClient();

    // Handle webhook events
    switch (event) {
      case "membership.went_valid": {
        const supabaseUserId = data.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event: "membership.went_valid",
            whop_user_id: data.user_id,
            membership_id: data.id,
          });
          return NextResponse.json({ received: true });
        }

        const tier = mapWhopProductToTier(data.product_id);

        // TRIAL POOL. A $1 SKU grants the plan's TIER but only 50 credits (TRIAL.credits),
        // so the subscription has to remember when the trial runs.
        //
        // The window is stamped ONCE, on the first grant of a given membership. A trial SKU
        // renews into its plan price under the SAME plan id, and Whop re-sends went_valid on
        // renewal — re-stamping there would hand the customer a fresh 50-credit trial (and
        // re-cap a now-paying Pro at 50) every billing cycle. So: only stamp when this
        // membership has no window yet; leave it alone forever after.
        const isTrial = isTrialPlanId(data.product_id);
        const now = new Date();

        const { data: existing } = await supabase
          .from("user_subscriptions")
          .select("whop_membership_id, trial_started_at")
          .eq("user_id", supabaseUserId)
          .maybeSingle();

        const sameMembership = existing?.whop_membership_id === data.id;
        const alreadyStamped = sameMembership && Boolean(existing?.trial_started_at);

        const trialFields = isTrial
          ? alreadyStamped
            ? {} // trial already running (or already converted) — never re-open it
            : trialWindowFrom(now)
          : // A full-price plan: not a trial, and any window from a previous membership must
            // not linger and cap a paying customer at 5.
            { trial_started_at: null, trial_ends_at: null, is_trial: false };

        const { error } = await supabase
          .from("user_subscriptions")
          .upsert(
            {
              user_id: supabaseUserId,
              whop_user_id: data.user_id,
              whop_membership_id: data.id,
              whop_product_id: data.product_id,
              virtuna_tier: tier,
              status: "active",
              current_period_end: data.renewal_period_end,
              updated_at: now.toISOString(),
              ...trialFields,
            },
            { onConflict: "user_id" }
          );

        if (error) {
          log.error("Failed to upsert subscription", { event: "membership.went_valid", error: error.message });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      case "membership.went_invalid": {
        const supabaseUserId = data.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event: "membership.went_invalid",
            whop_user_id: data.user_id,
            membership_id: data.id,
          });
          return NextResponse.json({ received: true });
        }

        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            virtuna_tier: "free",
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", supabaseUserId);

        if (error) {
          log.error("Failed to update subscription", { event: "membership.went_invalid", error: error.message });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      case "membership.payment_failed": {
        const supabaseUserId = data.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event: "membership.payment_failed",
            whop_user_id: data.user_id,
            membership_id: data.id,
          });
          return NextResponse.json({ received: true });
        }

        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", supabaseUserId);

        if (error) {
          log.error("Failed to update subscription", { event: "membership.payment_failed", error: error.message });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      default:
        log.info("Unknown webhook event", { event });
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error("Webhook handler error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
