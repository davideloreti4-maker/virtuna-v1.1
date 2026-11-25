import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevYou, type DevYouState } from "./dev-you";

/**
 * /dev/you — You (spec 2026-11-24 §3.3, "Done when" 2) in each state, on fixtures and local state,
 * inside the real shell. Nothing here sends anything. Dev-only: the /dev layout 404s it in
 * production, and with the flag off it does not exist.
 *
 *   /dev/you?state=loading|empty|full|no-account|read|not-read|read-no-account|open|failed|signup
 *
 * - full (default): everything told, two accounts, a read (the drawing's left phone and desktop)
 * - empty: nothing told, no account (no Accounts section; Connect opens the form in its card)
 * - open: the same with "How you sound" open (the middle phone)
 * - no-account: everything told, no account · read: nothing told, one account with a read
 * - read-no-account: everything told, a read, every account disconnected (one quiet "Connect an account")
 * - not-read: nothing told, one account Maven has not read yet ("Set up audience", rulings 5 and 11)
 * - failed: everything told, "What you sell" open after a refused save (saves keep refusing)
 * - loading · signup (a /go visitor)
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevYouState[] = [
  "loading",
  "empty",
  "full",
  "no-account",
  "read",
  "not-read",
  "read-no-account",
  "open",
  "failed",
  "signup",
];
const isState = (value: string): value is DevYouState => (STATES as readonly string[]).includes(value);

export default async function DevYouPage({ searchParams }: { searchParams: Promise<Params> }) {
  // You exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const state = one((await searchParams).state) ?? "full";
  if (!isState(state)) notFound();
  return <DevYou key={state} state={state} />;
}
