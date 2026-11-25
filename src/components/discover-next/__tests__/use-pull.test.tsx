/** @vitest-environment happy-dom */

/**
 * usePull: the one request of the new Discover that spends credits (`POST /api/discover`, 5 credits
 * on a fresh read). The real hook over the app's real walls; the stand-in is `fetch` only. Every
 * handle and id is made up.
 *
 * A pull is held by its input for the session (its answer for 30 minutes): a page that leaves while it
 * runs and comes back shows it running, or its cards, and never pays for it twice.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import type { PullSubject } from "@/lib/discover-next/pull";

import { HELD_PULL_MS, forgetPulls, usePull } from "../use-pull";

const JAY: PullSubject = { kind: "handle", input: "@jay.makes", handle: "jay.makes", shown: "@jay.makes" };
const MEAL: PullSubject = { kind: "words", input: "meal prep", handle: null, shown: "meal prep" };

const TILE = {
  platformVideoId: "7300000000000000001",
  videoUrl: "https://www.tiktok.com/@jay.makes/video/7300000000000000001",
  caption: "I tried to build a desk with no tools #diy",
  views: 18_400_000,
  likes: 1_200_000,
  comments: 3_400,
  shares: 10,
  saves: 20,
  durationSeconds: 31,
  postedAt: "2026-07-30T10:00:00.000Z",
  multiplier: 16,
  baselineLabel: "vs their usual views",
  mode: "profile",
  source: "profile:jay.makes",
  author: { handle: "jay.makes", fans: 1000, heart: 2000, videoCount: 30 },
};

/** The exact body the credit gate writes for a 402. */
const QUOTA_402 = {
  error: "credit_quota_exceeded",
  message: "$1 unlocks the whole platform for 3 days — every skill, 50 credits.",
  tier: "free",
  used: 0,
  limit: 10,
  inTrial: false,
  reason: "trial_required",
  cost: 5,
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let answer: () => Promise<Response>;
const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => answer());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Listens for an app-wide event for the length of the test. */
function listen(name: string) {
  const heard = vi.fn();
  window.addEventListener(name, heard);
  onTestFinished(() => window.removeEventListener(name, heard));
  return heard;
}

beforeEach(() => {
  forgetPulls();
  answer = async () => json(200, { mode: "profile", input: "jay.makes", cached: false, tiles: [TILE] });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  forgetPulls();
});

async function pulled(subject: PullSubject = JAY) {
  // Each pull here starts afresh: what an earlier one held is not the subject of these cases.
  forgetPulls();
  const hook = renderHook(() => usePull(subject));
  expect(hook.result.current.state).toEqual({ kind: "idle" });
  act(() => hook.result.current.start());
  await waitFor(() => expect(hook.result.current.state.kind).not.toBe("running"));
  return hook;
}

