import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevField, type DevFieldState } from "./dev-field";

/**
 * /dev/field — the new message field and its More sheet in each state of the reference
 * (`.scratch/next-look/part3/field-reference.png`), on local state over a plain background,
 * docked where a thread docks it. For looking at it; nothing here sends anything. Dev-only: the
 * /dev layout 404s it in production, and with the flag off it does not exist.
 *
 *   /dev/field?state=rest|hooks|typed|video|simulate|more|streaming[&brief=1]
 *
 * - video: Simulate selected, waiting for a video; pick one with + (the shot script picks a clip)
 * - brief=1: with Simulate selected, the hook brief a card hands over
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevFieldState[] = ["rest", "hooks", "typed", "video", "simulate", "more", "streaming"];
const isState = (value: string): value is DevFieldState => (STATES as readonly string[]).includes(value);

export default async function DevFieldPage({ searchParams }: { searchParams: Promise<Params> }) {
  // The field exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "rest";
  if (!isState(state)) notFound();
  return <DevField key={state} state={state} withBrief={one(params.brief) === "1"} />;
}
