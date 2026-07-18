import { redirect } from "next/navigation";

/**
 * /feed/channels — orphaned by the MVP launch cut (2026-07-15). The Discover hub + /feed were hidden
 * (the parent redirects to /home), but this sub-route did not inherit and stayed live, leaking the
 * hidden Channels watchlist via direct URL (P3, ambient-room-v2). Redirect to /home to match the parent.
 *
 * The ChannelsClient + ingest/track APIs are LEFT IN PLACE (unreferenced) — restore this route from
 * git to bring the watchlist back post-launch, exactly like /feed and /start.
 */
export default function ChannelsRedirect() {
  redirect("/home");
}
