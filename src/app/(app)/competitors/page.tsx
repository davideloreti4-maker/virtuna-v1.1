import { redirect } from "next/navigation";

/**
 * /competitors — deep-link preservation redirect (Surfaces IA rationalization, 2026-07-04).
 *
 * Competitors is a TAB of the Discover hub, not a standalone surface, so this route exists
 * only to keep old bookmarks resolving — it lands on the hub with that tab pre-selected.
 *
 * It pointed at /home from 2026-07-04 until 2026-07-29: the launch cut had hidden /feed (it
 * redirected to /home and DROPPED the query), so /competitors → /feed?tab=competitors → /home
 * was a dead 2-hop that also lost the tab, and one hop to /home was the honest version of that.
 * With the hub reactivated the original one-hop target is correct again.
 */
export default function CompetitorsPage() {
  redirect("/feed?tab=competitors");
}
