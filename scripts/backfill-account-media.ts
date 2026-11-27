/**
 * backfill-account-media.ts — fill `connected_accounts.avatar_url` and `account_posts.cover_url` for
 * rows written before migration 20261126120000_account_media.sql. NOT RUN YET.
 *
 * Both columns hold OUR storage URLs only (rehosted via src/lib/scraping/rehost-cover.ts); a raw
 * signed TikTok/IG CDN URL is never written. Going forward the connect route + the daily
 * refresh-account-snapshots cron fill them; this only closes the gap for existing rows.
 *
 * AVATARS (connected_accounts.avatar_url IS NULL)
 *   free  → the user's creator_profiles.avatar_url, when the account is TikTok and its handle matches
 *           creator_profiles.tiktok_handle. Already one of our storage URLs: copied as is. A raw
 *           CDN URL: rehosted (most stored ones are past their `x-expires` and 403 → skipped).
 *   paid  → `--scrape`: an Apify profile scrape per remaining account (Apify runs on rotating FREE
 *           accounts with a $5/mo hard cap; a cap-out reads as "check your handle"). Off by default.
 *           Without it the daily cron fills these on its next run anyway (it rehosts every account's
 *           avatar), so the paid branch only buys "today instead of tomorrow".
 *
 * COVERS (account_posts.cover_url IS NULL) — `--covers`
 *   free  → TikTok posts only: the public oEmbed endpoint re-signs the post's thumbnail, which is
 *           then rehosted. Instagram/YouTube posts are skipped (the archive holds TikTok posts only
 *           today: the cron's IG/YT path writes no posts).
 *
 * Usage (dry run is the default — it reads and reports, writes nothing, uploads nothing):
 *   node node_modules/tsx/dist/cli.mjs scripts/backfill-account-media.ts
 *   node node_modules/tsx/dist/cli.mjs scripts/backfill-account-media.ts --apply
 *   node node_modules/tsx/dist/cli.mjs scripts/backfill-account-media.ts --covers --limit=50 --apply
 *   node node_modules/tsx/dist/cli.mjs scripts/backfill-account-media.ts --scrape --apply   (spends Apify)
 *
 * ⚠️ dev and prod share ONE Supabase project: --apply writes production rows and production storage.
 * Apply the migration first (the columns must exist). Idempotent: rows already holding a URL are
 * never selected, and the storage keys are stable (upsert), so a re-run costs nothing.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local); --scrape also
 * needs the Apify env the app uses.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { rehostAccountAvatar, rehostCover } from "../src/lib/scraping/rehost-cover";

// ── args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const doScrape = argv.includes("--scrape");
const doCovers = argv.includes("--covers");
const arg = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const limit = Number(arg("limit") ?? 0) || 500;

// ── env (scripts are not Next, so .env.local is not auto-loaded) ──────────────

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[account-media] ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }) as unknown as SupabaseClient;

const OUR_AVATARS = "/storage/v1/object/public/avatars/";
const norm = (h: string | null | undefined) => (h ?? "").replace(/^@/, "").trim().toLowerCase();

interface AccountRow {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
}

async function writeAvatar(accountId: string, url: string): Promise<boolean> {
  const { error } = await service.from("connected_accounts").update({ avatar_url: url }).eq("id", accountId).is("avatar_url", null);
  if (error) console.warn(`  write failed for ${accountId}: ${error.message}`);
  return !error;
}

// ── avatars ───────────────────────────────────────────────────────────────────

async function backfillAvatars(): Promise<void> {
  const { data, error } = await service
    .from("connected_accounts")
    .select("id, user_id, platform, handle")
    .is("avatar_url", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`connected_accounts read: ${error.message} (is the migration applied?)`);
  const accounts = (data ?? []) as AccountRow[];
  console.log(`[avatars] ${accounts.length} account(s) without a picture`);
  if (accounts.length === 0) return;

  const userIds = [...new Set(accounts.map((a) => a.user_id))];
  const { data: profiles, error: pErr } = await service
    .from("creator_profiles")
    .select("user_id, tiktok_handle, avatar_url")
    .in("user_id", userIds);
  if (pErr) throw new Error(`creator_profiles read: ${pErr.message}`);
  const byUser = new Map(
    ((profiles ?? []) as Array<{ user_id: string; tiktok_handle: string | null; avatar_url: string | null }>).map((p) => [p.user_id, p]),
  );

  const left: AccountRow[] = [];
  let copied = 0;
  let rehosted = 0;
  for (const a of accounts) {
    const p = byUser.get(a.user_id);
    const match = a.platform === "tiktok" && p?.avatar_url && norm(p.tiktok_handle) === norm(a.handle);
    if (!match) {
      left.push(a);
      continue;
    }
    const src = p!.avatar_url!;
    if (src.includes(OUR_AVATARS)) {
      console.log(`  copy    @${a.handle} ← creator_profiles (already ours)`);
      if (apply && (await writeAvatar(a.id, src))) copied++;
      continue;
    }
    if (!apply) {
      console.log(`  rehost? @${a.handle} ← creator_profiles raw CDN url (dry run: not fetched)`);
      continue;
    }
    const url = await rehostAccountAvatar(service, src, a.platform, a.handle);
    if (url && (await writeAvatar(a.id, url))) {
      rehosted++;
      console.log(`  rehost  @${a.handle} ✓`);
    } else {
      console.log(`  rehost  @${a.handle} ✗ (expired or refused) → left for the cron`);
      left.push(a);
    }
  }
  console.log(`[avatars] copied ${copied}, rehosted ${rehosted}, ${left.length} left${apply ? "" : " (dry run)"}`);

  if (left.length === 0) return;
  if (!doScrape) {
    console.log(`[avatars] ${left.length} need a profile scrape (${left.length} Apify run(s)); pass --scrape to spend, or let the daily cron fill them`);
    return;
  }
  if (!apply) {
    console.log(`[avatars] --scrape would run ${left.length} Apify profile scrape(s) (dry run: none run)`);
    return;
  }
  const { createScrapingProvider } = await import("../src/lib/scraping");
  const scraper = createScrapingProvider();
  for (const a of left) {
    try {
      const profile =
        a.platform === "instagram" && scraper.scrapeInstagramProfile
          ? await scraper.scrapeInstagramProfile(a.handle)
          : a.platform === "youtube" && scraper.scrapeYouTubeChannel
            ? await scraper.scrapeYouTubeChannel(a.handle)
            : await scraper.scrapeProfile(a.handle);
      const url = await rehostAccountAvatar(service, profile.avatarUrl, a.platform, a.handle);
      const ok = url ? await writeAvatar(a.id, url) : false;
      console.log(`  scrape  ${a.platform}/@${a.handle} ${ok ? "✓" : "✗"}`);
    } catch (err) {
      console.log(`  scrape  ${a.platform}/@${a.handle} ✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ── covers ────────────────────────────────────────────────────────────────────

async function oembedThumbnail(handle: string, postId: string): Promise<string | null> {
  const page = `https://www.tiktok.com/@${handle}/video/${postId}`;
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(page)}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { thumbnail_url?: unknown };
    return typeof body.thumbnail_url === "string" ? body.thumbnail_url : null;
  } catch {
    return null;
  }
}

async function backfillCovers(): Promise<void> {
  const { data, error } = await service
    .from("account_posts")
    .select("id, platform, handle, post_id")
    .is("cover_url", null)
    .eq("platform", "tiktok")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`account_posts read: ${error.message} (is the migration applied?)`);
  const posts = (data ?? []) as Array<{ id: string; platform: string; handle: string; post_id: string }>;
  console.log(`[covers] ${posts.length} TikTok post(s) without a cover (limit ${limit})`);
  if (!apply) {
    console.log("[covers] dry run: no oEmbed calls, no uploads");
    return;
  }
  let ok = 0;
  for (const p of posts) {
    const thumb = await oembedThumbnail(norm(p.handle), p.post_id);
    const url = thumb ? await rehostCover(service, thumb, `account/tiktok/${p.post_id}`) : null;
    if (!url) continue;
    const { error: wErr } = await service.from("account_posts").update({ cover_url: url }).eq("id", p.id).is("cover_url", null);
    if (wErr) console.warn(`  write failed for ${p.post_id}: ${wErr.message}`);
    else ok++;
  }
  console.log(`[covers] stored ${ok} of ${posts.length}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`[account-media] ${apply ? "APPLY" : "DRY RUN"}${doScrape ? " +scrape" : ""}${doCovers ? " +covers" : ""}`);
  await backfillAvatars();
  if (doCovers) await backfillCovers();
})().catch((err) => {
  console.error("[account-media] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
