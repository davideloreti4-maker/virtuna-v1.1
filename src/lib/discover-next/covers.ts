/**
 * A cover Maven stores: the Watchlist draws only these. The ingest rehosts covers and avatars into
 * public Supabase Storage while the platform's signature is still valid
 * (`src/lib/channels/ingest.ts`, `src/lib/scraping/rehost-cover.ts`); a signed platform address
 * expires and 403s, so it is never drawn. Pure.
 *
 * The host is checked by its suffix, not against this project's own URL: the values come only from
 * the ingest, and a custom Supabase domain would fail closed (no cover drawn), never open.
 */

const PUBLIC_OBJECT_PATH = "/storage/v1/object/public/";

/** An `https:` address on a Supabase project host whose path is a public Storage object. */
export function isStoredCover(url: string | null | undefined): url is string {
  if (!url) return false;
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return false;
  }
  return (
    address.protocol === "https:" &&
    address.hostname.endsWith(".supabase.co") &&
    address.pathname.startsWith(PUBLIC_OBJECT_PATH)
  );
}
