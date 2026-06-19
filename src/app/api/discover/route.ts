/**
 * /api/discover — Discover pull route (Phase 08, Plan 02, Task 3).
 *
 * POST — classify the input (profile vs niche), enforce a per-user daily cap, serve from
 * the per-(input,mode,day) cache when warm, else scrape via the apidojo Discover provider,
 * rank by recency-decayed outlier multiplier, cache, and return ~20–30 source-tagged tiles.
 *
 * Security spine (mirrors /api/tools/ideas):
 *   - Auth enforced BEFORE any scrape / cache work (user_id from the session only, NEVER body).
 *   - Server-side input length cap (independent of any client validation).
 *
 * Honesty spine (Pitfall 5): Discover tiles are MEASURED scrape data only — the outlier
 * "{n}× vs own/niche" multiplier is real engagement arithmetic. NO SIM score is emitted here.
 */

import { createClient } from "@/lib/supabase/server";
import { createScrapingProvider } from "@/lib/scraping";
import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import { rankOutliers, type RankedOutlier } from "@/lib/discover/outlier-compute";
import {
  getCachedDiscover,
  setCachedDiscover,
  checkUserCap,
  recordUserPull,
} from "@/lib/discover/discover-cache";
import { IngestError } from "@/lib/scraping/types";
import { csrfGuard } from "@/lib/http/csrf-guard";

// Server-side input cap (independent of client). A handle or short niche phrase.
const MAX_INPUT_LENGTH = 200;
// D-16: return ~20–30 tiles. Tile-count tuning is Claude's discretion within that band.
const MAX_TILES = 30;
// Scrape budget per pull (over-pull a little so the 90d window + ranking has material).
const SCRAPE_LIMIT = 30;

/** Tile shape returned to the client — ranked outlier + source/mode tags (D-15). */
interface DiscoverResponseTile extends RankedOutlier {
  mode: "profile" | "niche";
  /** D-15: profile pulls tag own-vs-competitor; niche pulls tag the niche query. */
  source: string;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate — before any scrape/cache work ──────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ─────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { input?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawInput = typeof body.input === "string" ? body.input.trim() : "";
  if (!rawInput) {
    return Response.json({ error: "input is required" }, { status: 400 });
  }
  if (rawInput.length > MAX_INPUT_LENGTH) {
    return Response.json(
      { error: `input must be at most ${MAX_INPUT_LENGTH} characters` },
      { status: 400 },
    );
  }

  // ── (3) Classify (profile vs niche) ───────────────────────────────────────
  const { mode, normalized } = classifyDiscoverInput(rawInput);

  // ── (4) Per-user daily cap (read-only check; consume only on a real scrape) ─
  const cap = checkUserCap(user.id);
  if (!cap.allowed) {
    // Friendly cap signal — NOT a 500 (ScrapeErrorBanner-compatible error shape).
    return Response.json(
      {
        error: "daily_cap_reached",
        message: `You've hit today's Discover limit (${cap.limit} pulls). Try again tomorrow.`,
        used: cap.used,
        limit: cap.limit,
      },
      { status: 429 },
    );
  }

  // ── (5) Cache check (per input, mode, day — Pitfall 6) ────────────────────
  const cached = getCachedDiscover<DiscoverResponseTile>(normalized, mode);
  if (cached) {
    return Response.json({ mode, input: normalized, cached: true, tiles: cached });
  }

  // ── (6) Cache miss → scrape (apidojo) → rank → cache → respond ─────────────
  try {
    const provider = createScrapingProvider();
    const videos = await provider.scrapeVideos(normalized, SCRAPE_LIMIT);

    const ranked = rankOutliers(videos, mode).slice(0, MAX_TILES);

    const tiles: DiscoverResponseTile[] = ranked.map((tile) => ({
      ...tile,
      mode,
      // D-15 source tag: niche pulls tag the niche query; profile pulls tag the channel.
      // (own-vs-competitor refinement is a W3/W4 concern; v1 tags the pull source.)
      source: mode === "niche" ? `niche:${normalized}` : `profile:${normalized}`,
    }));

    setCachedDiscover(normalized, mode, tiles);
    recordUserPull(user.id);

    return Response.json({ mode, input: normalized, cached: false, tiles });
  } catch (err) {
    // Map scrape failures to the ScrapeErrorBanner-compatible error shape.
    const message =
      err instanceof IngestError
        ? `Scrape failed (${err.kind})`
        : err instanceof Error
          ? err.message
          : "Discover pull failed";
    return Response.json({ error: "scrape_failed", message }, { status: 502 });
  }
}
