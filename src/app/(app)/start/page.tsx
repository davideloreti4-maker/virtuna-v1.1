import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAudiences } from "@/lib/audience/audience-repo";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { buildAccountStats } from "@/lib/account-metrics/account-metrics";
import type { StatCard } from "@/lib/room-contract/mock-room";
import { StartPage } from "@/components/surfaces/start-page";

export const metadata: Metadata = {
  title: "Start | Maven",
  description:
    "Your day, pre-tested on your people — daily ideas, outliers to remix, the plan, and what actually happened.",
};

/**
 * /start — the flagship Surfaces start page (START-PAGE-BUILD-HANDOFF.md §4.2).
 *
 * Lives inside the (app) route group so it inherits AppShell (sidebar + the ToastProvider
 * the Seam-4 handoff uses) + the server auth gate. Auth-gated here too as defense-in-depth
 * (mirrors /feed, /library). AppShell owns the <main>; this renders a plain client shell —
 * do NOT nest a second <main>.
 *
 * First-run detection is REAL (honesty spine): a user who hasn't connected an account yet
 * has no calibrated audience, so we show the honest "connect your account" state instead of
 * a fabricated briefing. Connected = at least one non-general audience carrying a frozen
 * `signature` (present only for scrape-calibrated rows — null for General/presets/uncalibrated).
 * Review overrides: `?first=1` forces first-run, `?first=0` forces the briefing.
 *
 * The briefing still stubs the Room ⇄ Surfaces contract with mock data (see mock-room.ts) —
 * swap stub → real when The Room ships (a graft, not a rebuild). Does NOT touch the /home
 * composer/thread (The Room's).
 */
export default async function StartRoute({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { first } = await searchParams;

  // Honest default: has this user connected an account (⇒ a calibrated audience) yet?
  // On any read error, fall back to first-run — never fabricate a briefing for a user we
  // can't confirm has connected.
  let hasCalibrated = false;
  try {
    const audiences = await listAudiences(supabase);
    hasCalibrated = audiences.some((a) => !a.is_general && a.signature != null);
  } catch {
    hasCalibrated = false;
  }

  const initialFirstRun =
    first === "1" ? true : first === "0" ? false : !hasCalibrated;

  // Real stat-row data (honesty spine): derived from the user's own account_snapshots
  // time-series. Null when there are no snapshots yet → StartPage renders an honest
  // "gathering your numbers" state instead of fabricated analytics. Skipped for
  // first-run (no connected account to read).
  let accountStats: StatCard[] | null = null;
  if (!initialFirstRun) {
    try {
      accountStats = buildAccountStats(await getAccountSnapshots(supabase, user.id));
    } catch {
      accountStats = null;
    }
  }

  return <StartPage initialFirstRun={initialFirstRun} accountStats={accountStats} />;
}
