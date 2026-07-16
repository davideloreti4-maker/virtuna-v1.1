/**
 * /audience/new — Create audience page (full page, mobile-first, not a modal).
 * Renders inside (app)/layout.tsx → AppShell. Wraps its content in the shared
 * full-bleed radial surface shell (matches /start · /audience · /grow).
 */

import { SURFACE_RADIAL_BG } from "@/components/surfaces/surface-canvas";
import { AudienceForm } from "@/components/audience/audience-form";
import { createClient } from "@/lib/supabase/server";
import {
  listConnectedAccounts,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";
import type { AccountOption } from "@/components/audience/audience-manager";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";

export const metadata = {
  title: "Create audience | Maven",
};

export default async function NewAudiencePage({
  searchParams,
}: {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{
    mode?: string;
    source?: string;
    accountId?: string;
    platform?: string;
    handle?: string;
  }>;
}) {
  const sp = await searchParams;
  // D-08 — the description Build path lands a General SIM; any other/absent value
  // keeps the byte-identical Socials default.
  //
  // While HORIZONTAL_ENABLED is off, `?mode=general` is IGNORED and the page falls back to
  // the Socials default — a hand-typed or bookmarked URL must not be a back door into the
  // horizontal after its UI entry points are closed. The page itself is unchanged for the
  // creator (socials) path, which is how every creator audience is still created.
  const initialMode =
    HORIZONTAL_ENABLED && sp.mode === "general" ? "general" : undefined;

  // Connected accounts power the "Calibrate from" source picker. The connect flow deep-links
  // here (?source=account&accountId&platform&handle) to preselect the account it just connected.
  // The whole resolve is best-effort — any read failure just yields no picker (manual @handle).
  let accounts: AccountOption[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const connected = await listConnectedAccounts(supabase, user.id);
      accounts = connected.map((a: ConnectedAccount) => ({
        id: a.id,
        handle: a.handle,
        platform: a.platform,
        is_primary: a.is_primary,
        last_synced_at: a.last_synced_at,
      }));
    }
  } catch {
    accounts = [];
  }

  const preselect =
    sp.source === "account" && sp.accountId
      ? { accountId: sp.accountId, handle: sp.handle, platform: sp.platform }
      : undefined;

  return (
    <div className="relative min-h-full text-foreground" style={{ background: SURFACE_RADIAL_BG }}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
        <div className="rv-in space-y-6">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Create audience</h1>
            <p className="mt-1 text-sm text-foreground-secondary">
              Name your audience, then calibrate it from your @handle or a description.
            </p>
          </div>
          <AudienceForm initialMode={initialMode} accounts={accounts} preselect={preselect} />
        </div>
      </div>
    </div>
  );
}
