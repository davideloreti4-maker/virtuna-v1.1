import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import { createServiceClient } from "@/lib/supabase/service";

interface ApifyVideoItem {
  id: string;
  webVideoUrl?: string;
  authorMeta?: { name?: string; profileUrl?: string };
  text?: string;
  playCount?: number;
  diggCount?: number;
  shareCount?: number;
  commentCount?: number;
  musicMeta?: { musicName?: string; musicAuthor?: string; playUrl?: string };
  hashtags?: Array<{ name: string }>;
  videoMeta?: { duration?: number };
  [key: string]: unknown;
}

/**
 * POST /api/webhooks/apify
 *
 * Receives webhook from Apify when a scrape run completes.
 * Fetches the dataset and upserts videos into scraped_videos.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // TREND-07: Verify webhook secret
    if (payload.secret !== process.env.APIFY_WEBHOOK_SECRET) {
      console.warn("[apify-webhook] Invalid secret received");
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    const { resource } = payload;
    if (!resource?.defaultDatasetId) {
      return NextResponse.json(
        { error: "Missing dataset ID" },
        { status: 400 }
      );
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const dataset = client.dataset(resource.defaultDatasetId);

    // Fetch all items from the dataset
    const { items } = await dataset.listItems();

    if (!items || items.length === 0) {
      return NextResponse.json({ received: true, upserted: 0 });
    }

    const supabase = createServiceClient();

    // Map Apify items to scraped_videos schema and upsert in batches
    const BATCH_SIZE = 50;
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const records = batch
        .filter((item): item is ApifyVideoItem => Boolean(item.id))
        .map((item) => ({
          platform: "tiktok" as const,
          platform_video_id: item.id,
          video_url: item.webVideoUrl ?? null,
          author: item.authorMeta?.name ?? null,
          author_url: item.authorMeta?.profileUrl ?? null,
          description: item.text ?? null,
          views: item.playCount ?? null,
          likes: item.diggCount ?? null,
          shares: item.shareCount ?? null,
          comments: item.commentCount ?? null,
          sound_name: item.musicMeta?.musicName ?? null,
          sound_url: item.musicMeta?.playUrl ?? null,
          hashtags: item.hashtags?.map((h) => h.name) ?? null,
          duration_seconds: item.videoMeta?.duration ?? null,
          metadata: {
            apify_dataset_id: resource.defaultDatasetId,
            apify_run_id: resource.id,
            scraped_at: new Date().toISOString(),
          },
        }));

      if (records.length === 0) continue;

      const { error } = await supabase
        .from("scraped_videos")
        .upsert(records, {
          onConflict: "platform,platform_video_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(
          `[apify-webhook] Batch upsert error (offset ${i}):`,
          error
        );
        errorCount += records.length;
      } else {
        upsertedCount += records.length;
      }
    }

    console.log(
      `[apify-webhook] Processed ${items.length} items: ${upsertedCount} upserted, ${errorCount} errors`
    );

    return NextResponse.json({
      received: true,
      total: items.length,
      upserted: upsertedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("[apify-webhook] Handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
