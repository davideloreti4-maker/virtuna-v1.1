import { redirect } from "next/navigation";

/**
 * /referrals — deep-link preservation redirect (Surfaces IA rationalization, 2026-07-04).
 *
 * The standalone referrals surface was folded into the GROW hub as its "Referrals" tab
 * (still Pro-gated; the link + performance tiles live there now, restyled onto the matte
 * system). This route is retained ONLY as a redirect so existing bookmarks / deep links to
 * /referrals keep resolving — mirroring /discover→/feed and /saved→/library.
 */
export default function ReferralsPage() {
  redirect("/grow?tab=referrals");
}
