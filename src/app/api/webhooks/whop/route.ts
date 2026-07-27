import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  describeSignatureFailure,
} from "@/lib/whop/webhook-verification";
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

/**
 * The event name, in one spelling, whatever Whop actually sent.
 *
 * Two independent ambiguities, both observed against the live API on 2026-07-26 and neither
 * resolvable from the docs:
 *
 *  1. **The key.** Whop's classic payload carries the event under `action`; newer shapes use
 *     `event`. Reading only one and finding it `undefined` sends every delivery to `default`,
 *     which is silent — the customer pays and no tier is granted.
 *  2. **The separator.** The webhook API only ACCEPTS underscored subscription names
 *     (`membership_went_valid`) and echoes them back underscored, but the historical payload
 *     spelling is dotted (`membership.went_valid`). Whop even stores them inconsistently —
 *     the same webhook came back holding `membership_went_valid` and `payment.failed`.
 *
 * So: take either key, and fold the FIRST underscore to a dot (only the first — the resource
 * prefix is what it separates; `membership_cancel_at_period_end_changed` must become
 * `membership.cancel_at_period_end_changed`, not a string of dots).
 */
export function normalizeEventName(payload: {
  event?: unknown;
  action?: unknown;
  type?: unknown;
}): string {
  // ⚠️ `type` is where the v2 payload actually puts it. Verified against a real purchase
  // 2026-07-27: the delivery carried keys ["id","api_version","timestamp","data","type",
  // "company_id"] — no `event`, no `action`. Reading only those two resolved the name to "",
  // fell through to `default:`, and answered 200 {received:true} having granted NOTHING.
  // The customer had paid. Signature verification passed. Nothing looked wrong anywhere.
  // Checked last so a payload that does carry `event`/`action` keeps its existing meaning.
  const raw = payload?.event ?? payload?.action ?? payload?.type;
  if (typeof raw !== "string" || !raw) return "";
  return raw.includes(".") ? raw : raw.replace("_", ".");
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
      // A silent 401 here cost a full diagnosis round-trip on 2026-07-27: a SECOND
      // Whop webhook had been created against this same URL, signing with its own
      // secret, and from the logs that was indistinguishable from the header-name bug
      // this module had just been fixed for. The failure has to say which shape arrived.
      // Log NAMES and the webhook id only — never the signature, never the body.
      log.warn("Webhook signature rejected", {
        header_names_seen: [
          "webhook-id",
          "webhook-timestamp",
          "webhook-signature",
          "svix-id",
          "svix-timestamp",
          "svix-signature",
        ].filter((name) => request.headers.get(name) !== null),
        webhook_id:
          request.headers.get("webhook-id") ??
          request.headers.get("svix-id") ??
          null,
        ...describeSignatureFailure(body, request.headers, secret),
      });
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const data = payload.data;
    const event = normalizeEventName(payload);

    // Create service role client (bypasses RLS)
    const supabase = createServiceClient();

    // Handle webhook events
    switch (event) {
      // "this membership is now valid" — grant the tier.
      //
      // ⚠️ VERIFIED AGAINST THE LIVE API 2026-07-26: `membership_went_valid` /
      // `membership_went_invalid` / `payment_failed` are the ONLY membership-and-payment
      // events Whop accepts on a webhook subscription. `membership.activated` and
      // `membership.deactivated` appear in Whop's published event list but the webhook
      // endpoint REJECTS them ("is not a valid event") on every api_version — so they are
      // not reachable and are not handled here. Do not "modernise" these names without
      // re-probing the API; the docs and the API disagree.
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

      // "no longer valid" — cancellation, expiry, or a failed payment that exhausted its
      // retries. (`membership.deactivated` is NOT a subscribable Whop event; see above.)
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

      // A failed charge. Whop puts this on the PAYMENT, not the membership — the webhook
      // API rejects `membership.payment_failed`, so `payment.failed` is the real signal
      // (verified live 2026-07-26). The membership stays valid while Whop retries, and
      // `membership.went_invalid` arrives only if the retries are exhausted — so this case
      // marks `past_due` and deliberately NEVER drops the tier. A card that needs one retry
      // must not lock a paying customer out mid-month.
      case "payment.failed": {
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
        // WARN, not info. An event we do not recognise is the exact shape the old bug took:
        // a subscribed, signature-valid delivery that quietly changes nothing. Log the raw
        // spelling and the payload keys so the first sandbox event tells us what Whop really
        // sends, instead of us guessing from docs that have already been wrong twice.
        log.warn("Unhandled webhook event", {
          event,
          raw_event: payload?.event ?? payload?.action ?? null,
          payload_keys: Object.keys(payload ?? {}),
          data_keys: Object.keys(data ?? {}),
        });
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
