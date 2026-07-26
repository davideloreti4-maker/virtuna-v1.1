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

/** Only the fields we read off a Whop webhook, each optional across payload versions. */
type WhopWebhookData = {
  id?: string;
  user_id?: string;
  metadata?: { supabase_user_id?: string };
  plan?: { id?: string; metadata?: { supabase_user_id?: string } };
  product?: { id?: string };
  plan_id?: string;
  product_id?: string;
  checkout_session?: { metadata?: { supabase_user_id?: string } };
  renewal_period_end?: number | string | null;
  expires_at?: number | string | null;
};

/**
 * The Whop SKU this membership was bought on — what `mapWhopProductToTier` and
 * `isTrialPlanId` match against, and therefore what decides the tier AND whether the
 * 50-credit trial window opens.
 *
 * ⚠️ Read defensively. The checkout call sends `plan_id`, so the PLAN id is the identity
 * that matters (our `WHOP_PRODUCT_ID_*` env vars hold plan ids despite their name). The
 * v1 membership resource nests it as `plan.id`; older payloads sent a flat `product_id`.
 * Take the first that exists rather than betting on one spelling — a miss here silently
 * grants tier `free` to someone who just paid.
 */
function skuIdOf(data: WhopWebhookData): string {
  return (
    data?.plan?.id ??
    data?.plan_id ??
    data?.product?.id ??
    data?.product_id ??
    ""
  );
}

/** The Supabase user id we stamped into checkout metadata, wherever Whop echoes it back. */
function supabaseUserIdOf(data: WhopWebhookData): string | undefined {
  return (
    data?.metadata?.supabase_user_id ??
    data?.plan?.metadata?.supabase_user_id ??
    data?.checkout_session?.metadata?.supabase_user_id
  );
}

/** Whop sends period ends as a Unix timestamp (seconds) or an ISO string, depending on age. */
function periodEndOf(data: WhopWebhookData): string | null {
  const raw = data?.renewal_period_end ?? data?.expires_at ?? null;
  if (raw == null) return null;
  if (typeof raw === "number") return new Date(raw * 1000).toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function POST(request: Request) {
  try {
    // Read raw body
    const body = await request.text();

    const secret = process.env.WHOP_WEBHOOK_SECRET;
    if (!secret) {
      // Fail CLOSED. An unset secret must never be read as "nothing to verify" —
      // that would let anyone grant themselves a tier by POSTing this route.
      log.error("WHOP_WEBHOOK_SECRET is unset — rejecting webhook");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    // Verify webhook signature. `request.headers` is passed whole: Whop sends the
    // Standard Webhooks names (`webhook-id`/`-timestamp`/`-signature`) and the verifier
    // falls back to the legacy `svix-*` spellings.
    const isValid = verifyWebhookSignature(body, request.headers, secret);

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
      // `membership.activated` is Whop's CURRENT name for "this membership is now valid".
      // It replaced `membership.went_valid`, which no longer fires — the old case fell
      // through to `default` and logged "Unknown webhook event", so a paying customer was
      // never granted a tier. `membership.went_valid` is kept as an alias in case an older
      // webhook version is configured on the endpoint.
      case "membership.activated":
      case "membership.went_valid": {
        const supabaseUserId = supabaseUserIdOf(data);

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event,
            whop_user_id: data.user_id,
            membership_id: data.id,
          });
          return NextResponse.json({ received: true });
        }

        const skuId = skuIdOf(data);
        const tier = mapWhopProductToTier(skuId);

        if (tier === "free") {
          // The SKU did not match ANY configured plan id. Granting `free` to someone whose
          // payment just cleared is the wrong outcome, so make it loud rather than silent:
          // this is either an unset WHOP_*_ID env var or a payload shape we misread.
          log.error("Whop SKU matched no configured plan — granting free", {
            event,
            sku_id: skuId,
            membership_id: data.id,
            payload_keys: Object.keys(data ?? {}),
          });
        }

        // TRIAL POOL. A $1 SKU grants the plan's TIER but only 50 credits (TRIAL.credits),
        // so the subscription has to remember when the trial runs.
        //
        // The window is stamped ONCE, on the first grant of a given membership. A trial SKU
        // renews into its plan price under the SAME plan id, and Whop re-sends went_valid on
        // renewal — re-stamping there would hand the customer a fresh 50-credit trial (and
        // re-cap a now-paying Pro at 50) every billing cycle. So: only stamp when this
        // membership has no window yet; leave it alone forever after.
        const isTrial = isTrialPlanId(skuId);
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
              whop_product_id: skuId,
              virtuna_tier: tier,
              status: "active",
              current_period_end: periodEndOf(data),
              updated_at: now.toISOString(),
              ...trialFields,
            },
            { onConflict: "user_id" }
          );

        if (error) {
          log.error("Failed to upsert subscription", { event, error: error.message });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      // Current name for "no longer valid" — cancellation, expiry, or a failed payment
      // that exhausted its retries. Replaced `membership.went_invalid`.
      case "membership.deactivated":
      case "membership.went_invalid": {
        const supabaseUserId = supabaseUserIdOf(data);

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event,
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
          log.error("Failed to update subscription", { event, error: error.message });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      // A failed charge. Whop's current taxonomy puts this on the PAYMENT, not the
      // membership (`membership.payment_failed` no longer fires); `invoice.past_due` is
      // the invoice-side signal for the same condition. The membership itself stays valid
      // until retries are exhausted, at which point `membership.deactivated` arrives — so
      // this case only marks `past_due`, it never drops the tier.
      case "payment.failed":
      case "invoice.past_due":
      case "membership.payment_failed": {
        const supabaseUserId = supabaseUserIdOf(data);

        if (!supabaseUserId) {
          log.warn("Missing supabase_user_id in metadata", {
            event,
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
          log.error("Failed to update subscription", { event, error: error.message });
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
