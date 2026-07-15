import { redirect } from "next/navigation";

/**
 * /feed — the Discover hub, hidden for the MVP launch cut (lane/launch-prep, 2026-07-15).
 *
 * Discover (Watching · Trending · Competitors) is off the core prediction loop, so it's hidden
 * for launch and this route redirects to /home. The DiscoverHub component + /api/feed are left
 * in place; restore this page from git to bring the hub back post-launch. Note: /discover and
 * /competitors still redirect here, so they now chain through to /home.
 */
export default function FeedPage() {
  redirect("/home");
}
