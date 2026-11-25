"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { reportSession401 } from "@/lib/auth/session-expired";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { field, pullFailureOf, pulledCardsOf, type PullFailure, type PullState, type PullSubject, type PulledVideo } from "@/lib/discover-next/pull";

/**
 * A live pull (spec 3.6): the one request of the new Discover that spends credits, and the only place
 * that sends it. `POST /api/discover` with the subject's input; a fresh read costs 5 credits, a result
 * the server read today already is served again for free.
 *
 * - Nothing goes out until `start`.
 * - A pull is held by its input in module memory, as the hub keeps its return point: running while its
 *   request is out, then its cards for 30 minutes. The server bills a read when it delivers it, page or
 *   no page; so a page left while it reads (Back, New chat) and opened again shows it reading, or its
 *   cards, and offers nothing to pay for twice. A `start` while one is out, or while its cards are held,
 *   sends nothing; two pages for one input send one request. A reload empties the memory and shows the
 *   offer (a result the server holds is then served again for free).
 * - A refusal the app answers on its own (no credits: the wall; a lapsed session: the sign-in dialog) is
 *   the whole answer: back to the offer, with no failure under the dialog to retry against. Nothing held.
 * - Any other refusal is said in words (`pullFailureOf`) to the pages open on it, and nothing is held: a
 *   later visit shows the offer. An answer whose body cannot be read, a request that throws, are
 *   "Couldn't read".
 */
export interface UsePull {
  state: PullState;
  start(): void;
}

const ROUTE = "/api/discover";

/** How long a pull's cards stay held: as long as the hub keeps its place. */
export const HELD_PULL_MS = 30 * 60_000;

type Held = { kind: "running" } | { kind: "done"; videos: PulledVideo[]; at: number };

const held = new Map<string, Held>();
/** The pages open on an input: told when its pull changes, and when it ends without being held. */
const watchers = new Map<string, Set<(ended: PullFailure | null) => void>>();

/** What is held for an input now; cards past their time are let go. */
function heldFor(input: string): Held | undefined {
  const entry = held.get(input);
  if (entry?.kind === "done" && Date.now() - entry.at > HELD_PULL_MS) {
    held.delete(input);
    return undefined;
  }
  return entry;
}

/** Holds (or lets go of) an input's pull and tells the pages open on it. `ended`: a failure to say, or
 *  null for a pull that ended with nothing to say (a wall) or changed. */
function hold(input: string, entry: Held | null, ended: PullFailure | null = null) {
  if (entry) held.set(input, entry);
  else held.delete(input);
  for (const watcher of watchers.get(input) ?? []) watcher(ended);
}

function watch(input: string, watcher: (ended: PullFailure | null) => void): () => void {
  const set = watchers.get(input) ?? new Set();
  set.add(watcher);
  watchers.set(input, set);
  return () => {
    set.delete(watcher);
    if (set.size === 0) watchers.delete(input);
  };
}

/** Lets go of every held pull (a fresh start: a test, or a new session in the same tab). */
export function forgetPulls(): void {
  held.clear();
}

async function bodyOf(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** Sends the pull for `subject` and holds what comes back. */
async function send(subject: PullSubject): Promise<void> {
  const { input } = subject;
  try {
    const res = await fetch(ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    const body = await bodyOf(res);
    if (res.ok) {
      const videos = pulledCardsOf(field(body, "tiles"), subject);
      if (videos) hold(input, { kind: "done", videos, at: Date.now() });
      else hold(input, null, pullFailureOf(0, null, subject));
      return;
    }
    if (reportCredit402(res.status, body) || reportSession401(res.status)) {
      hold(input, null);
      return;
    }
    hold(input, null, pullFailureOf(res.status, body, subject));
  } catch {
    hold(input, null, pullFailureOf(0, null, subject));
  }
}

const IDLE: PullState = { kind: "idle" };
const RUNNING: PullState = { kind: "running" };
const NO_INPUT = () => () => {};

export function usePull(subject: PullSubject | null): UsePull {
  const input = subject?.input ?? null;

  // A change to what is held for this input re-renders the page.
  const subscribe = useCallback((onChange: () => void) => (input === null ? NO_INPUT() : watch(input, onChange)), [input]);
  const entry = useSyncExternalStore(
    subscribe,
    () => (input === null ? undefined : heldFor(input)),
    () => undefined,
  );

  // The failure said to the pages open on this input; any other change (a new start, a wall) clears it.
  const [failure, setFailure] = useState<{ input: string; failure: PullFailure } | null>(null);
  useEffect(() => {
    if (input === null) return;
    return watch(input, (ended) => setFailure(ended ? { input, failure: ended } : null));
  }, [input]);

  const start = useCallback(() => {
    if (!subject || heldFor(subject.input)) return;
    hold(subject.input, { kind: "running" });
    void send(subject);
  }, [subject]);

  let state: PullState = IDLE;
  if (entry?.kind === "running") state = RUNNING;
  else if (entry?.kind === "done") state = { kind: "done", videos: entry.videos };
  else if (failure && failure.input === input) state = { kind: "failed", failure: failure.failure };
  return { state, start };
}
