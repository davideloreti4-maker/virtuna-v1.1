"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { textResultHref, type TextResultAs } from "@/lib/result/text-result";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import type { GaugeState } from "./answer-gauge";

/**
 * The result-page keys of the texts a card can link (thread answers step 2). The key is async
 * (`sealHashOf`, Web Crypto), so a text's key is known one tick after it first renders; until then the
 * card draws no link, never a dead one.
 *
 * Keys found are kept for the tab (a key never changes) in one small store that every card reads
 * (`useSyncExternalStore`): a remount (the live → persisted swap) has them at once, and a card learns a
 * key another card found, however their renders and hashes interleave. The store holds at most
 * `LIMIT` keys; past that the oldest found goes first (a card whose key went keeps its words, unlinked,
 * until it mounts again).
 */

const LIMIT = 500;
const SEP = "\u0000";
const NONE: ReadonlyMap<string, string> = new Map();

let known: ReadonlyMap<string, string> = NONE;
const listeners = new Set<() => void>();

/** Adds the keys found (a text already known keeps its place) and tells every card once. */
function remember(found: readonly (readonly [string, string])[]) {
  const next = new Map(known);
  for (const [text, key] of found) if (!next.has(text)) next.set(text, key);
  if (next.size === known.size) return;
  for (const oldest of next.keys()) {
    if (next.size <= LIMIT) break;
    next.delete(oldest);
  }
  known = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => known;
// The server hashes nothing, and a hydrating card must draw what the server drew: no links.
const serverSnapshot = () => NONE;

export function useSealKeys(texts: readonly string[]): ReadonlyMap<string, string> {
  const sig = texts
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .join(SEP);
  const store = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  useEffect(() => {
    const missing = [...new Set(sig ? sig.split(SEP) : [])].filter((t) => !known.has(t));
    if (missing.length === 0) return;
    // A text whose hash fails (no Web Crypto on an insecure page) gets no key, so no link.
    void Promise.allSettled(missing.map((t) => sealHashOf(t))).then((results) => {
      remember(results.flatMap((r, i) => (r.status === "fulfilled" ? [[missing[i]!, r.value] as const] : [])));
    });
  }, [sig]);

  return useMemo(() => {
    const out = new Map<string, string>();
    for (const t of sig ? sig.split(SEP) : []) {
      const key = store.get(t);
      if (key) out.set(t, key);
    }
    return out;
  }, [sig, store]);
}

/** The result page of a simulated text, once the thread and its key are known; else none. */
export function resultLinkOf(
  state: GaugeState,
  threadId: string | null,
  key: string | null | undefined,
  as: TextResultAs,
): string | null {
  return state.kind === "done" && threadId && key ? textResultHref(threadId, key, as) : null;
}
