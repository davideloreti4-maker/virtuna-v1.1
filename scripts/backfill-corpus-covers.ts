/**
 * backfill-corpus-covers.ts — revive the dead ProofReceipt thumbnails in the grounding corpus.
 *
 * THE PROBLEM (measured on prod `qyxvxleheckijapurisj`, 2026-07-24): all 532 `outlier_teardowns`
 * rows carry a cover URL and NONE of them renders. The corpus is one curated bulk import
 * (2026-07-14) whose cover URLs were already-expired signed CDN links at import time, so every
 * ProofReceipt on every skill card collapses to its grey play-tile placeholder. Verified: those
 * URLs 403 server-side too, so a proxy cannot save them — the bytes must be re-fetched.
 *
 *   tiktok signed (expired)      176  → FREE: public oEmbed re-signs the SAME asset, then rehost
 *   instagram signed (expired)   304  → needs an Apify re-scrape or an FB app token (not free)
 *   gs:// (private GCS bucket)    31  → unrenderable in a browser at all; 2 are TT/YT (free),
 *                                       29 are instagram (same spend as above)
 *   i.ytimg.com                   21  → already PERMANENT and public; nothing to do
 *
 * WHAT THIS SCRIPT DOES (the free half — no Apify spend, no API keys):
 *   TikTok  → GET https://www.tiktok.com/oembed?url=<canonical> → `thumbnail_url` (freshly signed)
 *             → `rehostCover` into the public `covers` bucket → permanent URL → update the row.
 *             ⚠️ The stored `video_url`s lack `www.`, which makes oEmbed 400. We canonicalize.
 *   YouTube → derive https://i.ytimg.com/vi/<platform_video_id>/hqdefault.jpg, which never
 *             expires and needs no storage of our own. Only touches rows NOT already on ytimg.
 *   Instagram → SKIPPED by design. Left for an explicit, costed decision.
 *
 * Usage:
 *   npx tsx scripts/backfill-corpus-covers.ts              (dry run — default, safe)
 *   npx tsx scripts/backfill-corpus-covers.ts --apply      (mutates)
 *   npx tsx scripts/backfill-corpus-covers.ts --platform=tiktok --limit=10 --apply
 *
 * Idempotent: rows already pointing at our `covers` bucket (or at ytimg) are skipped, so a
 * re-run costs nothing. Every failure is per-row and non-fatal — the row keeps its dead URL and
 * the receipt keeps degrading to the placeholder exactly as it does today.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { rehostCover } from "../src/lib/scraping/rehost-cover";

// ── args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const arg = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const platformFilter = arg("platform");
const limit = Number(arg("limit") ?? 0) || undefined;
/** Instagram is the ONLY branch that spends money — it must be asked for explicitly. */
const doInstagram = argv.includes("--instagram");
const IG_BATCH = Number(arg("ig-batch") ?? 0) || 100;

// ── env (scripts are not Next, so .env.local is not auto-loaded) ──────────────

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m?.[1] && !process.env[m[1]]) {
        process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "[covers] ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
}) as unknown as SupabaseClient;

// ── row shape ─────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  platform: string;
  platform_video_id: string;
  video_url: string | null;
  cover_url: string | null;
  creator_handle: string | null;
}

const isDurable = (u: string | null): boolean =>
  !!u && (u.includes("supabase.co/storage") || u.includes("i.ytimg.com"));

// ── TikTok: public oEmbed re-signs the same asset, no auth, no Apify ──────────

/** The corpus stores `https://tiktok.com/@h/video/<id>` — oEmbed 400s without `www.`. */
function canonicalTikTokUrl(row: Row): string | null {
  if (row.creator_handle && row.platform_video_id) {
    const handle = row.creator_handle.replace(/^@/, "");
    return `https://www.tiktok.com/@${handle}/video/${row.platform_video_id}`;
  }
  if (!row.video_url) return null;
  return row.video_url.replace("://tiktok.com", "://www.tiktok.com");
}

