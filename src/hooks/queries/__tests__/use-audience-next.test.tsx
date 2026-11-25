/** @vitest-environment happy-dom */
/**
 * use-audience-next — Audience's requests (spec 2026-11-25-audience): the audience new chats use,
 * a rename, and a remove (the audience, then the account behind it). The hooks run for real through a
 * real QueryClient; the one stand-in is `fetch`, the I/O boundary. The session dialog is observed as the
 * app hears it: the window event `reportSession401` raises.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { SESSION_EXPIRED_EVENT, isSessionExpiredRefusal } from "@/lib/auth/session-expired";

import { useRemoveAudience, useRenameAudience, useSetDefaultAudience } from "../use-audience-next";
import { announceAudienceChanged, readOnItsWay, useAudienceBuild, useAudienceChangedElsewhere, type BuildTimers } from "../use-audience-next";
import { SETTLE_MAX_MS, SLOW_AFTER_MS } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS as S } from "@/lib/audience-next/audience-words";
import { buildRequestOf, type BuildRequest } from "@/lib/audience-next/build-request";

interface Call {
  method: string;
  url: string;
  contentType: string | null;
  body: unknown;
}

let calls: Call[];
/** The answer for each request, by "METHOD url"; anything not named is a 204. */
let answers: Map<string, number>;
let raised: number;
const count = () => {
  raised += 1;
};

const AUDIENCE = "00000000-0000-4000-8000-000000000001";
const ACCOUNT = "00000000-0000-4000-8000-000000000100";

beforeEach(() => {
  calls = [];
  answers = new Map();
  raised = 0;
  window.addEventListener(SESSION_EXPIRED_EVENT, count);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({
        method,
        url,
        contentType: headers.get("Content-Type"),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body ?? null),
      });
      const status = answers.get(`${method} ${url}`) ?? 204;
      if (status === 204) return new Response(null, { status });
      return new Response(JSON.stringify(status < 300 ? { success: true } : { error: "refused" }), { status });
    }),
  );
});

afterEach(() => {
  window.removeEventListener(SESSION_EXPIRED_EVENT, count);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

/** The promise's outcome: undefined when it resolved, else what it threw. */
async function outcome(run: () => Promise<unknown>): Promise<unknown> {
  let thrown: unknown;
  await act(async () => {
    await run().catch((error: unknown) => {
      thrown = error;
    });
  });
  return thrown;
}

describe("useSetDefaultAudience", () => {
  it("PUTs the audience to /api/settings/last-audience as JSON", async () => {
    // The route answers 200 `{ success: true }`.
    answers.set("PUT /api/settings/last-audience", 200);
    const { result } = renderHook(() => useSetDefaultAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync(AUDIENCE))).toBeUndefined();
    expect(calls).toEqual([{ method: "PUT", url: "/api/settings/last-audience", contentType: "application/json", body: { audienceId: AUDIENCE } }]);
  });

  it("a refusal throws", async () => {
    answers.set("PUT /api/settings/last-audience", 500);
    const { result } = renderHook(() => useSetDefaultAudience(), { wrapper });
    const thrown = await outcome(() => result.current.mutateAsync(AUDIENCE));
    expect(thrown).toBeInstanceOf(Error);
    expect(isSessionExpiredRefusal(thrown)).toBe(false);
    expect(raised).toBe(0);
  });

  it("a 401 raises the session dialog, then throws the session's refusal", async () => {
    answers.set("PUT /api/settings/last-audience", 401);
    const { result } = renderHook(() => useSetDefaultAudience(), { wrapper });
    const thrown = await outcome(() => result.current.mutateAsync(AUDIENCE));
    expect(raised).toBe(1);
    expect(isSessionExpiredRefusal(thrown)).toBe(true);
  });
});

describe("useRenameAudience", () => {
  it("PATCHes /api/audiences/:id with the name as JSON", async () => {
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name: "Night owls" }))).toBeUndefined();
    expect(calls).toEqual([{ method: "PATCH", url: `/api/audiences/${AUDIENCE}`, contentType: "application/json", body: { name: "Night owls" } }]);
  });

  it("sends the name trimmed", async () => {
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name: "  Night owls " }));
    expect(calls[0]!.body).toEqual({ name: "Night owls" });
  });

  it.each([
    ["empty", "   "],
    ["over 80 characters", "a".repeat(81)],
  ])("a name %s is refused without a request (the route takes 1 to 80)", async (_what, name) => {
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name }))).toBeInstanceOf(Error);
    expect(calls).toEqual([]);
  });

  it("80 characters is sent", async () => {
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name: "a".repeat(80) }))).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("a refusal throws", async () => {
    answers.set(`PATCH /api/audiences/${AUDIENCE}`, 400);
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name: "Night owls" }))).toBeInstanceOf(Error);
    expect(raised).toBe(0);
  });

  it("a 401 raises the session dialog, then throws", async () => {
    answers.set(`PATCH /api/audiences/${AUDIENCE}`, 401);
    const { result } = renderHook(() => useRenameAudience(), { wrapper });
    const thrown = await outcome(() => result.current.mutateAsync({ id: AUDIENCE, name: "Night owls" }));
    expect(raised).toBe(1);
    expect(isSessionExpiredRefusal(thrown)).toBe(true);
  });
});

