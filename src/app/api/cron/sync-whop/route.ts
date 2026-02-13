import { NextResponse } from "next/server";
import { mapWhopProductToTier } from "@/lib/whop/config";
import { createServiceClient } from "@/lib/supabase/service";

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
  try {
    // Verify cron secret authorization
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get all subscriptions linked to Whop
    const { data: subscriptions, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .not("whop_membership_id", "is", null);

    if (fetchError) {
      console.error("Failed to fetch subscriptions:", fetchError);
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
        console.error(`Failed to sync user ${subscription.user_id}:`, errorMessage);
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
    console.error("Cron sync failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
