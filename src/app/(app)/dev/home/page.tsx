import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevHome, type DevHomeState } from "./dev-home";

/**
 * /dev/home — the new Home (spec 2026-11-23, drawings `ax-p1.png`, `ax-p2.png`, `ax-d1.png`) in
 * each state, on local state, inside the real shell. For looking at it; nothing here sends
 * anything. Dev-only: the /dev layout 404s it in production, and with the flag off it does not
 * exist.
 *
 *   /dev/home?state=empty|chats|plain|picked|simulate|noname|unlimited|audience|money[&recent=1][&remixes=ready|warming]
 *
 * - chats (default): three recent chats as Library's summary draws them (tile, line, gauge);
 *   plain: the same rows before that summary is in (the chat mark, titles and times); empty: none
 * - picked: Hooks picked; simulate: Simulate picked
 * - noname: a profile without a name; unlimited: a plan without a balance
 * - audience: the audience sheet open
 * - money: the "Money made" row above the field (Earn, rulings 18 and 24), saying $0. With
 *   `&earned=124050` it says that many cents ($1,240.50: a long amount, for the narrow widths); with
 *   `&earned=none` no amount (an enrolled creator whose number could not be read). Every other state
 *   is Home without the row.
 * - recent=1: Recent shown on desktop too, as while the sidebar is the rail
 * - remixes=ready: the remix carousel above the field, from four fixture drops; remixes=warming: its
 *   ghost cards. Without it, no carousel (the composer's warm is not run here: nothing is spent).
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevHomeState[] = ["empty", "chats", "plain", "picked", "simulate", "noname", "unlimited", "audience", "money"];
const isState = (value: string): value is DevHomeState => (STATES as readonly string[]).includes(value);

/** `earned`: whole cents ("124050"), or "none" for no amount; anything else is nothing earned. */
const centsOf = (value: string | undefined): number | null =>
  value === "none" ? null : value !== undefined && /^\d{1,12}$/.test(value) ? Number(value) : 0;

export default async function DevHomePage({ searchParams }: { searchParams: Promise<Params> }) {
  // Home's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "chats";
  if (!isState(state)) notFound();
  const recentOnDesktop = one(params.recent) === "1";
  const remixParam = one(params.remixes);
  const remixes = remixParam === "ready" || remixParam === "warming" ? remixParam : null;
  return (
    <DevHome
      key={`${state}-${recentOnDesktop}-${remixes}`}
      state={state}
      recentOnDesktop={recentOnDesktop}
      earnedCents={centsOf(one(params.earned))}
      remixes={remixes}
    />
  );
}
