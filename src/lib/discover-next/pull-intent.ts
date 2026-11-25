/**
 * The pull intent (spec 3.6: the offer is a row, never a start, and only its button starts a pull). A
 * Pull button arms it just before it navigates to the pull page; the page takes it on mount and starts
 * at once. An address alone never carries it, so arriving by address (a link, a reload, Back) shows the
 * offer and spends nothing.
 *
 * A module memory, as `lib/onboarding/pending-upload.ts` stages a file: `router.push` keeps the
 * module, a reload does not. Taken once: the slot is cleared on every take, so a second effect or a
 * later visit can never start a second, billed pull.
 *
 * A press whose page never took it is dropped: the place that armed it drops it on arriving there again,
 * and on going anywhere but that pull page. Else a Forward to the address within the 15 seconds would
 * start a paid pull with no press.
 */

import { pullHref } from "./discover-view";

/** How long an armed pull stays good: long enough for a slow client navigation. */
export const PULL_INTENT_MS = 15_000;

let armed: { input: string; at: number } | null = null;

/** A Pull button is pressed for `input`: arm it. A second arm replaces the first. */
export function armPull(input: string, now: number = Date.now()): void {
  const trimmed = input.trim();
  armed = trimmed ? { input: trimmed, at: now } : null;
}

/** The pull page mounts for `input`: true once, when that input was armed within 15 seconds. */
export function takePull(input: string, now: number = Date.now()): boolean {
  const intent = armed;
  armed = null;
  return intent !== null && intent.input === input.trim() && now - intent.at <= PULL_INTENT_MS;
}

/** Drops whatever is armed (the place a Pull is pressed is shown again: any press before it was left behind). */
export function dropPull(): void {
  armed = null;
}

/**
 * The place that armed the intent goes away, with the browser at `address`. A press leaves for its own
 * pull page, and the router has written that address by the time the old page is gone: the intent is
 * kept for it. Gone anywhere else, the press was left behind, and the intent is dropped.
 */
export function keepPullOnlyAt(address: string): void {
  if (!armed) return;
  const base = "http://localhost";
  const here = new URL(address, base);
  const page = new URL(pullHref(armed.input), base);
  const itsPage = here.pathname === page.pathname && (here.searchParams.get("input") ?? "").trim() === armed.input;
  if (!itsPage) armed = null;
}
