import { redirect } from "next/navigation";

/**
 * /analytics — deep-link preservation redirect.
 *
 * Account analytics (followers/likes/posts/views over time + content mix) now lives as the
 * "Your account" tab on /audience — your numbers sit with your people. This route is retained
 * ONLY as a redirect so existing bookmarks / deep links keep resolving (→ the account tab).
 */
export default function AnalyticsPage() {
  redirect("/audience?tab=account");
}
