import { redirect } from "next/navigation";

/**
 * /analytics — deep-link preservation redirect.
 *
 * Account analytics (followers/likes/posts/views over time + content mix) now lives as the
 * "Your account" band at the foot of /audience — your numbers sit with your people. This
 * route is retained ONLY as a redirect so existing bookmarks / deep links keep resolving.
 */
export default function AnalyticsPage() {
  redirect("/audience");
}
