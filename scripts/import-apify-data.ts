import { config } from "dotenv";
import { resolve } from "path";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const BATCH_SIZE = 50;

// apidojo/tiktok-scraper output format
interface ApiDojoVideoItem {
  id: string;
  postPage?: string;
  title?: string;
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  bookmarks?: number;
  hashtags?: string[];
  channel?: {
    id?: string;
    name?: string;
    username?: string;
    url?: string;
    bio?: string;
    verified?: boolean;
    followers?: number;
  };
  song?: {
    title?: string;
    artist?: string;
    id?: number;
    duration?: number;
  };
  video?: {
    duration?: number;
    url?: string;
    cover?: string;
  };
  uploadedAt?: number;
  uploadedAtFormatted?: string;
  [key: string]: unknown;
}

// clockworks/tiktok-scraper output format
interface ClockworksVideoItem {
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

type AnyVideoItem = ApiDojoVideoItem & ClockworksVideoItem;

function mapToRecord(item: AnyVideoItem, datasetId: string, runId: string) {
  // Detect format: apidojo has `channel`, clockworks has `authorMeta`
  const isApiDojo = "channel" in item || "postPage" in item;

  if (isApiDojo) {
    const v = item as ApiDojoVideoItem;
    return {
      platform: "tiktok" as const,
      platform_video_id: v.id,
      video_url: v.postPage ?? null,
      author: v.channel?.username ?? v.channel?.name ?? null,
      author_url: v.channel?.url ?? null,
      description: v.title ?? null,
      views: v.views ?? null,
      likes: v.likes ?? null,
      shares: v.shares ?? null,
      comments: v.comments ?? null,
      sound_name: v.song?.title ?? null,
      sound_url: null,
      hashtags: v.hashtags ?? null,
      duration_seconds: v.video?.duration != null ? Math.round(v.video.duration) : null,
      metadata: {
        apify_dataset_id: datasetId,
        apify_run_id: runId,
        scraped_at: new Date().toISOString(),
        bookmarks: v.bookmarks ?? null,
        uploaded_at: v.uploadedAtFormatted ?? null,
      },
    };
  } else {
    const v = item as ClockworksVideoItem;
    return {
      platform: "tiktok" as const,
      platform_video_id: v.id,
      video_url: v.webVideoUrl ?? null,
      author: v.authorMeta?.name ?? null,
      author_url: v.authorMeta?.profileUrl ?? null,
      description: v.text ?? null,
      views: v.playCount ?? null,
      likes: v.diggCount ?? null,
      shares: v.shareCount ?? null,
      comments: v.commentCount ?? null,
      sound_name: v.musicMeta?.musicName ?? null,
      sound_url: v.musicMeta?.playUrl ?? null,
      hashtags: v.hashtags?.map((h) => (typeof h === "string" ? h : h.name)) ?? null,
      duration_seconds: v.videoMeta?.duration != null ? Math.round(v.videoMeta.duration) : null,
      metadata: {
        apify_dataset_id: datasetId,
        apify_run_id: runId,
        scraped_at: new Date().toISOString(),
      },
    };
  }
}

async function main() {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error("[import] Missing APIFY_TOKEN in .env.local");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[import] Missing Supabase env vars");
    process.exit(1);
  }

  const apify = new ApifyClient({ token: apifyToken });
  const supabase = createClient(supabaseUrl, supabaseKey);

  // List ALL runs (paginate to get all 79+)
  console.log("[import] Fetching Apify runs...");
  let allRuns: Array<{ id: string; actId: string; status: string; defaultDatasetId: string; startedAt: Date }> = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const page = await apify.runs().list({ limit: pageSize, offset, desc: true });
    allRuns = allRuns.concat(page.items as typeof allRuns);
    if (page.items.length < pageSize) break;
    offset += page.items.length;
  }

  const successfulRuns = allRuns.filter((r) => r.status === "SUCCEEDED");
  console.log(`[import] Found ${allRuns.length} total runs, ${successfulRuns.length} successful\n`);

  let totalImported = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (let idx = 0; idx < successfulRuns.length; idx++) {
    const run = successfulRuns[idx];
    console.log(`[import] [${idx + 1}/${successfulRuns.length}] Run ${run.id} (dataset: ${run.defaultDatasetId})...`);

    const dataset = apify.dataset(run.defaultDatasetId);

    let info;
    try {
      info = await dataset.get();
    } catch {
      console.log(`[import]   Dataset not found or expired, skipping.`);
      totalSkipped++;
      continue;
    }

    if (!info || info.itemCount === 0) {
      console.log(`[import]   Empty dataset, skipping.`);
      totalSkipped++;
      continue;
    }

    console.log(`[import]   ${info.itemCount} items`);

    // Fetch all items with pagination
    let fetchOffset = 0;
    const fetchLimit = 1000;
    let allItems: AnyVideoItem[] = [];

    while (true) {
      const { items } = await dataset.listItems({ offset: fetchOffset, limit: fetchLimit });
      if (!items || items.length === 0) break;
      allItems = allItems.concat(items as AnyVideoItem[]);
      fetchOffset += items.length;
      if (items.length < fetchLimit) break;
    }

    // Check for valid video data
    const sample = allItems[0];
    if (!sample || !sample.id) {
      console.log(`[import]   No 'id' field found, skipping. Keys: ${Object.keys(sample || {}).slice(0, 5).join(", ")}`);
      totalSkipped++;
      continue;
    }

    // Upsert into scraped_videos
    let runImported = 0;
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE);

      const records = batch
        .filter((item) => Boolean(item.id))
        .map((item) => mapToRecord(item, run.defaultDatasetId, run.id));

      if (records.length === 0) continue;

      const { error } = await supabase.from("scraped_videos").upsert(records, {
        onConflict: "platform,platform_video_id",
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`[import]   Batch error at offset ${i}: ${error.message}`);
        totalErrors += records.length;
      } else {
        runImported += records.length;
      }
    }

    totalImported += runImported;
    console.log(`[import]   Imported ${runImported} items`);
  }

  // Final count
  const { count } = await supabase
    .from("scraped_videos")
    .select("*", { count: "exact", head: true });

  console.log(`\n[import] === DONE ===`);
  console.log(`[import] Runs processed: ${successfulRuns.length} (${totalSkipped} skipped)`);
  console.log(`[import] Total imported: ${totalImported}`);
  console.log(`[import] Total errors: ${totalErrors}`);
  console.log(`[import] Total rows in scraped_videos: ${count}`);
}

main().catch(console.error);
