"use client";

/**
 * TextSimProvider — the ONE place in the thread that runs text simulations (spec §4.1, plan Task 4).
 *
 * A card's gauge fires `POST /api/tools/react` (1 credit) with the legacy body
 * (`reactRequestBody`, `src/components/app/home/v8/fire-sim.ts`): hook and idea get their framing,
 * script and remix the route's default, exactly as the legacy door sends it.
 *
 * - ONE request in flight in the whole provider; the rest wait in a FIFO queue. Parallel `react`
 *   calls lose seals on the server (each run merges into the thread row it read 7-11 s earlier), and
 *   the credit gate holds no reservation, so a queue is also the honest way to spend.
 * - Keys are `sealKey(text)` (trimmed), so duplicate texts share one state and one request.
 * - A result is handed to the composer through `onSealed`; the composer merges it into its seal map
 *   and passes the map back as `seals`. The number a gauge shows is read from that map only
 *   (`stopNumberOf`: `Math.round(population.stopPct)`), the same as for a seal that came with the
 *   thread. Both updates land in one commit, so a row goes from running straight to its number.
 * - The state lives here, above the thread, so a turn's remount on the live → persisted swap keeps a
 *   running row running and a "2 of 3" counting.
 *
 * Outcomes: 200 with a number → sealed. 200 without a usable population → this text failed AND the
 * rest of the queue dropped: the route returns `population: null` deterministically for an audience
 * with no population signature (a preset) and still bills, so every later run would also be paid
 * for and show no number. 402 → the credit wall, this text failed, the rest of the queue dropped (do
 * not keep spending into a wall). Any other status or a network error → failed, the queue goes on.
 * A 401 also announces the ended session, as the legacy fire does.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { reactRequestBody, fractionToStopPct } from "@/components/app/home/v8/fire-sim";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401 } from "@/lib/auth/session-expired";
import { sealKey, type SimSeal } from "@/lib/threads/sim-seals";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import type { GaugeState } from "./answer-gauge";

/** The legacy descriptor kinds (`ambient-descriptors.ts` `KIND_BY_BLOCK_TYPE`). */
export type TextKind = "hook" | "idea" | "script" | "remix";

export interface TextSimApi {
  /** done (a number in the seal map) > running (the one in flight) > waiting (queued) > empty. */
  stateOf(text: string): GaugeState;
  /** Its last simulation failed and it has no number; cleared when it is fired again. */
  failed(text: string): boolean;
  /** Enqueue one. No-op when it is done, queued or running, or empty. For events (a tap): the
   *  queue starts once the provider has mounted. */
  fire(text: string, kind: TextKind): void;
  /** Enqueue the not-done ones, in order, as one batch. */
  fireAll(items: { text: string; kind: TextKind }[]): void;
  /**
   * Non-null while a batch that holds one of `texts` is queued or running, including a single
   * `fire` (total 1). `total` = the items those `fire`/`fireAll` calls enqueued; `done` = how many
   * of them finished (sealed or failed). Batches for these texts that overlap in time are summed, so
   * two single taps read "1 of 2", then "2 of 2".
   */
  progress(texts: readonly string[]): { done: number; total: number } | null;
}

// ─── The queue (pure) ────────────────────────────────────────────────────────

interface Item {
  key: string;
  kind: TextKind;
  batch: number;
}

interface Batch {
  id: number;
  keys: readonly string[];
  total: number;
  finished: number;
  /** `tick` when it was enqueued / when its last item finished (or it was dropped). */
  openedAt: number;
  closedAt: number | null;
}

interface SimState {
  queue: readonly Item[];
  running: Item | null;
  failed: ReadonlySet<string>;
  /** Batches since the queue was last idle (pruned when it goes idle). */
  batches: readonly Batch[];
  tick: number;
  nextBatch: number;
}

const IDLE: SimState = { queue: [], running: null, failed: new Set(), batches: [], tick: 0, nextBatch: 1 };

/** `stop` = failed, and nothing more may be spent: the credit wall, or a billed run with no number. */
type Outcome = "sealed" | "failed" | "stop";

