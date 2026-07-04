import { redirect } from "next/navigation";

/**
 * /analytics — deep-link preservation redirect (Surfaces IA rationalization, 2026-07-04).
 *
 * The standalone analytics surface was folded into the GROW hub as its "Numbers" tab
 * (real account metrics live there now). This route is retained ONLY as a redirect so
 * existing bookmarks / deep links to /analytics keep resolving — mirroring /discover→/feed
 * and /saved→/library. The redirect IS the route.
 */
export default function AnalyticsPage() {
  redirect("/grow");
}
