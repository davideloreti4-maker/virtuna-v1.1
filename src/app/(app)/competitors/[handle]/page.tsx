import { redirect } from "next/navigation";

/**
 * /competitors/[handle] — the competitor detail page, orphaned by the MVP launch cut (2026-07-15).
 * Its only entry points — /competitors and /feed?tab=competitors — both now redirect to /home, so
 * the surface is already unreachable through the UI; this route stayed live only via direct URL /
 * stale bookmark (P3, ambient-room-v2). Redirect to /home to close the leak and match the parent.
 *
 * The detail sections + intelligence service are LEFT IN PLACE (unreferenced) — restore this route
 * from git to bring the competitor surface back post-launch, exactly like /feed and /start.
 */
export default function CompetitorDetailRedirect() {
  redirect("/home");
}