function isBusy(s: SimState, key: string): boolean {
  return s.running?.key === key || s.queue.some((i) => i.key === key);
}

function enqueued(s: SimState, items: { text: string; kind: TextKind }[], isDone: (key: string) => boolean): SimState {
  const seen = new Set<string>();
  const fresh: Item[] = [];
  for (const { text, kind } of items) {
    const key = sealKey(text);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    if (isDone(key) || isBusy(s, key)) continue;
    fresh.push({ key, kind, batch: s.nextBatch });
  }
  if (fresh.length === 0) return s;
  const tick = s.tick + 1;
  const failed = new Set(s.failed);
  for (const i of fresh) failed.delete(i.key);
  const batch: Batch = {
    id: s.nextBatch,
    keys: fresh.map((i) => i.key),
    total: fresh.length,
    finished: 0,
    openedAt: tick,
    closedAt: null,
  };
  return {
    ...s,
    queue: [...s.queue, ...fresh],
    failed,
    batches: [...s.batches, batch],
    tick,
    nextBatch: s.nextBatch + 1,
  };
}

function finished(s: SimState, item: Item, outcome: Outcome): SimState {
  const tick = s.tick + 1;
  const failed = new Set(s.failed);
  if (outcome === "sealed") failed.delete(item.key);
  else failed.add(item.key);
  let batches = s.batches.map((b) => {
    if (b.id !== item.batch) return b;
    const n = b.finished + 1;
    return { ...b, finished: n, closedAt: n >= b.total ? tick : b.closedAt };
  });
  // Stop: drop what is still waiting (back to empty, not failed); every batch ends here.
  const queue = outcome === "stop" ? [] : s.queue;
  if (outcome === "stop") batches = batches.map((b) => (b.closedAt === null ? { ...b, closedAt: tick } : b));
  // Idle: nothing can still be counting, so forget the batches.
  if (queue.length === 0) batches = [];
  return { ...s, running: null, queue, failed, batches, tick };
}

function progressOf(s: SimState, texts: readonly string[]): { done: number; total: number } | null {
  const want = new Set(texts.map(sealKey).filter((k) => k.length > 0));
  const mine = s.batches.filter((b) => b.keys.some((k) => want.has(k)));
  const newest = mine[mine.length - 1];
  // FIFO: batches close in the order they opened, so the newest one is open iff any of them is.
  if (!newest || newest.closedAt !== null) return null;
  // Walk back while each older batch was still open when the group so far began.
  let start = newest.openedAt;
  let done = newest.finished;
  let total = newest.total;
  for (let i = mine.length - 2; i >= 0; i--) {
    const b = mine[i]!;
    if (b.closedAt !== null && b.closedAt <= start) break;
    start = Math.min(start, b.openedAt);
    done += b.finished;
    total += b.total;
  }
  return { done, total };
}

// ─── The request ─────────────────────────────────────────────────────────────

/** The `react` route's 200 body: `{ fraction, scrollQuote, personas, population, slice }`. */
interface ReactOk {
  fraction?: unknown;
  scrollQuote?: unknown;
  personas?: unknown;
  population?: unknown;
}

/** The seal the route wrote, as the client can rebuild it; null when the run has no number. */
function sealOf(data: unknown): SimSeal | null {
  if (!data || typeof data !== "object") return null;
  const d = data as ReactOk;
  if (!d.population || typeof d.population !== "object") return null;
  const seal: SimSeal = {
    pct: (typeof d.fraction === "string" ? fractionToStopPct(d.fraction) : null) ?? 0,
    band: null,
    at: new Date().toISOString(),
    population: d.population as NonNullable<SimSeal["population"]>,
    ...(Array.isArray(d.personas) ? { personas: d.personas as NonNullable<SimSeal["personas"]> } : {}),
    ...(typeof d.scrollQuote === "string" ? { scrollQuote: d.scrollQuote } : {}),
  };
  return stopNumberOf(seal) === null ? null : seal;
}

