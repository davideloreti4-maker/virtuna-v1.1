import { redirect } from "next/navigation";

/**
 * /referrals — deep-link preservation redirect.
 *
 * The referral dashboard was demoted into /settings (Referrals tab) — it's Maven's own
 * growth mechanic, so it lives with account/billing rather than a top-nav surface. This
 * route is retained ONLY as a redirect so existing bookmarks / deep links keep resolving.
 */
export default function ReferralsPage() {
  redirect("/settings?tab=referrals");
}