describe("useRemoveAudience", () => {
  it("without an account: DELETE /api/audiences/:id, nothing more", async () => {
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: null }))).toBeUndefined();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${AUDIENCE}`]);
    expect(calls[0]!.body).toBeNull();
  });

  it("with an account: the audience first, then the account, one after the other", async () => {
    let audienceAnswered = false;
    let accountAskedEarly = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ method: init?.method ?? "GET", url, contentType: null, body: null });
      if (url.startsWith("/api/audiences/")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        audienceAnswered = true;
      } else if (!audienceAnswered) {
        accountAskedEarly = true;
      }
      return new Response(null, { status: 204 });
    });
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: ACCOUNT }))).toBeUndefined();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${AUDIENCE}`, `DELETE /api/connected-accounts/${ACCOUNT}`]);
    expect(accountAskedEarly).toBe(false);
  });

  it("a refused audience delete throws and leaves the account alone", async () => {
    answers.set(`DELETE /api/audiences/${AUDIENCE}`, 500);
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: ACCOUNT }))).toBeInstanceOf(Error);
    expect(calls.map((c) => c.url)).toEqual([`/api/audiences/${AUDIENCE}`]);
  });

  it("a refused account delete throws (the audience is already gone)", async () => {
    answers.set(`DELETE /api/connected-accounts/${ACCOUNT}`, 404);
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    expect(await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: ACCOUNT }))).toBeInstanceOf(Error);
    expect(calls).toHaveLength(2);
  });

  it("a 401 on the audience raises the session dialog, throws, and leaves the account alone", async () => {
    answers.set(`DELETE /api/audiences/${AUDIENCE}`, 401);
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    const thrown = await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: ACCOUNT }));
    expect(raised).toBe(1);
    expect(isSessionExpiredRefusal(thrown)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("a 401 on the account raises the session dialog and throws", async () => {
    answers.set(`DELETE /api/connected-accounts/${ACCOUNT}`, 401);
    const { result } = renderHook(() => useRemoveAudience(), { wrapper });
    const thrown = await outcome(() => result.current.mutateAsync({ id: AUDIENCE, accountId: ACCOUNT }));
    expect(raised).toBe(1);
    expect(isSessionExpiredRefusal(thrown)).toBe(true);
  });
});

// ─── useAudienceBuild: a read, on a made-up stream ───────────────────────────
//
// The stream is made up and fed by the test (frames as the route writes them); the clock is a stand-in
// handed to the hook (`timers`), moved by hand. Everything between (the reader, the reducer, the hook) is
// the real code.

