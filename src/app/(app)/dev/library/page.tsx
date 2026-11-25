import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevLibrary, type DevLibraryState } from "./dev-library";

/**
 * /dev/library — the new Library (spec 2026-11-23-library; reference v11 Library A and the desktop
 * table) in each state, on fixtures and local state, inside the real shell. For looking at it;
 * nothing here sends anything. Dev-only: the /dev layout 404s it in production, and with the flag
 * off it does not exist.
 *
 *   /dev/library?state=chats|loading|empty|drafts|simulated|saved|search|error[&q=<query>]
 *
 * - chats (default): eight chats, "Show more" (it adds three older ones)
 * - loading: the six placeholder rows · error: the failure and Try again · empty: no chats at all
 * - drafts / simulated / saved: that chip selected
 * - search: the field open with a query ("morning" unless `q` gives one; a `q` that matches
 *   nothing shows the search's empty line)
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevLibraryState[] = ["chats", "loading", "empty", "drafts", "simulated", "saved", "search", "error"];
const isState = (value: string): value is DevLibraryState => (STATES as readonly string[]).includes(value);

export default async function DevLibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  // Library's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "chats";
  if (!isState(state)) notFound();
  const query = one(params.q) ?? null;
  return <DevLibrary key={`${state}-${query ?? ""}`} state={state} query={query} />;
}
