/** @vitest-environment happy-dom */

/**
 * TextSimProvider — the thread's one place that runs text simulations (`POST /api/tools/react`,
 * 1 credit each). The provider is real; the network is the only stand-in (a `fetch` stub whose
 * every call waits until the test answers it, so "one at a time" is observable).
 *
 * The harness holds the seal map the way the composer does (`setPersistedSimSeals((m) => ({ ...m,
 * [key]: seal }))`), so a result travels the real loop: provider → onSealed → seals → stateOf.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import type { SimSeal } from "@/lib/threads/sim-seals";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import { TextSimProvider, useTextSim, type TextKind } from "../text-sim";
import { population } from "./fixtures/answers";

// ─── The network stand-in ────────────────────────────────────────────────────

interface Call {
  url: string;
  method: string | undefined;
  body: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
  resolve: (r: Response) => void;
  reject: (e: unknown) => void;
}

let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          calls.push({
            url,
            method: init?.method,
            body: JSON.parse(String(init?.body ?? "null")) as Record<string, unknown>,
            signal: init?.signal,
            resolve,
            reject,
          });
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The `react` route's 200 body (`{ fraction, scrollQuote, personas, population, slice }`). */
const ok = (stopPct: number | null) => ({
  fraction: "7/10 stop",
  scrollQuote: "I would keep watching.",
  personas: [{ archetype: "builder", verdict: "stop", quote: "Tell me more." }],
  population: stopPct === null ? null : population(stopPct),
  slice: null,
});

/** Answer call `i` and let the provider's continuation run. */
async function answer(i: number, res: Response) {
  await act(async () => {
    calls[i]!.resolve(res);
  });
}

// ─── The harness ─────────────────────────────────────────────────────────────

const A = "I spent $40 on meal prep and it tasted like regret.";
const B = "Stop eating sad desk lunch: my 3-step fix for brain fog.";
const C = "I tried the viral 5-hour meal prep challenge so you don’t have to.";

function Rows({ texts, kind = "hook" }: { texts: readonly string[]; kind?: TextKind }) {
  const sim = useTextSim();
  if (!sim) return <p data-testid="no-provider">no provider</p>;
  const q = sim.progress(texts);
  return (
    <div>
      <ul>
        {texts.map((t, i) => {
          const s = sim.stateOf(t);
          return (
            <li key={i} data-testid={`row-${i}`}>
              {s.kind}
              {s.kind === "done" ? `:${s.value}` : ""}
              {sim.failed(t) ? " failed" : ""}
            </li>
          );
        })}
      </ul>
      <p data-testid="progress">{q ? `${q.done}/${q.total}` : "none"}</p>
      <button type="button" onClick={() => sim.fireAll(texts.map((text) => ({ text, kind })))}>
        all
      </button>
      {texts.map((t, i) => (
        <button key={i} type="button" onClick={() => sim.fire(t, kind)}>
          {`fire ${i}`}
        </button>
      ))}
    </div>
  );
}

/** The composer's half: holds the map, merges every sealed result into it. */
function Harness({
  texts,
  initial = {},
  kind,
  onSealed,
  childKey = "live",
}: {
  texts: readonly string[];
  initial?: WireSimSealMap;
  kind?: TextKind;
  onSealed?: (key: string, seal: SimSeal) => void;
  childKey?: string;
}) {
  const [seals, setSeals] = useState<WireSimSealMap>(initial);
  return (
    <TextSimProvider
      seals={seals}
      onSealed={(key, seal) => {
        onSealed?.(key, seal);
        setSeals((m) => ({ ...m, [key]: seal }));
      }}
    >
      <Rows key={childKey} texts={texts} kind={kind} />
    </TextSimProvider>
  );
}

const row = (i: number) => screen.getByTestId(`row-${i}`).textContent;
const progress = () => screen.getByTestId("progress").textContent;
const tap = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

