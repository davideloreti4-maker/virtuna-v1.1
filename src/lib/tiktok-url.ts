/**
 * Single source of truth for the TikTok URL trust-boundary check (WR-01).
 *
 * Consumed by BOTH the client composer (fast UX reject) and the server
 * /api/analyze route (the actual trust boundary). Previously these lived as
 * two separate literals that drifted: the client carried a case-insensitive
 * `/i` flag the server lacked, so `https://www.TIKTOK.com/...` passed the
 * client, enabled Submit, fired the stream, and was then rejected 400 by the
 * server. Lifting the regex here makes client/server byte-identical so they
 * can never disagree again.
 *
 * Case-SENSITIVE (no `/i`) — kept identical to the original server check so
 * the server trust boundary is NOT weakened (the looser client flag was the
 * bug, not the server).
 *
 * NOTE: this is a format/UX gate, not a full host-authority check. The server
 * additionally resolves the URL through the scraping provider; this regex only
 * fast-rejects obvious non-TikTok input.
 */
export const TIKTOK_URL_PATTERN = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;

/** True when `url` looks like a TikTok video URL (format-level check). */
export function isTikTokUrl(url: string): boolean {
  return TIKTOK_URL_PATTERN.test(url);
}
