import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/whop/webhook-verification";
import { mapWhopProductToTier } from "@/lib/whop/config";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "webhook/whop" });

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
              updated_at: new Date().toISOString(),
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
