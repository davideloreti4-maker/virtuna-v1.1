import { redirect } from "next/navigation";

/**
 * /analytics — deep-link preservation redirect.
 *
 * Account analytics (figures + posts + content mix) live in the SOURCE zone of the
 * account's audience detail page (rebuild P2). This route is retained ONLY as a
 * redirect so existing bookmarks keep resolving — /audience resolves ?tab=account
 * to the primary account's detail page.
 */
export default function AnalyticsPage() {
  redirect("/audience?tab=account");
}
