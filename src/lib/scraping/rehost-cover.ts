/**
 * rehost-cover.ts — durable scraped-image persistence (video covers + profile avatars).
 *
 * Scraped TikTok images (covers AND avatars) are short-lived SIGNED CDN URLs (`x-expires` ~2 weeks
 * out); once past expiry they 403 everywhere and cards/tiles fall through to a poster or initials.
 * These helpers download the image at INGEST time (while the signature is still valid) and re-host
 * the bytes into a public bucket, returning a permanent public URL that never expires.
 *
 * Security: SSRF allowlist (image CDN host suffixes only, HTTPS only) mirrors the mp4 guard in
 * enrich-signature.ts (prepareWatchUrl). Failure is total — any error returns null so the caller
 * simply keeps the ephemeral URL (or null) and the surface degrades to its fallback. Idempotent: a
 * URL already in our bucket is returned unchanged (a re-scrape re-uploads to the same stable key).
 */
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger({ module: "scraping.rehost-cover" });

export const COVERS_BUCKET = "covers";
export const AVATARS_BUCKET = "avatars";

/** Image CDN hosts a scraped cover may live on (TikTok signed image CDNs). SSRF allowlist. */
const COVER_HOST_SUFFIXES = [
  ".tiktokcdn.com",
  ".tiktokcdn-us.com",
  ".ibyteimg.com",
  ".ttwstatic.com",
];

const MAX_BYTES = 5 * 1024 * 1024; // 5MB cap — covers are ~50-300KB; this only guards pathology
const FETCH_TIMEOUT_MS = 8_000;

function isAllowedCoverHost(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  return COVER_HOST_SUFFIXES.some(
    (s) => u.hostname === s.slice(1) || u.hostname.endsWith(s),
  );
}

/** Storage object keys allow `/`; strip anything else to keep the path clean + collision-free. */
function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

/**
 * Download an ephemeral scraped image and re-host it to a public bucket. Returns a permanent public
 * URL, or null on any failure (caller keeps its fallback). Shared core for covers + avatars.
 *
 * @param key    stable object key WITHOUT extension — a re-scrape re-uploads to the same key
 *               (upsert), so the URL is stable across ingests.
 * @param bucket target public bucket (COVERS_BUCKET | AVATARS_BUCKET).
 */
async function rehostImage(
  service: SupabaseClient,
  sourceUrl: string | null | undefined,
  key: string,
  bucket: string,
): Promise<string | null> {
  if (!sourceUrl) return null;
  // Already rehosted (idempotent) — our own public bucket URL, nothing to fetch.
  if (sourceUrl.includes(`/storage/v1/object/public/${bucket}/`)) return sourceUrl;

  let u: URL;
  try {
    u = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (!isAllowedCoverHost(u)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, { signal: controller.signal });
    if (!res.ok) {
      log.warn("image fetch failed", { status: res.status, key, bucket });
      return null;
    }
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${safeKey(key)}.${ext}`;
    const { error } = await service.storage.from(bucket).upload(path, buf, {
      contentType: type,
      upsert: true,
      cacheControl: "31536000", // 1y — the bytes are immutable for a given key
    });
    if (error) {
      log.warn("image upload failed", { error: error.message, key, bucket });
      return null;
    }
    const { data } = service.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch (err) {
    log.warn("image rehost error", { error: String(err), key, bucket });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-host a single video cover into the public `covers` bucket.
 * @param key stable object key WITHOUT extension (e.g. `tiktok/<platformVideoId>`).
 */
export async function rehostCover(
  service: SupabaseClient,
  sourceUrl: string | null | undefined,
  key: string,
): Promise<string | null> {
  return rehostImage(service, sourceUrl, key, COVERS_BUCKET);
}

/**
 * Re-host a batch of covers in parallel, preserving order. Each entry independently degrades to
 * `null` on failure. Callers map the result back onto their rows by index.
 */
export async function rehostCovers(
  service: SupabaseClient,
  items: Array<{ sourceUrl: string | null | undefined; key: string }>,
): Promise<Array<string | null>> {
  return Promise.all(items.map((it) => rehostCover(service, it.sourceUrl, it.key)));
}

/**
 * Re-host a competitor/channel profile avatar into the public `avatars` bucket. Same ephemeral-URL
 * problem as covers: the daily refresh cron re-stamps a signed TikTok avatar URL that 403s within
 * days, dropping the card to initials. Keyed by handle so a re-scrape overwrites the same object.
 * Returns a permanent public URL, or null on failure (caller keeps the ephemeral URL / initials).
 *
 * `namespace` separates the two kinds of account that can share a handle: a competitor you
 * track and an account you own are different rows with different lifecycles, and must not
 * overwrite each other's object. Defaults to `competitor` so existing callers are unchanged.
 */
export async function rehostAvatar(
  service: SupabaseClient,
  sourceUrl: string | null | undefined,
  handle: string,
  namespace: "competitor" | "connected" = "competitor",
): Promise<string | null> {
  return rehostImage(service, sourceUrl, `${namespace}/${handle}`, AVATARS_BUCKET);
}