/** Let any stray continuation run, so "no second request" is not a timing accident. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useTextSim outside the provider", () => {
  it("is null (cards then render their gauges disabled)", () => {
    render(<Rows texts={[A]} />);
    expect(screen.getByTestId("no-provider")).toBeInTheDocument();
  });
});

describe("stateOf reads the seal map", () => {
  it("done = Math.round(population.stopPct); never pct; a seal without a population or a sealed wire seal is empty", () => {
    const initial: WireSimSealMap = {
      [A]: { pct: 70, band: "Strong", at: "2026-11-21T00:00:00Z", population: population(30.6) },
      [B]: { pct: 70, band: "Strong", at: "2026-11-21T00:00:00Z" },
      [C]: { sealed: true, at: "2026-11-21T00:00:00Z", video: { analysisId: "an-1", craftScore: null } },
    };
    render(<Harness texts={[A, B, C]} initial={initial} />);
    expect(row(0)).toBe("done:31");
    expect(row(1)).toBe("empty");
    expect(row(2)).toBe("empty");
    expect(progress()).toBe("none");
  });

  it("keys are trimmed: a padded text reads the same seal", () => {
    const initial: WireSimSealMap = {
      [A]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(22) },
    };
    render(<Harness texts={[`  ${A}\n`]} initial={initial} />);
    expect(row(0)).toBe("done:22");
  });
});

describe("the queue: one request at a time, FIFO", () => {
  it("runs A, then B, then C, each only after the previous one answered; progress 0/3 → 1/3 → 2/3 → none", async () => {
    const sealed: string[] = [];
    render(<Harness texts={[A, B, C]} onSealed={(key) => sealed.push(key)} />);
    tap("all");

    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/tools/react");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.body).toEqual({ text: A, pin: true, persist: true, framing: "hook" });
    expect([row(0), row(1), row(2)]).toEqual(["running", "waiting", "waiting"]);
    expect(progress()).toBe("0/3");

    await answer(0, json(200, ok(30.4)));
    await waitFor(() => expect(calls).toHaveLength(2));
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.body.text).toBe(B);
    expect([row(0), row(1), row(2)]).toEqual(["done:30", "running", "waiting"]);
    expect(progress()).toBe("1/3");

    await answer(1, json(200, ok(22)));
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2]!.body.text).toBe(C);
    expect([row(0), row(1), row(2)]).toEqual(["done:30", "done:22", "running"]);
    expect(progress()).toBe("2/3");

    await answer(2, json(200, ok(45)));
    await waitFor(() => expect(row(2)).toBe("done:45"));
    expect(progress()).toBe("none");
    expect(sealed).toEqual([A, B, C]);
    await settle();
    expect(calls).toHaveLength(3);
  });

  it("a single fire while a batch runs waits its turn, and gets its own 0/1 progress", async () => {
    render(<Harness texts={[A, B, C]} />);
    tap("fire 0");
    tap("fire 2");
    await settle();
    expect(calls).toHaveLength(1);
    expect([row(0), row(1), row(2)]).toEqual(["running", "empty", "waiting"]);
    // Two single fires in this pack: each is its own batch of one, and the pack sums them.
    expect(progress()).toBe("0/2");

    await answer(0, json(200, ok(30)));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]!.body.text).toBe(C);
    expect(progress()).toBe("1/2");
  });

  it("one fire on the last empty row shows 0/1 instead of losing the footer", async () => {
    const initial: WireSimSealMap = {
      [A]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(30) },
      [B]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(22) },
    };
    render(<Harness texts={[A, B, C]} initial={initial} />);
    tap("fire 2");
    await settle();
    expect(progress()).toBe("0/1");
    await answer(0, json(200, ok(45)));
    await waitFor(() => expect(row(2)).toBe("done:45"));
    expect(progress()).toBe("none");
  });

  it("fireAll enqueues only the not-done ones, in order (total counts them alone)", async () => {
    const initial: WireSimSealMap = {
      [B]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(22) },
    };
    render(<Harness texts={[A, B, C]} initial={initial} />);
    tap("all");
    await settle();
    expect(calls.map((c) => c.body.text)).toEqual([A]);
    expect(progress()).toBe("0/2");
    await answer(0, json(200, ok(30)));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]!.body.text).toBe(C);
    expect(progress()).toBe("1/2");
  });
});

describe("no second spend", () => {
  it("fire on a done key does nothing", async () => {
    const initial: WireSimSealMap = {
      [A]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(30) },
    };
    render(<Harness texts={[A]} initial={initial} />);
    tap("fire 0");
    tap("all");
    await settle();
    expect(calls).toHaveLength(0);
    expect(row(0)).toBe("done:30");
    expect(progress()).toBe("none");
  });

  it("fire on a running or queued key does nothing", async () => {
    render(<Harness texts={[A, B]} />);
    tap("fire 0");
    tap("fire 1");
    tap("fire 0");
    tap("fire 1");
    tap("all");
    await settle();
    expect(calls).toHaveLength(1);
    await answer(0, json(200, ok(30)));
    await waitFor(() => expect(calls).toHaveLength(2));
    await answer(1, json(200, ok(22)));
    await waitFor(() => expect(row(1)).toBe("done:22"));
    await settle();
    expect(calls.map((c) => c.body.text)).toEqual([A, B]);
  });

  it("duplicate texts share one state and one request", async () => {
    render(<Harness texts={[A, ` ${A} `, B]} />);
    tap("all");
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.text).toBe(A);
    expect([row(0), row(1), row(2)]).toEqual(["running", "running", "waiting"]);
    expect(progress()).toBe("0/2");
    await answer(0, json(200, ok(30)));
    await waitFor(() => expect(row(1)).toBe("done:30"));
    expect(row(0)).toBe("done:30");
  });

  it("an empty text is never sent", async () => {
    render(<Harness texts={["   "]} />);
    tap("fire 0");
    tap("all");
    await settle();
    expect(calls).toHaveLength(0);
    expect(row(0)).toBe("empty");
  });
});

describe("the request body is the legacy one per kind", () => {
  it.each<[TextKind, Record<string, unknown>]>([
    ["hook", { text: A, pin: true, persist: true, framing: "hook" }],
    ["idea", { text: A, pin: true, persist: true, framing: "idea" }],
    ["script", { text: A, pin: true, persist: true }],
    ["remix", { text: A, pin: true, persist: true }],
  ])("%s", async (kind, body) => {
    render(<Harness texts={[A]} kind={kind} />);
    tap("fire 0");
    await settle();
    expect(calls[0]!.body).toEqual(body);
  });
});

describe("the seal handed to the composer", () => {
  it("carries pct from the fraction, band null, an ISO time, and the population, personas and quote", async () => {
    const onSealed = vi.fn();
    render(<Harness texts={[A]} onSealed={onSealed} />);
    tap("fire 0");
    await settle();
    await answer(0, json(200, ok(30.4)));
    await waitFor(() => expect(onSealed).toHaveBeenCalledTimes(1));
    const [key, seal] = onSealed.mock.calls[0] as [string, SimSeal];
    expect(key).toBe(A);
    expect(seal).toEqual({
      pct: 70,
      band: null,
      at: expect.any(String),
      population: population(30.4),
      personas: ok(0).personas,
      scrollQuote: "I would keep watching.",
    });
    expect(new Date(seal.at).toISOString()).toBe(seal.at);
  });
});

describe("failures", () => {
  it("a 200 without a population is failed (billed, no number), seals nothing, and stops the queue without the wall", async () => {
    // The route answers `population: null` for every run on an audience with no population
    // signature, and bills each one: going on would pay for N rows that all say "Couldn't simulate".
    const onSealed = vi.fn();
    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);
    try {
      render(<Harness texts={[A, B, C]} onSealed={onSealed} />);
      tap("all");
      await settle();
      expect(progress()).toBe("0/3");
      await answer(0, json(200, ok(null)));
      await waitFor(() => expect(row(0)).toBe("empty failed"));
      await settle();
      expect(calls).toHaveLength(1);
      expect([row(1), row(2)]).toEqual(["empty", "empty"]);
      expect(progress()).toBe("none");
      expect(onSealed).not.toHaveBeenCalled();
      expect(walls).toEqual([]);
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });

  it("another status or a network error is failed, and the queue goes on", async () => {
    render(<Harness texts={[A, B, C]} />);
    tap("all");
    await settle();
    await answer(0, json(502, { error: "reaction_failed" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(row(0)).toBe("empty failed");
    await act(async () => {
      calls[1]!.reject(new TypeError("Failed to fetch"));
    });
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(row(1)).toBe("empty failed");
    await answer(2, json(200, ok(45)));
    await waitFor(() => expect(row(2)).toBe("done:45"));
    expect(progress()).toBe("none");
  });

  it("a 402 raises the credit wall, marks that text failed and drops the rest of the queue", async () => {
    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);
    try {
      render(<Harness texts={[A, B, C]} />);
      tap("all");
      await settle();
      const quota = {
        error: "credit_quota_exceeded",
        message: "Your 50 trial credits are spent.",
        tier: "creator",
        used: 50,
        limit: 50,
        inTrial: true,
        reason: "allowance",
        cost: 1,
      };
      await answer(0, json(402, quota));
      await waitFor(() => expect(row(0)).toBe("empty failed"));
      expect(walls).toEqual([quota]);
      expect([row(1), row(2)]).toEqual(["empty", "empty"]);
      expect(progress()).toBe("none");
      await settle();
      expect(calls).toHaveLength(1);
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });

  it("firing a failed text again clears the mark", async () => {
    render(<Harness texts={[A]} />);
    tap("fire 0");
    await settle();
    await answer(0, json(500, {}));
    await waitFor(() => expect(row(0)).toBe("empty failed"));
    tap("fire 0");
    await settle();
    expect(calls).toHaveLength(2);
    expect(row(0)).toBe("running");
    await answer(1, json(200, ok(30)));
    await waitFor(() => expect(row(0)).toBe("done:30"));
  });
});

describe("the state lives in the provider", () => {
  it("survives the turn's remount (live → persisted swap): the run in flight lands on the new turn", async () => {
    const { rerender } = render(<Harness texts={[A, B]} childKey="live" />);
    tap("all");
    await settle();
    expect(row(0)).toBe("running");
    rerender(<Harness texts={[A, B]} childKey="persisted" />);
    expect([row(0), row(1)]).toEqual(["running", "waiting"]);
    expect(progress()).toBe("0/2");
    await answer(0, json(200, ok(30)));
    await waitFor(() => expect(row(0)).toBe("done:30"));
    expect(row(1)).toBe("running");
  });

  it("unmounting the provider aborts the request in flight and sends nothing more", async () => {
    const onSealed = vi.fn();
    const { unmount } = render(<Harness texts={[A, B]} onSealed={onSealed} />);
    tap("all");
    await settle();
    expect(calls[0]!.signal?.aborted).toBe(false);
    unmount();
    expect(calls[0]!.signal?.aborted).toBe(true);
    calls[0]!.resolve(json(200, ok(30)));
    await settle();
    expect(calls).toHaveLength(1);
    expect(onSealed).not.toHaveBeenCalled();
  });
});
