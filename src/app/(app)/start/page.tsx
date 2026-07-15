import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAudiences } from "@/lib/audience/audience-repo";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import type { Audience } from "@/lib/audience/audience-types";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { getPrimaryAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { buildAccountStats } from "@/lib/account-metrics/account-metrics";
import type { StatCard } from "@/lib/room-contract/mock-room";
import { getFreshSurfaceCards, audienceKeyOf } from "@/lib/surfaces/surface-reactions-repo";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { listRecentReconciliations } from "@/lib/flywheel/reconciliation-repo";
import { buildLoopReceipts, buildLoopAccuracy, nowMs, type LoopReceipt, type LoopAccuracy } from "@/lib/flywheel/loop-summary";
import { StartPage } from "@/components/surfaces/start-page";

export const metadata: Metadata = {
  title: "Home | Maven",
  description:
    "Your day, pre-tested on your people — daily ideas, outcome capture, and how your last calls actually landed.",
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
 * MVP launch cut (lane/launch-prep, 2026-07-15): the hero is REAL (name+time greeting, live loop
 * rings, static quick-action copy); the Outliers/Calendar/Today's-plan sections were removed with
 * Discover/Calendar. Does NOT touch the /home composer/thread (The Room's).
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

  // The user's audiences (Seam 3): fed to the app-wide dock's switcher. Includes the General
  // baseline + presets (listAudiences prepends them). On any read error, fall back to an empty
  // list → honest first-run (never fabricate a briefing for a user we can't confirm has connected).
  let audiences: Audience[] = [];
  try {
    audiences = await listAudiences(supabase);
  } catch {
    audiences = [];
  }
  const hasCalibrated = audiences.some((a) => !a.is_general && a.signature != null);

  // The active audience on the dock = the user-level last-used (resolveUserAudience — the same
  // read /home seeds new threads from, so the dock and the thread agree). Always resolves
  // (General on any failure). A General resolution ⇒ null id (the switcher's General row).
  const activeAudience = await resolveUserAudience(supabase, user.id);
  const initialSelectedAudienceId = activeAudience.is_general ? null : activeAudience.id;

  const initialFirstRun =
    first === "1" ? true : first === "0" ? false : !hasCalibrated;

  // Real stat-row data (honesty spine): derived from the user's own account_snapshots
  // time-series. Null when there are no snapshots yet → StartPage renders an honest
  // "gathering your numbers" state instead of fabricated analytics. Skipped for
  // first-run (no connected account to read).
  // Reads the PRIMARY connected account's series (the switcher's default). Null
  // when nothing is connected → the honest "gathering your numbers" state.
  let accountStats: StatCard[] | null = null;
  if (!initialFirstRun) {
    try {
      const primary = await getPrimaryAccount(supabase, user.id);
      accountStats = primary
        ? buildAccountStats(await getAccountSnapshots(supabase, primary.id), primary.platform)
        : null;
    } catch {
      accountStats = null;
    }
  }

  // Pre-tested cards (Seams 1/2): serve a FRESH cached batch for the active audience so the page
  // renders instantly. A miss (or a stale/first-of-the-day cache) leaves these null → StartPage
  // warms each lazily via POST /api/surfaces/{outliers,ideas}. Skipped for first-run (no audience).
  const audienceKey = audienceKeyOf(activeAudience);
  let initialIdeas: LiveIdeaCard[] | null = null;
  if (!initialFirstRun) {
    initialIdeas = await getFreshSurfaceCards<LiveIdeaCard>(supabase, user.id, audienceKey, "idea");
  }

  // Real "the loop" (FLYWHEEL): the user's recent reconciliations → honest predicted-vs-actual
  // receipts + aggregate match %. Skipped for first-run (no history). `now` is stamped here (SSR)
  // so the relative "when" labels never re-compute client-side (hydration). Total (never throws).
  let loopReceipts: LoopReceipt[] = [];
  let loopAccuracy: LoopAccuracy | null = null;
  if (!initialFirstRun) {
    const reconciliations = await listRecentReconciliations(supabase, 6);
    loopReceipts = buildLoopReceipts(reconciliations, nowMs());
    loopAccuracy = buildLoopAccuracy(reconciliations);
  }

  return (
    <StartPage
      initialFirstRun={initialFirstRun}
      loopReceipts={loopReceipts}
      loopAccuracy={loopAccuracy}
      accountStats={accountStats}
      audiences={audiences}
      initialSelectedAudienceId={initialSelectedAudienceId}
      initialIdeas={initialIdeas}
    />
  );
}