const enc = new TextEncoder();
const NIA = buildRequestOf("own", "nia.tests")!;
const MADE = "00000000-0000-4000-8000-0000000000aa";
const SYNTHESIS = "We read @nia.tests fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";

/** A stream the test writes to, as the route would. */
function madeUpStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    body,
    send: (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => controller.close(),
    fail: () => controller.error(new Error("the connection dropped")),
    get cancelled() {
      return cancelled;
    },
  };
}

/** A clock moved by hand. */
function handClock(): BuildTimers & { advance(ms: number): void; waiting(): number } {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout: (run, ms) => {
      next += 1;
      timers.set(next, { at: now + ms, run });
      return next;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at > now) continue;
        timers.delete(id);
        t.run();
      }
    },
    waiting: () => timers.size,
  };
}

/** Lets the reads already given resolve, inside act. */
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const READ = "Reading your followers";
const WATCH = "Watching your videos";
const BUILD = "Building your audience profile";

describe("useAudienceBuild", () => {
  let stream: ReturnType<typeof madeUpStream>;
  let answer: () => Response | Promise<Response>;
  let sent: Array<{ url: string; method: string; contentType: string | null; body: unknown; signal: unknown }>;

  beforeEach(() => {
    stream = madeUpStream();
    answer = () => ({ ok: true, status: 200, body: stream.body }) as unknown as Response;
    sent = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        sent.push({
          url: String(input),
          method: init?.method ?? "GET",
          contentType: new Headers(init?.headers).get("Content-Type"),
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
          signal: init?.signal,
        });
        return answer();
      }),
    );
  });

  // A read left open would stay on its way for the next test (the record outlives a page): end it.
  afterEach(async () => {
    try {
      stream.close();
    } catch {
      // Already ended.
    }
    await settle();
  });

  function begin(request: BuildRequest = NIA) {
    const clock = handClock();
    const view = renderHook(() => useAudienceBuild(clock));
    act(() => view.result.current.start(request));
    return { ...view, clock };
  }

  it("is idle before a start: no state, not slow, nothing sent", () => {
    const { result } = renderHook(() => useAudienceBuild(handClock()));
    expect(result.current.state).toBeNull();
    expect(result.current.slow).toBe(false);
    expect(sent).toEqual([]);
  });

  it("POSTs the request as JSON to /api/audiences/calibrate and runs, with the server's three steps", async () => {
    const { result } = begin();
    await settle();
    expect(sent).toEqual([{ url: "/api/audiences/calibrate", method: "POST", contentType: "application/json", body: NIA, signal: undefined }]);
    expect(result.current.state?.phase).toBe("running");
    expect(result.current.state?.plan).toEqual([READ, WATCH, BUILD]);
  });

  it("each event moves the state; done settles, and the stream's close makes it done", async () => {
    const { result } = begin();
    await settle();
    stream.send("status", { message: "Reading your followers…" });
    stream.send("stage", { name: READ, status: "active" });
    stream.send("evidence", { handle: "nia.tests", avatarUrl: "https://cdn.example.test/nia.jpg", videos: [{ coverUrl: "https://cdn.example.test/1.jpg", views: 1 }] });
    await settle();
    expect(result.current.state?.steps[READ]).toBe("active");
    expect(result.current.state?.evidence).toEqual({ picture: "https://cdn.example.test/nia.jpg", covers: ["https://cdn.example.test/1.jpg"], count: 1 });
    stream.send("stage", { name: READ, status: "done" });
    stream.send("stage", { name: WATCH, status: "active" });
    await settle();
    expect(result.current.state?.steps).toEqual({ [READ]: "done", [WATCH]: "active", [BUILD]: "pending" });
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(result.current.state?.phase).toBe("settling");
    expect(result.current.state?.audienceId).toBe(MADE);
    stream.close();
    await settle();
    expect(result.current.state?.phase).toBe("done");
    expect(result.current.state?.audienceId).toBe(MADE);
  });

  it("after done it waits for the stream's close at most 30 s, then is done", async () => {
    const { result, clock } = begin();
    await settle();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(result.current.state?.phase).toBe("settling");
    act(() => clock.advance(SETTLE_MAX_MS - 1));
    await settle();
    expect(result.current.state?.phase).toBe("settling");
    act(() => clock.advance(1));
    await settle();
    expect(result.current.state?.phase).toBe("done");
    expect(result.current.state?.audienceId).toBe(MADE);
    // The stream is left to the server to close: it is not cancelled.
    expect(stream.cancelled).toBe(false);
  });

  it("too little to read: thin, with the sentence about the handle; later frames change nothing", async () => {
    const { result } = begin();
    await settle();
    stream.send("fallback", { reason: "thin", message: "We couldn't read enough from @nia.tests to calibrate …" });
    await settle();
    expect(result.current.state?.phase).toBe("thin");
    expect(result.current.state?.sentence).toBe("@nia.tests doesn't have enough public videos to read yet.");
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(result.current.state?.phase).toBe("thin");
  });

  it("an error with the synthesis sentence: failed, with that sentence", async () => {
    const { result } = begin();
    await settle();
    stream.send("error", { message: SYNTHESIS, retry: true });
    await settle();
    expect(result.current.state?.phase).toBe("failed");
    expect(result.current.state?.sentence).toBe(SYNTHESIS);
  });

  it("an error with the route's old wording: failed, with the local sentence", async () => {
    const { result } = begin();
    await settle();
    stream.send("error", { message: "Calibration failed. Check the handle and try again.", retry: true });
    await settle();
    expect(result.current.state?.sentence).toBe(S.accountNotFound);
  });

  it("the stream ends with no outcome: failed, with the local sentence", async () => {
    const { result } = begin(buildRequestOf("describe", "Busy parents who meal-prep")!);
    await settle();
    stream.send("stage", { name: "Finding videos in that niche", status: "active" });
    stream.close();
    await settle();
    expect(result.current.state?.phase).toBe("failed");
    expect(result.current.state?.sentence).toBe(S.describeFailed);
  });

  it("a refused request: failed with the local sentence; no session dialog for a 500", async () => {
    answer = () => ({ ok: false, status: 500, body: null }) as unknown as Response;
    const { result } = begin();
    await settle();
    expect(result.current.state?.phase).toBe("failed");
    expect(result.current.state?.sentence).toBe(S.accountNotFound);
    expect(raised).toBe(0);
  });

  it("a 401: the session dialog is the whole answer; the read goes back to idle, with no sentence that blames the account", async () => {
    answer = () => ({ ok: false, status: 401, body: null }) as unknown as Response;
    const { result } = begin();
    await settle();
    expect(raised).toBe(1);
    expect(result.current.state).toBeNull();
    expect(result.current.slow).toBe(false);
    expect(readOnItsWay(NIA)).toBe(false);
  });

  it("an answer with no body fails", async () => {
    answer = () => ({ ok: true, status: 200, body: null }) as unknown as Response;
    const { result } = begin();
    await settle();
    expect(result.current.state?.phase).toBe("failed");
  });

  it("a request that throws fails, with the local sentence", async () => {
    answer = () => Promise.reject(new TypeError("Failed to fetch"));
    const { result } = begin();
    await settle();
    expect(result.current.state?.phase).toBe("failed");
    expect(result.current.state?.sentence).toBe(S.accountNotFound);
  });

  it("a throw while reading: failed, with the local sentence", async () => {
    const { result } = begin();
    await settle();
    stream.send("stage", { name: READ, status: "active" });
    await settle();
    stream.fail();
    await settle();
    expect(result.current.state?.phase).toBe("failed");
    expect(result.current.state?.sentence).toBe(S.accountNotFound);
  });

  it("a throw once the audience is made: done (the audience is stored; only the wait ended)", async () => {
    const { result } = begin();
    await settle();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    stream.fail();
    await settle();
    expect(result.current.state?.phase).toBe("done");
    expect(result.current.state?.audienceId).toBe(MADE);
  });

  it("slow turns true at 3:00 while running, not at 2:59", async () => {
    const { result, clock } = begin();
    await settle();
    act(() => clock.advance(SLOW_AFTER_MS - 1_000));
    expect(result.current.slow).toBe(false);
    act(() => clock.advance(1_000));
    expect(result.current.slow).toBe(true);
    expect(result.current.state?.phase).toBe("running");
  });

  it("slow does not turn true once the read has ended, and the clock is left with nothing", async () => {
    const { result, clock } = begin();
    await settle();
    stream.send("fallback", { reason: "thin" });
    await settle();
    act(() => clock.advance(SLOW_AFTER_MS));
    expect(result.current.slow).toBe(false);
    expect(clock.waiting()).toBe(0);
  });

  it("slow ends with the read, and a new start begins not slow", async () => {
    const { result, clock } = begin();
    await settle();
    act(() => clock.advance(SLOW_AFTER_MS));
    expect(result.current.slow).toBe(true);
    stream.send("error", { message: null });
    await settle();
    expect(result.current.slow).toBe(false);
    stream = madeUpStream();
    act(() => result.current.start(NIA));
    await settle();
    expect(result.current.slow).toBe(false);
    expect(result.current.state?.phase).toBe("running");
  });

  it("a second start while running sends nothing, also two in one go", async () => {
    const clock = handClock();
    const { result } = renderHook(() => useAudienceBuild(clock));
    act(() => {
      result.current.start(NIA);
      result.current.start(NIA);
    });
    await settle();
    act(() => result.current.start(buildRequestOf("other", "leo.makes")!));
    await settle();
    expect(sent).toHaveLength(1);
    expect(result.current.state?.request).toEqual(NIA);
  });

  it("a start while settling sends nothing", async () => {
    const { result } = begin();
    await settle();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    act(() => result.current.start(NIA));
    await settle();
    expect(sent).toHaveLength(1);
  });

  it("after a failure the same request can be sent again", async () => {
    const { result } = begin();
    await settle();
    stream.send("error", { message: null });
    await settle();
    stream = madeUpStream();
    act(() => result.current.start(result.current.state!.request));
    await settle();
    expect(sent).toHaveLength(2);
    expect(sent[1]!.body).toEqual(NIA);
    expect(result.current.state?.phase).toBe("running");
  });

  it("reset: back to idle, not slow", async () => {
    const { result } = begin();
    await settle();
    stream.send("fallback", { reason: "thin" });
    await settle();
    act(() => result.current.reset());
    expect(result.current.state).toBeNull();
    expect(result.current.slow).toBe(false);
  });

  it("reset while a read runs leaves that read's frames unheard", async () => {
    const { result } = begin();
    await settle();
    act(() => result.current.reset());
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(result.current.state).toBeNull();
  });

  it("no abort on leaving the page: the request has no signal and the stream is not cancelled", async () => {
    const { unmount } = begin();
    await settle();
    unmount();
    stream.send("stage", { name: READ, status: "active" });
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(sent[0]!.signal).toBeUndefined();
    expect(stream.cancelled).toBe(false);
  });

  describe("onMade: the audience made, told by the read itself", () => {
    function beginTold(onMade?: (id: string, request: BuildRequest) => void, request: BuildRequest = NIA) {
      const clock = handClock();
      const view = renderHook(() => useAudienceBuild(clock, onMade));
      act(() => view.result.current.start(request));
      return view;
    }

    it("is told the new audience's id and the request the moment the done frame is read, before the close; once", async () => {
      const onMade = vi.fn();
      const { result } = beginTold(onMade);
      await settle();
      stream.send("stage", { name: READ, status: "done" });
      await settle();
      expect(onMade).not.toHaveBeenCalled();
      stream.send("done", { audience: { id: MADE } });
      await settle();
      expect(result.current.state?.phase).toBe("settling");
      expect(onMade).toHaveBeenCalledTimes(1);
      expect(onMade).toHaveBeenCalledWith(MADE, NIA);
      stream.send("done", { audience: { id: "another" } });
      stream.close();
      await settle();
      expect(result.current.state?.phase).toBe("done");
      expect(onMade).toHaveBeenCalledTimes(1);
    });

    it("is told when the page has gone: start, unmount, then the done frame; the PUT it makes is sent", async () => {
      const onMade = vi.fn((id: string) => {
        void fetch("/api/settings/last-audience", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audienceId: id }) });
      });
      const { unmount } = beginTold(onMade);
      await settle();
      unmount();
      stream.send("done", { audience: { id: MADE } });
      await settle();
      expect(onMade).toHaveBeenCalledWith(MADE, NIA);
      expect(sent.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/audiences/calibrate", "PUT /api/settings/last-audience"]);
      expect(sent[1]!.body).toEqual({ audienceId: MADE });
    });

    it.each([
      ["too little to read", (s: ReturnType<typeof madeUpStream>) => s.send("fallback", { reason: "thin" })],
      ["a failure", (s: ReturnType<typeof madeUpStream>) => s.send("error", { message: null })],
      ["a stream that ends with no outcome", (s: ReturnType<typeof madeUpStream>) => s.close()],
    ])("is not told after %s", async (_name, end) => {
      const onMade = vi.fn();
      beginTold(onMade);
      await settle();
      end(stream);
      await settle();
      expect(onMade).not.toHaveBeenCalled();
    });

    it("without it (a read again) nothing but the read is sent, and the read is done all the same", async () => {
      const again: BuildRequest = { handle: "nia.tests", type: "personal", platform: "tiktok", goalIntent: "grow", name: "@nia.tests", audienceId: MADE };
      const { result } = beginTold(undefined, again);
      await settle();
      stream.send("done", { audience: { id: MADE } });
      stream.close();
      await settle();
      expect(result.current.state?.phase).toBe("done");
      expect(sent.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/audiences/calibrate"]);
    });

    it("the latest one given is the one told", async () => {
      const first = vi.fn();
      const second = vi.fn();
      const clock = handClock();
      const view = renderHook(({ onMade }) => useAudienceBuild(clock, onMade), { initialProps: { onMade: first } });
      act(() => view.result.current.start(NIA));
      await settle();
      view.rerender({ onMade: second });
      stream.send("done", { audience: { id: MADE } });
      await settle();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith(MADE, NIA);
    });
  });

  describe("a read on its way, remembered across pages", () => {
    const AGAIN: BuildRequest = { handle: "nia.tests", type: "personal", platform: "tiktok", goalIntent: "grow", name: "@nia.tests", audienceId: MADE };
    /** Starts a read in a page of its own; what `start` answered. */
    function pageStarts(request: BuildRequest) {
      const view = renderHook(() => useAudienceBuild(handClock()));
      let answered: boolean | undefined;
      act(() => {
        answered = view.result.current.start(request);
      });
      return { ...view, answered };
    }
    /** A beforeunload as the browser fires it: true when the page asked to stay. */
    function leaving(): boolean {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }

    it("start, leave the page, start the same read from a new page: one POST; the new page is told no and shows nothing", async () => {
      const first = pageStarts(NIA);
      expect(first.answered).toBe(true);
      await settle();
      expect(readOnItsWay(NIA)).toBe(true);
      first.unmount();
      const second = pageStarts(NIA);
      expect(second.answered).toBe(false);
      await settle();
      expect(sent).toHaveLength(1);
      expect(second.result.current.state).toBeNull();
    });

    it("the page that started it, pressed again: it says yes (its own read shows) and sends nothing", async () => {
      const page = pageStarts(NIA);
      await settle();
      let again: boolean | undefined;
      act(() => {
        again = page.result.current.start(NIA);
      });
      expect(again).toBe(true);
      await settle();
      expect(sent).toHaveLength(1);
    });

    it("a read again is known by its audience; a new read by its handle, or its description", async () => {
      pageStarts(AGAIN);
      await settle();
      expect(readOnItsWay(AGAIN)).toBe(true);
      expect(readOnItsWay(NIA)).toBe(false);
      expect(readOnItsWay(buildRequestOf("describe", "nia.tests")!)).toBe(false);
    });

    it.each([
      ["done, the stream closed", () => {
        stream.send("done", { audience: { id: MADE } });
        stream.close();
      }],
      ["too little to read", () => stream.send("fallback", { reason: "thin" })],
      ["failed", () => stream.send("error", { message: null })],
      ["a throw while reading", () => stream.fail()],
      ["the stream closing with no outcome", () => stream.close()],
    ])("the record is cleared when it ends: %s; a new page can start it then", async (_end, end) => {
      const first = pageStarts(NIA);
      await settle();
      first.unmount();
      end();
      await settle();
      expect(readOnItsWay(NIA)).toBe(false);
      stream = madeUpStream();
      expect(pageStarts(NIA).answered).toBe(true);
      await settle();
      expect(sent).toHaveLength(2);
    });

    it.each([
      ["refused", () => ({ ok: false, status: 500, body: null }) as unknown as Response],
      ["a 401", () => ({ ok: false, status: 401, body: null }) as unknown as Response],
      ["no body", () => ({ ok: true, status: 200, body: null }) as unknown as Response],
      ["the request throws", () => Promise.reject(new TypeError("Failed to fetch"))],
    ] as const)("the record is cleared when the request ends at once: %s", async (_end, refusal) => {
      answer = refusal;
      pageStarts(NIA);
      await settle();
      expect(readOnItsWay(NIA)).toBe(false);
    });

    it("the page asks to stay open while the read runs or settles; not before, not after", async () => {
      expect(leaving()).toBe(false);
      pageStarts(NIA);
      await settle();
      expect(leaving()).toBe(true);
      stream.send("done", { audience: { id: MADE } });
      await settle();
      expect(leaving()).toBe(true);
      stream.close();
      await settle();
      expect(leaving()).toBe(false);
    });

    it("leaving the page lets the browser go (the read goes on)", async () => {
      const page = pageStarts(NIA);
      await settle();
      expect(leaving()).toBe(true);
      page.unmount();
      expect(leaving()).toBe(false);
      expect(readOnItsWay(NIA)).toBe(true);
    });

    it("a read that ends after its page has gone tells the audience page now on screen; one that ends with its page there tells nothing", async () => {
      const heard = vi.fn();
      renderHook(() => useAudienceChangedElsewhere(heard));
      const here = pageStarts(NIA);
      await settle();
      stream.send("fallback", { reason: "thin" });
      await settle();
      expect(heard).not.toHaveBeenCalled();
      here.unmount();

      stream = madeUpStream();
      const gone = pageStarts(NIA);
      await settle();
      gone.unmount();
      stream.send("done", { audience: { id: MADE } });
      stream.close();
      await settle();
      expect(heard).toHaveBeenCalledTimes(1);
    });

    it("a change said elsewhere (the new audience made the default from a page that has gone) is heard too; a listener that left hears nothing", () => {
      const heard = vi.fn();
      const listener = renderHook(() => useAudienceChangedElsewhere(heard));
      act(() => announceAudienceChanged());
      expect(heard).toHaveBeenCalledTimes(1);
      listener.unmount();
      act(() => announceAudienceChanged());
      expect(heard).toHaveBeenCalledTimes(1);
    });
  });
});
