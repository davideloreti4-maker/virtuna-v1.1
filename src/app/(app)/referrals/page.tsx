import { redirect } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * /referrals — deep-link preservation redirect.
 *
 * The referral dashboard was demoted into /settings (Referrals tab) — it's Maven's own
 * growth mechanic, so it lives with account/billing rather than a top-nav surface. This
 * route is retained ONLY as a redirect so existing bookmarks / deep links keep resolving.
 * Under the new look the link lives on /earn (Earn, ruling 3), so it leads there.
 */
export default function ReferralsPage() {
  redirect(NEW_LOOK_ENABLED ? "/earn" : "/settings?tab=referrals");
}
