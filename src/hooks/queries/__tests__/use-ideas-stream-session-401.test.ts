/** @vitest-environment happy-dom */

/**
 * THE JOIN, PROVEN END TO END — a real 401 through a real hook.
 *
 * `session-401-coverage.test.ts` proves the twenty call sites CALL `reportSession401`. It cannot
 * prove the call does anything: a site could report the 401 and still write the generic engine
 * copy, and the drift guard would stay green while the defect this lane removes was fully intact.
 * Equally, `run-failure.ts` resolves the session cause perfectly in isolation and would go on
 * doing so if no hook ever produced one. Neither side's tests can see the other's gap.
 *
 * So this drives the actual hook with an actual 401 response and asserts BOTH halves: the dialog
 * is raised, and the failed turn's copy says signed-out rather than "dropped out".
 *
 * `fetch` is mocked because it is a real I/O boundary. The hook's catch runs for real.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { RUN_FAILURE_SENTINEL, runErrorCopy } from "@/lib/net/run-failure";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";

let raised: number;
const count = () => {
  raised += 1;
};

beforeEach(() => {
  raised = 0;
  window.addEventListener(SESSION_EXPIRED_EVENT, count);
  // The browser reports a connection: nothing here may be diagnosed as offline.
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

afterEach(() => {
  window.removeEventListener(SESSION_EXPIRED_EVENT, count);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  );
}

describe("a 401 from a paid route", () => {
  it("raises the session dialog exactly once", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(raised).toBe(1);
  });

  it("records the session cause, not the route's slug and not the generic failure", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(result.current.error).toBe(RUN_FAILURE_SENTINEL.session);
    // The slug is what the route actually sends. It must never reach the glass.
    expect(result.current.error).not.toMatch(/unauthorized/i);
  });

  /**
   * The whole point of the cause, stated as the sentence the creator reads. `ideas` has no skill
   * override, so without the cause this run renders "The generation or SIM-1 pass dropped out.
   * Tap to retry" — a description of a failure that did not happen, offering a retry that earns
   * the same 401.
   */
  it("reads as signed-out on the failed turn", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    const copy = runErrorCopy(result.current.error, "ideas");
    expect(copy.headline).toMatch(/signed out/i);
    expect(copy.body).toMatch(/nothing was charged/i);
    expect(copy.body).not.toMatch(/dropped out/i);
  });

  it("leaves the run in a finished state rather than streaming forever", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(result.current.isStreaming).toBe(false);
  });
});

/**
 * The two refusals must stay distinguishable. Ordering the checks 401-then-402 is only correct if
 * each reads its own status, and a regression here is silent: a 402 that also raised the session
 * dialog would tell a paying customer they had been signed out.
 */
describe("the credit 402 is not a session refusal", () => {
  it("does not raise the session dialog", async () => {
    respondWith(402, { error: "credit_quota_exceeded", message: "You're out of credits." });

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(raised).toBe(0);
    expect(result.current.error).not.toBe(RUN_FAILURE_SENTINEL.session);
  });
});
