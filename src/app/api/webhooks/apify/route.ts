import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ApifyClient } from "apify-client";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";

/**
 * Constant-time string comparison for the webhook secret. JavaScript `!==`
 * short-circuits on the first character mismatch, leaking the secret's prefix
 * length via response-latency timing. timingSafeEqual operates on fixed-length
 * Buffers — the length-guard early-exit is itself non-timing-safe but only
 * reveals "your secret is the wrong length", not which character mismatched.
 *
 * Fails closed when EITHER side is undefined / empty so a misconfigured
 * APIFY_WEBHOOK_SECRET env var (e.g., `""`) never accepts unauthenticated
 * payloads of `{"secret": ""}`.
 */
function safeSecretEqual(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const log = createLogger({ module: "webhook/apify" });

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
  // Phase 8 D-08 + RESEARCH Finding 3 — schema-gap fields populated at insert time
  categoryType?: string;
  category?: string;
  createTimeISO?: string;
  [key: string]: unknown;
}

/**
 * RESEARCH Finding 3 Strategy A — same 10-slug mapping as Plan 01 migration UPDATE.
 * Maps Apify-provided category strings to NICHE_TREE primary slugs.
 * Returns null when category is missing or doesn't match any known prefix; rows
 * with null primary_niche are excluded from the retrieval pool by design.
 */
function deriveNicheSlug(category: string | null | undefined): string | null {
  if (!category) return null;
  const c = category.toLowerCase().trim();
  if (["beauty", "makeup", "skincare"].includes(c)) return "beauty";
  if (["fitness", "gym", "workout"].includes(c)) return "fitness";
  if (["education", "learning", "edu"].includes(c)) return "education";
  if (["comedy", "funny", "humor"].includes(c)) return "comedy";
  if (["lifestyle", "vlog", "daily"].includes(c)) return "lifestyle";
  if (["tech", "technology", "gadgets"].includes(c)) return "tech-gadgets";
  if (["gaming", "game", "esports"].includes(c)) return "gaming";
  if (["fashion", "style", "outfit"].includes(c)) return "fashion-style";
  if (["music", "song", "dance"].includes(c)) return "music-performance";
  if (["food", "cooking", "recipe", "eat"].includes(c)) return "food-cooking";
  return null;
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

    // TREND-07: Verify webhook secret (timing-safe — see safeSecretEqual).
    if (!safeSecretEqual(payload.secret, process.env.APIFY_WEBHOOK_SECRET)) {
      log.warn("Invalid secret received");
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
        .map((item) => {
          const author = item.authorMeta?.name ?? null;
          return {
            platform: "tiktok" as const,
            platform_video_id: item.id,
            video_url: item.webVideoUrl ?? null,
            author,
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
              scrape_hashtags: payload.scrape_hashtags ?? null,
            },
            // Phase 8 D-08 + RESEARCH Finding 3 schema-gap columns
            creator_handle: author,
            primary_niche: deriveNicheSlug(item.categoryType ?? item.category ?? null),
            posted_at: item.createTimeISO ?? null,
            // supabase-js types vector(768) as `string | null` on the wire (pgvector
            // literal "[0.1,0.2,...]"); the generated Database type for scraped_videos
            // expects this serialized form, so we stringify the number[] from embedBatch
            // before upsert. PostgREST + pgvector parse this format correctly.
            embedding: null as string | null,
          };
        });

      if (records.length === 0) continue;

      // D-08 Path 2: auto-embed scraped_videos before upsert.
      // BENCH-05 additive-only: embedder failure logs a warning and falls back to
      // embedding=null. The webhook still upserts the row; the embed-corpus.ts CLI
      // catches up null embeddings later. NEVER block the scrape on embedder failure.
      //
      // KNOWN ISSUE (WR-05, deferred to Phase 10+ hardening):
      // When the SAME platform_video_id is re-scraped (e.g., weekly hashtag re-runs),
      // the upsert with `ignoreDuplicates: false` OVERWRITES all columns — including
      // `embedding`. If embedBatch fails on the re-scrape (rate-limited), the previously
      // populated embedding is regressed to NULL. The proper fix is a SQL trigger:
      //   CREATE TRIGGER preserve_embedding BEFORE UPDATE ON scraped_videos
      //   FOR EACH ROW WHEN (NEW.embedding IS NULL AND OLD.embedding IS NOT NULL)
      //   EXECUTE FUNCTION ... SET NEW.embedding = OLD.embedding;
      // Held until Phase 10+ because it changes upsert semantics across all writers
      // and warrants its own migration + test coverage. Operator mitigation today:
      // the embed-corpus.ts CLI in default `IS NULL` mode re-embeds regressed rows
      // on the next scheduled run.
      let recordsWithEmbeddings = records;
      const BATCH_EMBED = 50;
      const withEmbeddings: typeof records = [];
      for (let k = 0; k < records.length; k += BATCH_EMBED) {
        const slice = records.slice(k, k + BATCH_EMBED);
        const texts = slice.map((r) =>
          buildSubjectText({
            primary_slug: r.primary_niche,
            creator_handle: r.creator_handle ?? r.author,
            caption: r.description ?? null,
            hashtags: r.hashtags,
          }),
        );
        try {
          const { vectors } = await embedBatch(texts);
          const merged = slice.map((row, j) => ({
            ...row,
            embedding: vectors[j] ? JSON.stringify(vectors[j]) : null,
          }));
          withEmbeddings.push(...merged);
        } catch (err) {
          log.warn("Embedding batch failed in apify webhook; inserting with embedding=null", {
            offset: i + k,
            error: err instanceof Error ? err.message : String(err),
          });
          const nulled = slice.map((row) => ({ ...row, embedding: null as string | null }));
          withEmbeddings.push(...nulled);
        }
      }
      recordsWithEmbeddings = withEmbeddings;

      const { error } = await supabase
        .from("scraped_videos")
        .upsert(recordsWithEmbeddings, {
          onConflict: "platform,platform_video_id",
          ignoreDuplicates: false,
        });

      if (error) {
        log.error("Batch upsert error", { offset: i, error: error.message });
        errorCount += recordsWithEmbeddings.length;
      } else {
        upsertedCount += recordsWithEmbeddings.length;
      }
    }

    log.info("Processed items", {
      total: items.length,
      upsertedCount,
      errorCount,
    });

    return NextResponse.json({
      received: true,
      total: items.length,
      upserted: upsertedCount,
      errors: errorCount,
    });
  } catch (error) {
    log.error("Handler error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
