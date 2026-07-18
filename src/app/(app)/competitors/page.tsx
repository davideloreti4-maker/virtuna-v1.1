import { redirect } from "next/navigation";

/**
 * /competitors — deep-link preservation redirect (Surfaces IA rationalization, 2026-07-04).
 *
 * It used to point at /feed?tab=competitors — but the launch cut hid /feed (it now redirects to
 * /home and DROPS the query), so /competitors → /feed?tab=competitors → /home was a dead 2-hop
 * that also lost the tab. Go straight to /home in one hop (P3, ambient-room-v2). The Discover hub +
 * the competitor sub-routes are hidden with it; restore from git to bring the surface back.
 */
export default function CompetitorsPage() {
  redirect("/home");
}
