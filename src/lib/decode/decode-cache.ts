/**
 * decode-cache.ts — the corpus stops being a static library and becomes a CACHE OF DECODES.
 *
 * Spec D2: a decoded video never needs decoding again. Apify scrapes fresh on every request;
 * anything new is decoded once and written back, so the second creator asking about a niche hits
 * warm rows. This is what bounds the cost of Apify-first — per-video-ever, not per-request.
 *
 * Rows written here carry `source_pool: "scraped"` so accumulated rows stay distinguishable from
 * the original curated 532 (which are all `curated`; `scraped` had 0 rows before this landed).
 * The plan proposed `"live-scrape"`, but the table's CHECK constraint accepts only
 * `curated | competitor | scraped | expanded` — and Postgres rejects a bad value by RETURNING an
 * error, which a swallow-everything writer turns into a cache that silently stores nothing.
 * `status` is likewise constrained to `metadata | extracted | watched | failed`.
 *
 * Never throws: a cache miss costs a decode, a cache-write failure costs nothing at all. But a
 * returned error IS logged — see the note above.
 */

import type { LiveDecode } from "./live-decode";
import type { AuthorBaseline } from "@/lib/discover/author-baseline";
import { multiplierFor } from "@/lib/discover/author-baseline";

/** `outlier_teardowns.hook_source` CHECK: native_transcript | caption_fallback | omni. */
const HOOK_SOURCE: Record<LiveDecode["source"], string> = {
  transcript: "native_transcript",
  "caption-only": "caption_fallback",
};

interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
    upsert: (
      row: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => Promise<{ error?: unknown } | unknown>;
  };
}

interface CacheDeps {
  client?: SupabaseLike;
}

function getClient(deps: CacheDeps): SupabaseLike {
  if (deps.client) return deps.client;
  // Lazy require — keeps the service-role client (and its key) out of any bundle that merely
  // imports the decode types. Same pattern as src/lib/scraping/index.ts.
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { createServiceClient } = require("@/lib/supabase/service");
  return createServiceClient() as SupabaseLike;
}

export async function getCachedDecode(
  platformVideoId: string,
  deps: CacheDeps = {},
): Promise<LiveDecode | null> {
  try {
    const { data } = await getClient(deps)
      .from("outlier_teardowns")
      .select("hook_template, teardown, spoken_hook, hook_source")
      .eq("platform_video_id", platformVideoId)
      .maybeSingle();
    if (!data) return null;

    const row = data as {
      hook_template?: string | null;
      teardown?: Record<string, string> | null;
      spoken_hook?: string | null;
      hook_source?: string | null;
    };
    const t = row.teardown ?? {};
    // A metadata-only corpus row (status 'metadata') has no decode to serve. Returning a
    // half-filled one would let the caller skip the decode it actually needs.
    if (!row.hook_template || !t.structure) return null;

    return {
      hookPattern: row.hook_template,
      structure: t.structure,
      theTurn: t.theTurn ?? "",
      emotionalBeat: t.emotionalBeat ?? "",
      spokenHook: row.spoken_hook ?? null,
      // Provenance comes from the stored column when present; the spoken_hook presence is only
      // a fallback for pre-existing corpus rows written before hook_source was populated.
      source:
        row.hook_source === "caption_fallback"
          ? "caption-only"
          : row.hook_source
            ? "transcript"
            : row.spoken_hook
              ? "transcript"
              : "caption-only",
    };
  } catch {
    return null;
  }
}

export async function storeDecode(
  video: {
    platformVideoId: string;
    videoUrl: string;
    caption: string;
    views: number;
    likes: number;
    coverUrl?: string;
    author?: { handle: string; fans: number; heart: number; videoCount: number };
  },
  decode: LiveDecode,
  baseline: AuthorBaseline,
  deps: CacheDeps = {},
): Promise<void> {
  try {
    const res = (await getClient(deps)
      .from("outlier_teardowns")
      .upsert(
        {
          platform: "tiktok",
          platform_video_id: video.platformVideoId,
          video_url: video.videoUrl,
          cover_url: video.coverUrl ?? null,
          creator_handle: video.author?.handle ?? null,
          // Distinguishes accumulated rows from the original curated corpus (spec assumption 3).
          source_pool: "scraped",
          views: video.views,
          follower_count: video.author?.fans ?? null,
          outlier_multiplier: multiplierFor(video, baseline),
          // The basis ALWAYS travels with the number (Global Constraints).
          baseline_label: baseline.label,
          caption: video.caption,
          spoken_hook: decode.spokenHook,
          hook_source: HOOK_SOURCE[decode.source],
          hook_template: decode.hookPattern,
          teardown: {
            structure: decode.structure,
            theTurn: decode.theTurn,
            emotionalBeat: decode.emotionalBeat,
          },
          status: "extracted",
        },
        // The ONLY unique index on this table is (platform, platform_video_id). Naming just
        // platform_video_id raises 42P10 and the row is never written.
        { onConflict: "platform,platform_video_id" },
      )) as { error?: unknown } | null;

    // Supabase RETURNS errors rather than throwing them. Dropping this is how a write-back
    // cache reads as working while storing nothing — log it, but never fail the request.
    if (res && typeof res === "object" && "error" in res && res.error) {
      console.warn("[decode-cache] write-back failed:", res.error);
    }
  } catch {
    /* best-effort by contract — a ledger hiccup never costs the answer */
  }
}
