import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/scrape-trending" });

const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? "clockworks~tiktok-scraper";
const STALE_THRESHOLD_HOURS = 24;

const DEFAULT_HASHTAGS = [
  "trending", "viral", "fyp",
  "comedy", "dance", "cooking", "fitness",
  "fashion", "beauty", "tech", "education",
  "storytelling", "lifehack", "motivation",
];

function getScrapeHashtags(): string[] {
  const envHashtags = process.env.SCRAPER_HASHTAGS;
  if (!envHashtags) return DEFAULT_HASHTAGS;
  // Parse comma-separated, trim whitespace, filter empty
  const parsed = envHashtags.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_HASHTAGS;
}

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
        log.warn("Stale data detected", { hoursSinceLastScrape: Number(hoursSinceLastScrape.toFixed(1)) });
      }
    }

    // Start the Apify actor run with configurable hashtags (SIG-04)
    const hashtags = getScrapeHashtags();
    log.info("Scraping hashtags", { hashtags });

    const run = await client.actor(APIFY_ACTOR_ID).start(
      {
        hashtags,
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
              "secret": "${process.env.APIFY_WEBHOOK_SECRET}",
              "scrape_hashtags": ${JSON.stringify(hashtags)}
            }`,
          },
        ],
      }
    );

    return NextResponse.json({
      success: true,
      runId: run.id,
      actorId: APIFY_ACTOR_ID,
      hashtags,
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Failed to start actor", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to start scraper" },
      { status: 500 }
    );
  }
}
