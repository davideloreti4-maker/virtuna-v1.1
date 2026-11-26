import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevSettings, type DevSettingsState } from "./dev-settings";

/**
 * /dev/settings — Settings under the new look (spec 2026-11-26-settings, sections 2.1 to 2.4 and 8) in
 * each state, on fixtures (`fixtures.ts`, fixed days) and local handlers, inside the real shell.
 * Nothing here sends anything. Dev-only: the /dev layout 404s it in production, and with the flag off
 * it does not exist.
 *
 *   /dev/settings?state=paid|none|none-used|trial|cancelled|pastdue|studio
 *   /dev/settings?state=google|noemail|loading|error
 *   /dev/settings?state=delete-blocked|delete-confirm|delete-failed|delete-whop
 *
 * - paid (default): Creator, renews 14 Dec, 312 of 500 credits left
 * - none: no plan, the $1 trial unused · none-used: no plan, the trial used
 * - trial · cancelled · pastdue (payment failed) · studio (unlimited credits)
 * - google: the email signs in with Google · noemail: an account with no email
 * - loading: the plan card's outline · error: the plan could not be read; Try again loads it
 * - delete-blocked: the delete sheet open on "Cancel your plan first" (the plan renews)
 * - delete-confirm: the sheet on its confirm; a typed DELETE holds on "Deleting…"
 * - delete-failed, delete-whop: the confirm, whose delete fails, or cannot ask Whop
 * - A password with "fail" in it is refused; any other saves.
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevSettingsState[] = [
  "paid",
  "none",
  "none-used",
  "trial",
  "cancelled",
  "pastdue",
  "studio",
  "google",
  "noemail",
  "loading",
  "error",
  "delete-blocked",
  "delete-confirm",
  "delete-failed",
  "delete-whop",
];
const isState = (value: string): value is DevSettingsState => (STATES as readonly string[]).includes(value);

export default async function DevSettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  // The new Settings exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const state = one((await searchParams).state) ?? "paid";
  if (!isState(state)) notFound();
  return <DevSettings key={state} state={state} />;
}
