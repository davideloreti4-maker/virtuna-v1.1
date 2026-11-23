import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevHome, type DevHomeState } from "./dev-home";

/**
 * /dev/home — the new Home (spec 2026-11-23, drawings `ax-p1.png`, `ax-p2.png`, `ax-d1.png`) in
 * each state, on local state, inside the real shell. For looking at it; nothing here sends
 * anything. Dev-only: the /dev layout 404s it in production, and with the flag off it does not
 * exist.
 *
 *   /dev/home?state=empty|chats|picked|simulate|noname|unlimited|audience[&recent=1]
 *
 * - chats (default): three recent chats; empty: none
 * - picked: Hooks picked; simulate: Simulate picked
 * - noname: a profile without a name; unlimited: a plan without a balance
 * - audience: the audience sheet open
 * - recent=1: Recent shown on desktop too, as while the sidebar is the rail
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevHomeState[] = ["empty", "chats", "picked", "simulate", "noname", "unlimited", "audience"];
const isState = (value: string): value is DevHomeState => (STATES as readonly string[]).includes(value);

export default async function DevHomePage({ searchParams }: { searchParams: Promise<Params> }) {
  // Home's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "chats";
  if (!isState(state)) notFound();
  const recentOnDesktop = one(params.recent) === "1";
  return <DevHome key={`${state}-${recentOnDesktop}`} state={state} recentOnDesktop={recentOnDesktop} />;
}
