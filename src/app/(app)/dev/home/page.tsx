import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevHome, type DevHomeState } from "./dev-home";

/**
 * /dev/home — the new Home (spec 2026-11-23, redrawn by 2026-11-25 §2) in each state, on local
 * state, inside the real shell. For looking at it; nothing here sends anything. Dev-only: the /dev
 * layout 404s it in production, and with the flag off it does not exist.
 *
 *   /dev/home?state=empty|chats|plain|pending|picked|simulate|noname|unlimited|audience|general|money
 *
 * - chats (default): five recent chats as Library's summary draws them (tile, line, gauge), on
 *   desktop whether the sidebar is open or the rail; plain: the same rows before that summary is in
 *   (the chat mark, titles and times)
 * - empty: no chats, so the four cards under the field; pending: the chat list not answered yet, so
 *   nothing under the field
 * - picked: Hooks picked by a creator with no chats; simulate: the same with Simulate. The cards
 *   stay; the skill is the selected button in the field's row
 * - noname: a profile without a name; unlimited: a plan without a balance
 * - audience: the audience sheet open (from 768 a popover centred under the audience line); general:
 *   the General audience in use ("For a general audience")
 * - money: "Money made" at the end of the page, only above zero (spec §2.6): $58.80 by default.
 *   `&earned=124050` says that many cents ($1,240.50, a long amount, for the narrow widths);
 *   `&earned=0` is nothing earned and `&earned=none` a number that could not be read: no row.
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevHomeState[] = ["empty", "chats", "plain", "pending", "picked", "simulate", "noname", "unlimited", "audience", "general", "money"];
const isState = (value: string): value is DevHomeState => (STATES as readonly string[]).includes(value);

/** What the state `money` shows when no `earned` is given: $58.80, so the row is on the page. */
const DEFAULT_EARNED_CENTS = 5880;

/** `earned`: whole cents ("124050", "0"), or "none" for no amount; not given, or anything else, the default. */
const centsOf = (value: string | undefined): number | null =>
  value === "none" ? null : value !== undefined && /^\d{1,12}$/.test(value) ? Number(value) : DEFAULT_EARNED_CENTS;

export default async function DevHomePage({ searchParams }: { searchParams: Promise<Params> }) {
  // Home's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "chats";
  if (!isState(state)) notFound();
  const earnedCents = centsOf(one(params.earned));
  return <DevHome key={`${state}-${earnedCents}`} state={state} earnedCents={earnedCents} />;
}
