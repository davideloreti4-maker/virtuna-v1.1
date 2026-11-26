import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { mapWhopProductToTier } from "@/lib/whop/config";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { fetchWhopMembershipRecord, periodEndOf } from "@/lib/whop/membership";

const log = createLogger({ module: "cron/sync-whop" });

/** Whop statuses that still entitle the customer to their tier. */
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/** Statuses that keep the tier but flag billing trouble. */
const PAST_DUE_STATUSES = new Set(["past_due"]);

/**
 * GET /api/cron/sync-whop
 *
 * Periodic sync of all Whop memberships (webhook fallback).
 * Called by Vercel Cron or external scheduler.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();

    // Get all subscriptions linked to Whop
    const { data: subscriptions, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .not("whop_membership_id", "is", null);

    if (fetchError) {
      log.error("Failed to fetch subscriptions", { error: fetchError.message });
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    let syncedCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each subscription sequentially
    for (const subscription of subscriptions || []) {
      try {
        // Fetch membership from Whop (the shared request; see `WhopMembership` there for the shape).
        const membership = await fetchWhopMembershipRecord(subscription.whop_membership_id!);
        if (!membership) {
          throw new Error("Whop API returned 404");
        }

        // The SKU decides the tier. The checkout sends `plan_id`, so the PLAN id is the
        // identity our env vars hold — prefer it, fall back through the older spellings.
        const skuId =
          membership.plan?.id ??
          membership.plan_id ??
          membership.product?.id ??
          membership.product_id ??
          "";

        const entitled = ENTITLED_STATUSES.has(membership.status);
        const pastDue = PAST_DUE_STATUSES.has(membership.status);

        // `past_due` KEEPS the tier. A failed charge is retried by Whop, and the webhook's
        // `payment.failed` branch also only flags the status — dropping access here would
        // make the cron revoke a customer that the webhook path deliberately keeps, so a
        // card that needs one retry would silently lock someone out mid-month. Access ends
        // only on a real deactivation (canceled/expired/completed).
        const mappedTier = mapWhopProductToTier(skuId);
        if ((entitled || pastDue) && mappedTier === "free") {
          // Never let an unrecognised SKU silently demote someone who is still paying —
          // that is a config bug (an unset WHOP_*_ID), so fail this row loudly and leave
          // the existing subscription untouched.
          throw new Error(
            `membership ${membership.id} is ${membership.status} but SKU "${skuId}" matches no configured plan id`
          );
        }

        const tier = entitled || pastDue ? mappedTier : "free";
        const status = entitled ? "active" : pastDue ? "past_due" : "cancelled";

        // Whop sends the period end as a Unix timestamp (seconds) or an ISO string.
        const currentPeriodEnd = periodEndOf(membership.renewal_period_end);

        // Update subscription
        const { error: updateError } = await supabase
          .from("user_subscriptions")
          .update({
            virtuna_tier: tier,
            status,
            current_period_end: currentPeriodEnd,
            last_synced_at: new Date().toISOString(),
          })
          .eq("user_id", subscription.user_id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        syncedCount++;
      } catch (error) {
        // Log error but continue processing other subscriptions
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error("Failed to sync user", { userId: subscription.user_id, error: errorMessage });
        errors.push({
          userId: subscription.user_id,
          error: errorMessage,
        });
      }
    }

    // Return summary
    return NextResponse.json({
      synced: syncedCount,
      total: subscriptions?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error("Cron sync failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
