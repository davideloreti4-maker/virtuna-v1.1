import { redirect } from "next/navigation";

/**
 * /calendar — hidden for the MVP launch cut (lane/launch-prep, 2026-07-15).
 *
 * The content-calendar workspace is off the core prediction loop, so it's hidden for launch
 * and this route redirects to /home. The CalendarWorkspace component + planned-posts libs are
 * left in place; restore this page from git to bring the surface back post-launch.
 */
export default function CalendarPage() {
  redirect("/home");
}