async function tiktokThumbnail(row: Row): Promise<string | null> {
  const canonical = canonicalTikTokUrl(row);
  if (!canonical) return null;
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

// ── YouTube: the canonical thumbnail is derivable and permanent ───────────────

const youtubeThumbnail = (row: Row): string | null =>
  row.platform_video_id
    ? `https://i.ytimg.com/vi/${row.platform_video_id}/hqdefault.jpg`
    : null;

// ── per-row repair ────────────────────────────────────────────────────────────

type Outcome = "repaired" | "skipped-durable" | "skipped-instagram" | "failed";

async function repair(row: Row): Promise<Outcome> {
  if (isDurable(row.cover_url)) return "skipped-durable";
  if (row.platform === "instagram") return "skipped-instagram";

  if (row.platform === "youtube") {
    // Permanent + public: store it directly, no bucket copy needed.
    const url = youtubeThumbnail(row);
    if (!url) return "failed";
    if (apply) {
      const { error } = await service
        .from("outlier_teardowns")
        .update({ cover_url: url })
        .eq("id", row.id);
      if (error) return "failed";
    }
    return "repaired";
  }

  if (row.platform === "tiktok") {
    const fresh = await tiktokThumbnail(row);
    if (!fresh) return "failed";
    if (!apply) return "repaired"; // dry run proves oEmbed resolved; skip the upload
    // Rehost while this new signature is still valid — that is the whole point.
    const durable = await rehostCover(service, fresh, `corpus/tiktok/${row.platform_video_id}`);
    if (!durable) return "failed";
    const { error } = await service
      .from("outlier_teardowns")
      .update({ cover_url: durable })
      .eq("id", row.id);
    return error ? "failed" : "repaired";
  }

  return "failed";
}

// ── Instagram: the only path that costs money ────────────────────────────────

/**
 * IG has no usable free path: public oEmbed is deprecated and the post page now serves a JS shell
 * with ZERO `og:` tags to an unauthenticated fetch (verified 2026-07-24 — 600KB, no metadata). So
 * the bytes must come from a scrape.
 *
 * `apify/instagram-scraper` accepts MANY `directUrls` per run, so 333 posts is a handful of runs
 * rather than 333 — the difference between cents and dollars. `displayUrl` on each item is the
 * cover, served from `scontent*.cdninstagram.com` (already on the rehost allowlist).
 *
 * Opt-in only: this never runs without `--instagram`, so nobody spends by accident.
 */
async function repairInstagramBatch(rows: Row[]): Promise<Record<string, number>> {
  const { ApifyClient } = await import("apify-client");
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[covers] --instagram needs APIFY_TOKEN in the environment");
    return { failed: rows.length };
  }
  const client = new ApifyClient({ token });

  const byShortcode = new Map<string, Row>();
  for (const r of rows) {
    const code = r.video_url?.match(/\/(?:reel|p|tv)\/([^/?#]+)/)?.[1];
    if (code) byShortcode.set(code, r);
  }
  const urls = [...byShortcode.keys()].map((c) => `https://www.instagram.com/reel/${c}/`);
  console.log(`[covers] instagram: ${urls.length} resolvable post urls → scraping in batches`);

  const tally: Record<string, number> = { repaired: 0, failed: 0 };

  for (let i = 0; i < urls.length; i += IG_BATCH) {
    const batch = urls.slice(i, i + IG_BATCH);
    console.log(`[covers] instagram batch ${i / IG_BATCH + 1} (${batch.length} urls)…`);
    let items: Array<Record<string, unknown>> = [];
    try {
      const run = await client
        .actor("apify/instagram-scraper")
        .call({ directUrls: batch, resultsType: "posts", resultsLimit: 1 }, { waitSecs: 600 });
      const ds = await client.dataset(run.defaultDatasetId).listItems();
      items = ds.items as Array<Record<string, unknown>>;
    } catch (err) {
      console.warn(`[covers] instagram batch failed: ${String(err)}`);
      tally.failed = (tally.failed ?? 0) + batch.length;
      continue;
    }

    for (const item of items) {
      const code = String(item.shortCode ?? "");
      const display = typeof item.displayUrl === "string" ? item.displayUrl : null;
      const row = byShortcode.get(code);
      if (!row || !display) continue;
      const durable = await rehostCover(
        service,
        display,
        `corpus/instagram/${row.platform_video_id}`,
      );
      if (!durable) {
        tally.failed = (tally.failed ?? 0) + 1;
        continue;
      }
      const { error } = await service
        .from("outlier_teardowns")
        .update({ cover_url: durable })
        .eq("id", row.id);
      tally[error ? "failed" : "repaired"] = (tally[error ? "failed" : "repaired"] ?? 0) + 1;
    }
  }
  return tally;
}

// ── driver ────────────────────────────────────────────────────────────────────

/** Small pool — TikTok's oEmbed is unauthenticated and we are guests on it. */
async function mapPool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function main(): Promise<void> {
  console.log(
    `[covers] ${apply ? "APPLY" : "DRY RUN"}${platformFilter ? ` platform=${platformFilter}` : ""}${limit ? ` limit=${limit}` : ""}`,
  );

  let query = service
    .from("outlier_teardowns")
    .select("id, platform, platform_video_id, video_url, cover_url, creator_handle");
  if (platformFilter) query = query.eq("platform", platformFilter);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[covers] query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as Row[];
  const work = rows.filter((r) => !isDurable(r.cover_url) && r.platform !== "instagram");
  const instagram = rows.filter((r) => r.platform === "instagram" && !isDurable(r.cover_url));

  console.log(
    `[covers] ${rows.length} rows · ${work.length} repairable free · ${instagram.length} instagram (needs a re-scrape, skipped)`,
  );

  const results = await mapPool(work, 4, repair);
  const tally = results.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  console.log("[covers] free result:", tally);

  if (instagram.length && doInstagram) {
    if (!apply) {
      console.log(
        `[covers] instagram: ${instagram.length} rows WOULD be scraped ` +
          `(~${Math.ceil(instagram.length / IG_BATCH)} actor runs). Re-run with --apply to spend.`,
      );
    } else {
      const igTally = await repairInstagramBatch(instagram);
      console.log("[covers] instagram result:", igTally);
    }
  } else if (instagram.length) {
    console.log(
      `[covers] NOTE: ${instagram.length} instagram rows still dead — pass --instagram to scrape ` +
        `them (costs Apify credit). Not run by default.`,
    );
  }

  if (!apply) console.log("[covers] dry run — nothing written. Re-run with --apply.");
}

void main();
