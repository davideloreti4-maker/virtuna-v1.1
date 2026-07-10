/**
 * rehost-cover.ts — durable cover-thumbnail persistence.
 *
 * Scraped TikTok covers are short-lived SIGNED CDN URLs (`x-expires` ~2 weeks out); once past
 * expiry they 403 everywhere and the feed/start cards fall through to their caption poster. This
 * helper downloads the cover at INGEST time (while the signature is still valid) and re-hosts the
 * bytes into the public `covers` bucket, returning a permanent public URL that never expires.
 *
 * Security: SSRF allowlist (image CDN host suffixes only, HTTPS only) mirrors the mp4 guard in
 * enrich-signature.ts (prepareWatchUrl). Failure is total — any error returns null so the caller
 * simply keeps the ephemeral URL (or null) and the card degrades to its poster. Idempotent: a URL
 * already in our bucket is returned unchanged (a re-scrape re-uploads to the same stable key).
 */
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger({ module: "scraping.rehost-cover" });

export const COVERS_BUCKET = "covers";

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
 * Download an ephemeral cover image and re-host it to the public `covers` bucket.
 * Returns a permanent public URL, or null on any failure (caller keeps the poster fallback).
 *
 * @param key stable object key WITHOUT extension (e.g. `tiktok/<platformVideoId>`) — a re-scrape
 *            re-uploads to the same key (upsert), so the URL is stable across ingests.
 */
export async function rehostCover(
  service: SupabaseClient,
  sourceUrl: string | null | undefined,
  key: string,
): Promise<string | null> {
  if (!sourceUrl) return null;
  // Already rehosted (idempotent) — our own public bucket URL, nothing to fetch.
  if (sourceUrl.includes(`/storage/v1/object/public/${COVERS_BUCKET}/`)) return sourceUrl;

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
      log.warn("cover fetch failed", { status: res.status, key });
      return null;
    }
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${safeKey(key)}.${ext}`;
    const { error } = await service.storage.from(COVERS_BUCKET).upload(path, buf, {
      contentType: type,
      upsert: true,
      cacheControl: "31536000", // 1y — the bytes are immutable for a given video
    });
    if (error) {
      log.warn("cover upload failed", { error: error.message, key });
      return null;
    }
    const { data } = service.storage.from(COVERS_BUCKET).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch (err) {
    log.warn("cover rehost error", { error: String(err), key });
    return null;
  } finally {
    clearTimeout(timer);
  }
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
