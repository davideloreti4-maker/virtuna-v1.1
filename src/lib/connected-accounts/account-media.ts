/**
 * account-media.ts — persist a connected account's profile picture (and the creator profile's)
 * as OUR storage URL. SERVER ONLY.
 *
 * Scraped avatar URLs are signed TikTok/IG CDN URLs that 403 within days, so a raw URL is never
 * stored: we rehost into the public `avatars` bucket first (rehost-cover.ts) and store only that.
 * Everything here is best-effort: a failed rehost or write logs and returns null — it never throws
 * and never fails the connect/refresh that called it.
 *
 * `storage` must be able to write the `avatars` bucket: pass the SERVICE client (a user session
 * client is refused by the bucket's storage policies outside the user's own folder).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rehostAccountAvatar } from "@/lib/scraping/rehost-cover";
import { setAccountAvatar } from "./connected-accounts-repo";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "connected-accounts.account-media" });

/**
 * Rehost `rawAvatarUrl` and store it on `connected_accounts.avatar_url`. Returns the stored URL,
 * or null when nothing was stored (no source, rehost failed, or the write errored). A failed rehost
 * leaves any existing avatar_url untouched.
 */
export async function persistAccountAvatar(
  storage: SupabaseClient,
  account: { id: string; platform: string; handle: string },
  rawAvatarUrl: string | null | undefined,
  db: SupabaseClient = storage,
): Promise<string | null> {
  if (!rawAvatarUrl) return null;
  try {
    const url = await rehostAccountAvatar(storage, rawAvatarUrl, account.platform, account.handle);
    if (!url) return null;
    const ok = await setAccountAvatar(db, account.id, url);
    if (!ok) {
      log.warn("avatar write failed", { accountId: account.id });
      return null;
    }
    return url;
  } catch (err) {
    log.warn("avatar persist error", { accountId: account.id, error: String(err) });
    return null;
  }
}

/**
 * Rehost a scraped TikTok avatar for `creator_profiles.avatar_url`. Same key as the TikTok
 * connected account (`account/tiktok/<handle>`), so the two share one object. Returns our URL or
 * null; the caller decides what to store on null (never the raw URL).
 */
export async function rehostCreatorAvatar(
  storage: SupabaseClient,
  rawAvatarUrl: string | null | undefined,
  tiktokHandle: string,
): Promise<string | null> {
  try {
    return await rehostAccountAvatar(storage, rawAvatarUrl, "tiktok", tiktokHandle);
  } catch {
    return null;
  }
}
