import { redirect } from "next/navigation";

/**
 * /discover — deep-link preservation redirect (refine lane, 2026-06-29).
 *
 * The browsable outlier grid was superseded by the persistent Videos /feed
 * (Discover Feed milestone): watched-channel outliers + Trending live there now.
 * This route is retained ONLY as a redirect so existing bookmarks / deep links to
 * /discover keep resolving — mirroring /saved → /library. The DiscoverClient + the
 * POST /api/discover route are left in place for a later debt sweep; the redirect
 * IS the route.
 */
export default function DiscoverPage() {
  redirect("/feed");
}