describe("usePull — the request", () => {
  it("sends nothing until started", () => {
    renderHook(() => usePull(JAY));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the subject's input as JSON to /api/discover, once", async () => {
    await pulled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe("/api/discover");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ input: "@jay.makes" });
  });

  it("sends words as they are", async () => {
    await pulled(MEAL);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ input: "meal prep" });
  });

  it("is running while the answer is out, and a second start then sends nothing", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const hook = renderHook(() => usePull(JAY));
    act(() => {
      hook.result.current.start();
      hook.result.current.start();
    });
    expect(hook.result.current.state).toEqual({ kind: "running" });
    act(() => hook.result.current.start());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => out.resolve(json(200, { tiles: [TILE] })));
    await waitFor(() => expect(hook.result.current.state.kind).toBe("done"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("usePull — the answers", () => {
  it("200, read fresh: done, the videos as cards in the server's order", async () => {
    answer = async () => json(200, { cached: false, tiles: [TILE, { ...TILE, platformVideoId: "7300000000000000002" }] });
    const hook = await pulled();
    const state = hook.result.current.state;
    expect(state.kind).toBe("done");
    if (state.kind !== "done") return;
    expect(state.videos.map((v) => v.id)).toEqual(["7300000000000000001", "7300000000000000002"]);
    expect(state.videos[0]).toMatchObject({ handle: "jay.makes", spokenHook: "I tried to build a desk with no tools", proven: true, likes: 1_200_000 });
  });

  it("200, served again from the cache: the same", async () => {
    answer = async () => json(200, { cached: true, tiles: [TILE] });
    const hook = await pulled();
    expect(hook.result.current.state).toMatchObject({ kind: "done", videos: [{ id: "7300000000000000001" }] });
  });

  it("200 with no videos: done, empty", async () => {
    answer = async () => json(200, { cached: false, tiles: [] });
    const hook = await pulled();
    expect(hook.result.current.state).toEqual({ kind: "done", videos: [] });
  });

  it("200 whose body cannot be read, or holds no list: Couldn't read", async () => {
    answer = async () => new Response("<html>", { status: 200 });
    let hook = await pulled();
    expect(hook.result.current.state).toEqual({ kind: "failed", failure: { kind: "read", sentence: "Couldn't read @jay.makes." } });
    answer = async () => json(200, { cached: false });
    hook = await pulled();
    expect(hook.result.current.state).toEqual({ kind: "failed", failure: { kind: "read", sentence: "Couldn't read @jay.makes." } });
  });

  it("402, no credits: the app's wall, and back to the offer (no failure under it)", async () => {
    const wall = listen(CREDIT_WALL_EVENT);
    answer = async () => json(402, QUOTA_402);
    const hook = await pulled();
    expect(wall).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state).toEqual({ kind: "idle" });
  });

  it("402 that is not the credit wall's: Couldn't read", async () => {
    const wall = listen(CREDIT_WALL_EVENT);
    answer = async () => json(402, { error: "something_else" });
    const hook = await pulled();
    expect(wall).not.toHaveBeenCalled();
    expect(hook.result.current.state).toMatchObject({ kind: "failed", failure: { kind: "read" } });
  });

  it("401, a lapsed session: the app's session dialog, and back to the offer", async () => {
    const session = listen(SESSION_EXPIRED_EVENT);
    answer = async () => json(401, { error: "Unauthorized" });
    const hook = await pulled();
    expect(session).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state).toEqual({ kind: "idle" });
  });

  it("429, the daily limit: its sentence with the answer's number", async () => {
    answer = async () => json(429, { error: "daily_cap_reached", message: "server words", used: 12, limit: 12 });
    const hook = await pulled();
    expect(hook.result.current.state).toEqual({
      kind: "failed",
      failure: { kind: "limit", sentence: "You've pulled 12 times today. Try again tomorrow." },
    });
  });

  it("400 unsupported input: Only TikTok", async () => {
    answer = async () => json(400, { error: "unsupported_input", message: "server words" });
    const hook = await pulled(MEAL);
    expect(hook.result.current.state).toEqual({ kind: "failed", failure: { kind: "not-tiktok", sentence: "Only TikTok can be read right now." } });
  });

  it("502, the read failed: Couldn't read, for a creator or for words", async () => {
    answer = async () => json(502, { error: "scrape_failed", message: "server words" });
    expect((await pulled()).result.current.state).toEqual({ kind: "failed", failure: { kind: "read", sentence: "Couldn't read @jay.makes." } });
    expect((await pulled(MEAL)).result.current.state).toEqual({
      kind: "failed",
      failure: { kind: "read", sentence: "Couldn't read videos about “meal prep”." },
    });
  });

  it("an error body that is not JSON: still its status's sentence", async () => {
    answer = async () => new Response("Bad gateway", { status: 502 });
    expect((await pulled()).result.current.state).toMatchObject({ kind: "failed", failure: { kind: "read" } });
  });

  it("a request that throws (offline): Couldn't read", async () => {
    answer = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect((await pulled()).result.current.state).toEqual({ kind: "failed", failure: { kind: "read", sentence: "Couldn't read @jay.makes." } });
  });

  it("after a failure a new start sends again (Try again)", async () => {
    answer = async () => json(502, {});
    const hook = await pulled();
    answer = async () => json(200, { tiles: [TILE] });
    act(() => hook.result.current.start());
    await waitFor(() => expect(hook.result.current.state.kind).toBe("done"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("usePull — held by its input", () => {
  it("two pages for one input at once send ONE request, and both show it", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const a = renderHook(() => usePull(JAY));
    const b = renderHook(() => usePull(JAY));
    act(() => a.result.current.start());
    expect(b.result.current.state).toEqual({ kind: "running" });
    act(() => b.result.current.start());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => out.resolve(json(200, { tiles: [TILE] })));
    await waitFor(() => expect(b.result.current.state.kind).toBe("done"));
    expect(a.result.current.state.kind).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("left while it runs and come back: still running, one request; then the cards", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    first.unmount();

    const again = renderHook(() => usePull(JAY));
    expect(again.result.current.state).toEqual({ kind: "running" });
    act(() => again.result.current.start());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => out.resolve(json(200, { tiles: [TILE] })));
    await waitFor(() => expect(again.result.current.state).toMatchObject({ kind: "done", videos: [{ id: "7300000000000000001" }] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("the answer landed while away: come back to the cards, and nothing is sent", async () => {
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    await waitFor(() => expect(first.result.current.state.kind).toBe("done"));
    first.unmount();

    const again = renderHook(() => usePull(JAY));
    expect(again.result.current.state).toMatchObject({ kind: "done", videos: [{ id: "7300000000000000001" }] });
    act(() => again.result.current.start());
    expect(again.result.current.state.kind).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("the answer landed with nobody on the page: held all the same", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    first.unmount();
    await act(async () => out.resolve(json(200, { tiles: [TILE] })));

    const again = renderHook(() => usePull(JAY));
    expect(again.result.current.state.kind).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a failure is not held: the page shows it, a later one shows the offer, and a press sends again", async () => {
    answer = async () => json(502, {});
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    await waitFor(() => expect(first.result.current.state.kind).toBe("failed"));
    first.unmount();

    answer = async () => json(200, { tiles: [TILE] });
    const again = renderHook(() => usePull(JAY));
    expect(again.result.current.state).toEqual({ kind: "idle" });
    act(() => again.result.current.start());
    await waitFor(() => expect(again.result.current.state.kind).toBe("done"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a page that came back while it ran hears its failure too", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    first.unmount();
    const again = renderHook(() => usePull(JAY));
    await act(async () => out.resolve(json(502, {})));
    await waitFor(() => expect(again.result.current.state).toEqual({ kind: "failed", failure: { kind: "read", sentence: "Couldn't read @jay.makes." } }));
  });

  it("a wall is not held: back to the offer for everyone", async () => {
    listen(SESSION_EXPIRED_EVENT);
    const out = deferred<Response>();
    answer = () => out.promise;
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    const again = renderHook(() => usePull(JAY));
    await act(async () => out.resolve(json(401, {})));
    await waitFor(() => expect(again.result.current.state).toEqual({ kind: "idle" }));
    expect(first.result.current.state).toEqual({ kind: "idle" });
  });

  it("the cards are held for 30 minutes, then the offer again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = renderHook(() => usePull(JAY));
    act(() => first.result.current.start());
    await waitFor(() => expect(first.result.current.state.kind).toBe("done"));
    first.unmount();

    expect(HELD_PULL_MS).toBe(30 * 60_000);
    vi.setSystemTime(Date.now() + HELD_PULL_MS - 1000);
    const soon = renderHook(() => usePull(JAY));
    expect(soon.result.current.state.kind).toBe("done");
    soon.unmount();

    vi.setSystemTime(Date.now() + 2000);
    const later = renderHook(() => usePull(JAY));
    expect(later.result.current.state).toEqual({ kind: "idle" });
  });

  it("another input is held apart", async () => {
    const out = deferred<Response>();
    answer = () => out.promise;
    const jay = renderHook(() => usePull(JAY));
    act(() => jay.result.current.start());
    const meal = renderHook(() => usePull(MEAL));
    expect(meal.result.current.state).toEqual({ kind: "idle" });
  });

  it("no subject (a link that cannot be read): idle, and start sends nothing", () => {
    const hook = renderHook(() => usePull(null));
    act(() => hook.result.current.start());
    expect(hook.result.current.state).toEqual({ kind: "idle" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
