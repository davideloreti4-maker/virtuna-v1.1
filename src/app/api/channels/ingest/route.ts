/**
 * POST /api/channels/ingest — Discover Feed Phase 1.1.
 *
 * Scrape ONE TikTok channel and persist it into the SHARED corpus: competitor_profiles
 * (channel store) + scraped_videos (with measured outlier/engagement signals). Idempotent +
 * freshness-gated on competitor_profiles.last_scraped_at, so re-adding a recently-scraped
 * channel is a cheap no-op. User-agnostic — the per-user watchlist coupling (tracked_accounts)
 * is the Channels page's job (it composes ingest + POST /api/tracked-accounts).
 *
 * Security spine (mirrors /api/discover):
 *   - Auth BEFORE any scrape/DB work (session only; the body never supplies identity).
 *   - csrfGuard on the mutating POST (Content-Type 415 + cross-origin 403, WR-01).
 *   - zod-validated body; platform restricted to the only scrapable platform (tiktok).
 *
 * Honesty (Pitfall 5): tiles built from these rows carry MEASURED engagement arithmetic
 * (outlier_multiplier / engagement_rate) — never a SIM score.
 */
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { normalizeHandle } from "@/lib/schemas/competitor";
import { ingestChannel, ChannelIngestError } from "@/lib/channels/ingest";

// scrapeProfileBundle is TikTok-only — reject other platforms honestly (400) rather than
// silently degrading. tracked_accounts supports 3 platforms; ingest scraping does not (yet).
const BodySchema = z.object({
  handle: z.string().min(1).max(200),
  platform: z.enum(["tiktok"]).default("tiktok"),
});

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate — before any scrape / DB work ────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ──────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (2) Parse + validate body ──────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // ── (3) Normalize the handle (strips '@' / a pasted TikTok URL → lowercased username) ──
  const handle = normalizeHandle(parsed.data.handle);
  if (handle.length < 2) {
    return Response.json({ error: "Invalid TikTok handle" }, { status: 400 });
  }

  // ── (4) Ingest: freshness-gated scrape + shared-corpus upsert ──────────────
  try {
    const result = await ingestChannel(handle);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChannelIngestError) {
      if (err.kind === "not_found") {
        return Response.json(
          {
            error: "channel_not_found",
            message: "That TikTok handle could not be found or scraped.",
          },
          { status: 404 },
        );
      }
      return Response.json(
        { error: "scrape_failed", message: `Channel ingest failed (${err.kind})` },
        { status: 502 },
      );
    }
    console.error("[channels/ingest] error:", err);
    return Response.json(
      { error: "ingest_failed", message: "Channel ingest failed" },
      { status: 500 },
    );
  }
}
