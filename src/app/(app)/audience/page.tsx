/**
 * /audience — Audience Manager list page (the MOAT surface).
 * Renders inside (app)/layout.tsx → AppShell (sidebar, AuthGuard, providers).
 * AppShell owns the page <main>; AudienceManager renders the full-bleed
 * surface shell itself (relative min-h-full) — do NOT wrap it in a container.
 *
 * The "Your account" analytics tab is DEAD (rebuild P2): account analytics live
 * in the SOURCE zone of the account's audience detail page. Legacy ?tab=account
 * deep-links (the /analytics + /grow redirects) resolve to that detail page —
 * /audience/[id] canonicalizes an account id to its audience's URL.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listConnectedAccounts,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { buildRangeMetrics } from "@/lib/account-metrics/account-metrics";
import { AudienceManager, type AccountOption } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences | Maven",
};

/** Slim the repo row to what the roster needs (client-serializable). */
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let accounts: AccountOption[] = [];
  if (user) {
    try {
      accounts = (await listConnectedAccounts(supabase, user.id)).map(toOption);
      // The row states the SCALE of the scrape behind each account (rework 2026-07-20).
      // Same source the detail page's SOURCE figures read — never an estimate, and null
      // when no snapshot exists, so the row simply omits the fact rather than inventing it.
      accounts = await Promise.all(
        accounts.map(async (a) => {
          try {
            const snapshots = await getAccountSnapshots(supabase, a.id, 100);
            const followers = (buildRangeMetrics(snapshots, 90, a.platform) ?? []).find(
              (m) => m.label === "Followers" && m.value !== "—",
            );
            return { ...a, followers: followers?.value ?? null };
          } catch {
            return { ...a, followers: null };
          }
        }),
      );
    } catch {
      accounts = [];
    }
  }

  // Legacy deep-link: the analytics tab is gone; its content lives on the
  // account's detail page. redirect() throws — this sits outside any try.
  if (tab === "account") {
    const target =
      accounts.find((a) => a.id === accountParam) ??
      accounts.find((a) => a.is_primary) ??
      accounts[0];
    redirect(target ? `/audience/${target.id}` : "/audience");
  }

  return <AudienceManager accounts={accounts} />;
}
