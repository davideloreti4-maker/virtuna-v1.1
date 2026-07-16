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
import {
  listConnectedAccounts,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import { AudienceManager, type AccountOption } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences | Maven",
};

/** Slim the repo row to what the switcher needs (client-serializable). */
function toOption(a: ConnectedAccount): AccountOption {
  return {
    id: a.id,
    handle: a.handle,
    platform: a.platform,
    is_primary: a.is_primary,
    last_synced_at: a.last_synced_at,
  };
}

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; account?: string }>;
}) {
  const { tab, account: accountParam } = await searchParams;
  const initialTab = tab === "account" ? "account" : "audiences";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Account analytics band — real account metrics + pillars for the SELECTED connected
  // account (the switcher). ?account=<id> picks it; default = primary, then oldest. Empty on
  // any read error or a low-post account → the band shows its honest empty state.
  let accounts: AccountOption[] = [];
  let selectedAccountId: string | undefined;
  let snapshots: AccountSnapshot[] = [];
  let pillars: Pillar[] = [];
  if (user) {
    try {
      const connected = await listConnectedAccounts(supabase, user.id);
      accounts = connected.map(toOption);
      const selected =
        connected.find((a) => a.id === accountParam) ??
        connected.find((a) => a.is_primary) ??
        connected[0];
      selectedAccountId = selected?.id;
      snapshots = selected ? await getAccountSnapshots(supabase, selected.id, 100) : [];
      pillars = await buildContentPillars(supabase, user.id, selected?.id);
    } catch {
      snapshots = [];
      pillars = [];
    }
  }

  return (
    <AudienceManager
      snapshots={snapshots}
      pillars={pillars}
      accounts={accounts}
      selectedAccountId={selectedAccountId}
      initialTab={initialTab}
    />
  );
}
