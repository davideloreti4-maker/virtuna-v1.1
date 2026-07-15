import { redirect } from "next/navigation";

/**
 * /start — hidden as a standalone surface (lane/launch-prep, 2026-07-15).
 *
 * The briefing was removed as a landing after preview — its stats duplicate /audience, its loop is
 * empty for new users, and its quick-actions echo the composer. New Thread / the /home composer IS
 * the home now, so this route redirects to /home. The StartPage component + surfaces libs are LEFT
 * IN PLACE (unreferenced) so the one salvageable piece — Daily pre-tested ideas — can be folded
 * into the /home composer's empty state; restore this route from git to bring the briefing back.
 */
export default function StartRedirect() {
  redirect("/home");
}
