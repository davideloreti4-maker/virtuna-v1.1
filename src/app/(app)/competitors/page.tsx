import { redirect } from "next/navigation";

/**
 * /competitors — deep-link preservation redirect (Surfaces IA rationalization, 2026-07-04).
 *
 * The standalone competitors surface was folded into the DISCOVER hub as its "Competitors"
 * tab. This route is retained ONLY as a redirect so existing bookmarks / deep links to
 * /competitors keep resolving — mirroring /analytics → /grow and /discover → /feed. The
 * competitor detail (/competitors/[handle]) and compare (/competitors/compare) sub-routes
 * stay as first-class deep pages. The redirect IS the route.
 */
export default function CompetitorsPage() {
  redirect("/feed?tab=competitors");
}