async function runOne(item: Item, signal: AbortSignal): Promise<{ outcome: Outcome; seal: SimSeal | null }> {
  try {
    const res = await fetch("/api/tools/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reactRequestBody({ text: item.key, kind: item.kind })),
      signal,
    });
    if (res.status === 402) {
      reportCredit402(res.status, await res.json().catch(() => null));
      return { outcome: "stop", seal: null };
    }
    if (!res.ok) {
      reportSession401(res.status);
      return { outcome: "failed", seal: null };
    }
    // A billed 200 with no number: the next ones would be billed the same way, so stop.
    const seal = sealOf(await res.json().catch(() => null));
    return { outcome: seal ? "sealed" : "stop", seal };
  } catch {
    return { outcome: "failed", seal: null };
  }
}

// ─── The provider ────────────────────────────────────────────────────────────

const TextSimContext = createContext<TextSimApi | null>(null);

export function TextSimProvider({
  seals,
  onSealed,
  children,
}: {
  seals: WireSimSealMap;
  onSealed: (key: string, seal: SimSeal) => void;
  children: ReactNode;
}) {
  const [sim, setSim] = useState<SimState>(IDLE);
  // The event-side copies. `simRef` is written together with every `setSim`; the other two follow
  // each commit (layout effect, so a tap right after a result already sees its seal).
  const simRef = useRef<SimState>(IDLE);
  const sealsRef = useRef<WireSimSealMap>(seals);
  const onSealedRef = useRef(onSealed);
  const aliveRef = useRef(false);
  const inflightRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    sealsRef.current = seals;
    onSealedRef.current = onSealed;
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      inflightRef.current?.abort();
      inflightRef.current = null;
    };
  }, []);

  const commit = useCallback((next: SimState) => {
    simRef.current = next;
    setSim(next);
  }, []);

  /** Run the queue to empty, one request at a time. A second call while one runs returns at once:
   *  the loop already in flight picks up whatever was enqueued behind it. */
  const drain = useCallback(async () => {
    for (;;) {
      const s = simRef.current;
      const [item, ...rest] = s.queue;
      if (!aliveRef.current || s.running || !item) return;
      commit({ ...s, running: item, queue: rest });
      const controller = new AbortController();
      inflightRef.current = controller;
      const { outcome, seal } = await runOne(item, controller.signal);
      if (controller.signal.aborted || !aliveRef.current) return;
      inflightRef.current = null;
      // One commit: the composer's map gets the seal as the row leaves "running".
      if (seal) onSealedRef.current(item.key, seal);
      commit(finished(simRef.current, item, outcome));
    }
  }, [commit]);

  const fireAll = useCallback(
    (items: { text: string; kind: TextKind }[]) => {
      const isDone = (key: string) => stopNumberOf(sealsRef.current[key]) !== null;
      const next = enqueued(simRef.current, items, isDone);
      if (next === simRef.current) return;
      commit(next);
      void drain();
    },
    [commit, drain],
  );

  const fire = useCallback((text: string, kind: TextKind) => fireAll([{ text, kind }]), [fireAll]);

  const api = useMemo<TextSimApi>(() => {
    const numberOf = (key: string) => stopNumberOf(seals[key]);
    return {
      stateOf(text) {
        const key = sealKey(text);
        const n = numberOf(key);
        if (n !== null) return { kind: "done", value: n };
        if (sim.running?.key === key) return { kind: "running" };
        if (sim.queue.some((i) => i.key === key)) return { kind: "waiting" };
        return { kind: "empty" };
      },
      failed(text) {
        const key = sealKey(text);
        return sim.failed.has(key) && numberOf(key) === null;
      },
      fire,
      fireAll,
      progress: (texts) => progressOf(sim, texts),
    };
  }, [seals, sim, fire, fireAll]);

  return <TextSimContext.Provider value={api}>{children}</TextSimContext.Provider>;
}

/** Null outside the provider: the cards then render their gauges disabled. */
export function useTextSim(): TextSimApi | null {
  return useContext(TextSimContext);
}
