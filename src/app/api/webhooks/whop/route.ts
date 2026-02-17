import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/whop/webhook-verification";
import { mapWhopProductToTier } from "@/lib/whop/config";
import { createServiceClient } from "@/lib/supabase/service";

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
          console.warn(
            "membership.went_valid: missing supabase_user_id in metadata",
            { whop_user_id: data.user_id, membership_id: data.id }
          );
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
              is_trial: data.status === "trialing",
              trial_ends_at: data.trial_end || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (error) {
          console.error("Failed to upsert subscription:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Check for referral conversion and credit referrer
        const { data: clickData } = await supabase
          .from("referral_clicks")
          .select("referral_code, referrer_user_id")
          .eq("referred_user_id", supabaseUserId)
          .order("clicked_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clickData) {
          // Check for existing conversion (idempotency)
          const { data: existingConversion } = await supabase
            .from("referral_conversions")
            .select("id")
            .eq("referred_user_id", supabaseUserId)
            .maybeSingle();

          if (!existingConversion) {
            const { data: conversion, error: conversionError } = await supabase
              .from("referral_conversions")
              .insert({
                referrer_user_id: clickData.referrer_user_id,
                referred_user_id: supabaseUserId,
                referral_code: clickData.referral_code,
                whop_membership_id: data.id,
                bonus_cents: REFERRAL_BONUS_CENTS,
                converted_at: new Date().toISOString(),
              })
              .select("id, bonus_cents")
              .single();

            if (conversionError) {
              console.error("Failed to record referral conversion:", conversionError);
            } else {
              // Credit referrer's wallet (balance calculated by trigger)
              await supabase.from("wallet_transactions").insert({
                user_id: clickData.referrer_user_id,
                amount_cents: conversion.bonus_cents,
                type: "referral_bonus",
                reference_type: "referral_conversion",
                reference_id: conversion.id,
                description: `Referral bonus for ${clickData.referral_code}`,
                status: "completed",
              });
            }
          }
        }

        break;
      }

      case "membership.went_invalid": {
        const supabaseUserId = data.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          console.warn(
            "membership.went_invalid: missing supabase_user_id in metadata",
            { whop_user_id: data.user_id, membership_id: data.id }
          );
          return NextResponse.json({ received: true });
        }

        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            virtuna_tier: "free",
            status: "cancelled",
            is_trial: false,
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", supabaseUserId);

        if (error) {
          console.error("Failed to update subscription:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      case "membership.payment_failed": {
        const supabaseUserId = data.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          console.warn(
            "membership.payment_failed: missing supabase_user_id in metadata",
            { whop_user_id: data.user_id, membership_id: data.id }
          );
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
          console.error("Failed to update subscription:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        break;
      }

      default:
        console.log("Unknown webhook event:", event);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
