import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { mapWhopProductToTier } from "@/lib/whop/config";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/sync-whop" });

interface WhopMembership {
  id: string;
  product_id: string;
  valid: boolean;
  expires_at: number | null;
  cancel_at_period_end: boolean;
}

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
        // Fetch membership from Whop
        const whopResponse = await fetch(
          `https://api.whop.com/api/v5/memberships/${subscription.whop_membership_id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
            },
          }
        );

        if (!whopResponse.ok) {
          throw new Error(`Whop API returned ${whopResponse.status}`);
        }

        const membership: WhopMembership = await whopResponse.json();

        // Map product to tier
        const tier = mapWhopProductToTier(membership.product_id);

        // Determine status
        const status = membership.valid ? "active" : "cancelled";

        // Calculate period end (Whop returns Unix timestamp in seconds)
        const currentPeriodEnd = membership.expires_at
          ? new Date(membership.expires_at * 1000).toISOString()
          : null;

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
