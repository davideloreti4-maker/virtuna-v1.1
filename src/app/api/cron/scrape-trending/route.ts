import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? "clockworks~tiktok-scraper";
const STALE_THRESHOLD_HOURS = 24;

/**
 * GET /api/cron/scrape-trending
 *
 * Triggers the TikTok scraper Apify actor. Runs every 6 hours via Vercel Cron.
 * The actor sends results to our webhook at /api/webhooks/apify on completion.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    // Check for stale data (TREND-08)
    const supabase = createServiceClient();
    const { data: latest } = await supabase
      .from("scraped_videos")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latest?.created_at) {
      const hoursSinceLastScrape =
        (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastScrape > STALE_THRESHOLD_HOURS) {
        console.warn(
          `[scrape-trending] Stale data detected: last scrape was ${hoursSinceLastScrape.toFixed(1)}h ago`
        );
      }
    }

    // Start the Apify actor run
    const run = await client.actor(APIFY_ACTOR_ID).start(
      {
        hashtags: ["trending", "viral", "fyp"],
        resultsPerPage: 100,
      },
      {
        webhooks: [
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED"],
            requestUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`,
            payloadTemplate: `{
              "resource": {{resource}},
              "eventType": {{eventType}},
              "secret": "${process.env.APIFY_WEBHOOK_SECRET}"
            }`,
          },
        ],
      }
    );

    return NextResponse.json({
      success: true,
      runId: run.id,
      actorId: APIFY_ACTOR_ID,
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[scrape-trending] Failed to start actor:", error);
    return NextResponse.json(
      { error: "Failed to start scraper" },
      { status: 500 }
    );
  }
}
