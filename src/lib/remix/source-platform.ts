/**
 * source-platform.ts — what platform is a remix's SOURCE, and can it be embedded?
 *
 * ── Why this reads the URL and not the request flag ──────────────────────────────────────────
 * `use-remix-launch.ts` sends a hardcoded `PLATFORM = "tiktok"` on every launch, while 63% of the
 * outlier corpus is Instagram (333 Instagram / 177 TikTok / 22 YouTube, measured 2026-08-14). That
 * flag never reaches resolution — `resolve-and-rehost.ts` does not read it — so it does not break
 * remixing, but it is not a description of the source either. `remix_blueprints.source_video_id`
 * holds the real post URL (`sourcePostUrl ?? url`, remix-runner.ts:516), and the URL cannot lie
 * about which platform it points at. So the embed derives from that and nothing else.
 *
 * ── The honesty rule ─────────────────────────────────────────────────────────────────────────
 * `embedUrl` is non-null ONLY when the id is present in the URL itself. A `vm.tiktok.com`
 * shortlink identifies a video that requires a network round trip to resolve; guessing would
 * render a player for the wrong video, which is worse than rendering none. Callers fall back to
 * the card's existing "Watch the original ↗" link, which always works.
 *
 * Owner ruling 2026-08-14: TikTok and Instagram embed. YouTube is recognised — so a caller can
 * tell "known platform, no embed" from "unparseable" — but never embedded.
 */

export type SourcePlatform = "tiktok" | "instagram" | "youtube";

export interface ParsedSource {
  platform: SourcePlatform;
  /** The platform's own id for the post, when the URL carries it. null on a shortlink. */
  videoId: string | null;
  /** A URL safe to put in an `<iframe src>`, or null when we cannot name the video. */
  embedUrl: string | null;
}

/** Exact host match against the registrable domain — `evil-tiktok.com` must not read as TikTok. */
function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** TikTok ids are numeric snowflakes; anything else in that slot is not an id we can embed. */
const TIKTOK_ID_RE = /^\d+$/u;

/** Instagram shortcodes are base64url-ish, 5–24 chars. Tight enough to reject a username. */
const IG_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,24}$/u;

/**
 * Parse a source post URL into its platform and an embeddable URL.
 *
 * Never throws — `new URL()` throws on malformed input and every caller here is a renderer.
 * Returns null for "this is not a source URL we recognise".
 */
export function parseSourceUrl(raw: string | null | undefined): ParsedSource | null {
  if (!raw || typeof raw !== "string" || raw.trim() === "") return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // Scheme allowlist, not a blocklist: this value ends up in an iframe `src`, and `javascript:`
  // reaching that attribute is the one genuinely dangerous outcome of a bad parse.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  // Empty segments dropped so a trailing slash and a doubled slash both parse.
  const seg = url.pathname.split("/").filter(Boolean);

  if (hostIs(host, "tiktok.com")) {
    // Canonical: /@handle/video/{id}. The handle segment varies (dots, underscores), so the
    // anchor is the literal "video" marker rather than the position of the id.
    const i = seg.indexOf("video");
    const id = i >= 0 ? seg[i + 1] : undefined;
    if (id && TIKTOK_ID_RE.test(id)) {
      return { platform: "tiktok", videoId: id, embedUrl: `https://www.tiktok.com/embed/v2/${id}` };
    }
    // /t/{code} and vm.tiktok.com/{code} — real TikTok, id not in the URL.
    return { platform: "tiktok", videoId: null, embedUrl: null };
  }

  if (hostIs(host, "instagram.com")) {
    // /reel/{code}, /reels/{code}, /p/{code}, /tv/{code}, optionally prefixed by a username.
    // `/embed` is appended to the post's own path form: Instagram serves /p/{code}/embed and
    // /reel/{code}/embed, and does NOT serve /reels/{code}/embed — hence the normalisation.
    const i = seg.findIndex((s) => s === "reel" || s === "reels" || s === "p" || s === "tv");
    const kind = i >= 0 ? seg[i] : undefined;
    const code = i >= 0 ? seg[i + 1] : undefined;
    if (kind && code && IG_SHORTCODE_RE.test(code)) {
      const path = kind === "reels" ? "reel" : kind;
      return {
        platform: "instagram",
        videoId: code,
        embedUrl: `https://www.instagram.com/${path}/${code}/embed`,
      };
    }
    return { platform: "instagram", videoId: null, embedUrl: null };
  }

  if (hostIs(host, "youtube.com") || hostIs(host, "youtu.be")) {
    // Recognised so a caller can distinguish "known platform, no embed" from "unparseable",
    // which is what lets the card keep its link-out instead of hiding the source entirely.
    const id = hostIs(host, "youtu.be") ? seg[0] : (url.searchParams.get("v") ?? seg[seg.indexOf("shorts") + 1]);
    return { platform: "youtube", videoId: id ?? null, embedUrl: null };
  }

  return null;
}
