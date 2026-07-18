import { redirect } from "next/navigation";

/**
 * /grow — deep-link preservation redirect (the GROW hub was dissolved, 2026-07-07).
 *
 * The hub bundled three unrelated jobs under one label; it was pulled apart:
 *   • Numbers (real account analytics) → the SOURCE zone on the account's audience
 *     detail page (rebuild P2; /audience resolves ?tab=account there)
 *   • Monetize (fake mock storefront)  → deleted (see backlog: offer-demand simulation)
 *   • Referrals (Maven's growth loop)  → demoted into /settings (Referrals tab)
 * This route is retained ONLY as a redirect so existing bookmarks / deep links resolve.
 */
export default async function GrowRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab === "referrals" ? "/settings?tab=referrals" : "/audience?tab=account");
}
