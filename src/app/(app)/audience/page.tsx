/**
 * /audience — Audience Manager list page (the MOAT surface).
 * Renders inside (app)/layout.tsx → AppShell (sidebar, AuthGuard, providers).
 * AppShell owns the page <main>; AudienceManager renders the full-bleed radial
 * surface shell itself (relative min-h-full), mirroring /start — so do
 * NOT wrap it in a max-w container here.
 *
 * Account analytics (the old /grow "Numbers" tab) folds in here as a "Your account"
 * band below the roster: your real numbers (account_snapshots) + content pillars sit
 * with your people (the calibrated audiences), one surface. Data is fetched server-side
 * and passed to AudienceManager; both are REAL (honest empty states, never faked deltas).
 */

import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { createClient } from "@/lib/supabase/server";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { getPrimaryAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import { AudienceManager } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences | Maven",
};

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "account" ? "account" : "audiences";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Account analytics band — real account metrics + pillars. Empty on any read error
  // or a low-post account → the band shows its honest "connect / learning" empty state.
  let snapshots: AccountSnapshot[] = [];
  let pillars: Pillar[] = [];
  if (user) {
    try {
      const primary = await getPrimaryAccount(supabase, user.id);
      snapshots = primary ? await getAccountSnapshots(supabase, primary.id, 100) : [];
    } catch {
      snapshots = [];
    }
    try {
      pillars = await buildContentPillars(supabase, user.id);
    } catch {
      pillars = [];
    }
  }

  return <AudienceManager snapshots={snapshots} pillars={pillars} initialTab={initialTab} />;
}
