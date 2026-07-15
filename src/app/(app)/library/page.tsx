import { redirect } from "next/navigation";

/**
 * /library — hidden for the MVP launch cut (lane/launch-prep, 2026-07-15).
 *
 * The saved-assets shelf is off the core prediction loop (past runs are retrievable from the
 * sidebar Thread history, not here), so it's hidden for launch and this route redirects to
 * /home. The SavedShelf + saved_items store are left in place; restore this page from git to
 * bring the surface back post-launch. /saved still redirects here → now chains to /home.
 */
export default function LibraryPage() {
  redirect("/home");
}
