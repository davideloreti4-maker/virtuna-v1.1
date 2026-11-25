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
import { AudienceManager, type AccountOption } from "@/components/audience/audience-manager";
import { AudienceNext } from "@/components/audience-next/audience-next";
import { readAudiencePage } from "@/lib/audience-next/read-audience-page";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

export const metadata = {
  title: NEW_LOOK_ENABLED ? "Audience | Maven" : "Your audiences | Maven",
};

/**
 * New look (spec 2026-11-25-audience, 3.1): the audience new chats use, as one page. The one server read
 * decides what is shown, and keeps the old `?tab=account` address redirecting to that account's audience.
 * Keyed by the audience shown, so another audience is a fresh screen.
 */
async function newLook({ tab, account }: { tab?: string; account?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const read = await readAudiencePage(supabase, user.id, { route: "index", tab, account }, new Date());
  if (read.kind === "redirect") redirect(read.to); // outside any try: redirect() throws
  return <AudienceNext key={read.kind === "audience" ? read.page.id : read.kind} read={read} />;
}

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
  if (NEW_LOOK_ENABLED) return newLook(await searchParams);
  const { tab, account: accountParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let accounts: AccountOption[] = [];
  if (user) {
    try {
      accounts = (await listConnectedAccounts(supabase, user.id)).map(toOption);
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
