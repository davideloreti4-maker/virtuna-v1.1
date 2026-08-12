import { redirect } from "next/navigation";

/**
 * /discover — deep-link preservation redirect (2026-07-29).
 *
 * The on-demand outlier pull moved to /feed/discover, where it reads as what it is: a tool
 * tab of the Discover hub, sibling to /feed/channels and /feed/hooks. This route is retained
 * ONLY so existing bookmarks keep resolving — mirroring /saved → /library. The redirect IS
 * the route; the page + client live under /feed now.
 *
 * History worth keeping straight, because this file has meant three different things:
 *   1. the browsable outlier grid (Phase 08)
 *   2. a redirect to /feed after the grid was folded into the hub (2026-06-29) — which the
 *      2026-07-15 launch cut then turned into a dead 2-hop, since /feed went to /home too
 *   3. the grid again, reactivated standalone 2026-07-29 — and now this: the same surface,
 *      moved INTO the hub rather than sitting beside it.
 *
 * ⚠️ TARGET IS THE HUB, NOT THE TOOL (2026-08-05). This pointed at `/feed/discover`, which is
 * the on-demand **Pull** — a 5-credit Apify scrape. Every one of the bookmarks this route
 * exists to honour was saved when /discover meant the BROWSABLE outlier grid: a free, read-only
 * library. Sending that link to a paid scrape tool answers a request to browse with a request
 * to spend, on a surface the visitor did not choose. `/feed` is the hub those bookmarks meant —
 * Outliers · Collections · Watchlist — and the Pull is one tab inside it, one click away for
 * anyone who actually wants it.
 */
export default function DiscoverRedirect() {
  redirect("/feed");
}
