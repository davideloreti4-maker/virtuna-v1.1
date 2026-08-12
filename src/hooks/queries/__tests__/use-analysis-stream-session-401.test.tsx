/** @vitest-environment happy-dom */

/**
 * THE JOIN FOR THE FLAGSHIP PAID RUN — a real 401 through `useAnalysisStream`.
 *
 * The sibling proof for `use-ideas-stream` explains why both halves have to be asserted together:
 * the drift guard can only see that a site CALLS `reportSession401`, and `run-failure.ts` resolves
 * the session cause perfectly in isolation whether or not any hook ever produces one. Neither
 * side's tests can see the other's gap.
 *
 * This hook is the one that had neither. `/api/analyze` returns 401 (route.ts:400) above its own
 * credit gate, and this hook read `res.ok` straight into "Analysis failed" — so the composer's
 * Test run, the priciest action in the product, died into "The generation or SIM-1 pass dropped
 * out". It was invisible to `session-401-coverage` because that guard keyed off `reportCredit402`
 * call sites and this hook handles its 402 through local `quotaError` state instead, making zero
 * such calls.
 *
 * `fetch` is mocked because it is a real I/O boundary. The hook's `if (!res.ok)` branch, its
 * `onError`, and `resolveRunError` all run for real.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useAnalysisStream, type AnalysisStreamInput } from "@/hooks/queries/use-analysis-stream";
import { RUN_FAILURE_SENTINEL, runErrorCopy } from "@/lib/net/run-failure";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";

// The hook reads `useParams` for its permalink-replay path; there is no Next router here.
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const INPUT: AnalysisStreamInput = {
  input_mode: "text",
  content_type: "tiktok",
  content_text: "a draft",
};

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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

/**
 * `start()` is `mutateAsync`, which REJECTS on a failed run — unlike the other stream hooks, whose
 * `start` swallows. Every caller in the app already does this (`void handleSubmit`, an awaited call
 * inside the composer's own try). Swallowing here keeps the assertions about the hook's STATE,
 * which is what the glass reads.
 */
async function runAndSettle(start: (i: AnalysisStreamInput) => Promise<void>) {
  await act(async () => {
    await start(INPUT).catch(() => {});
  });
}

describe("a 401 from /api/analyze", () => {
  it("raises the session dialog exactly once", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(raised).toBe(1);
  });

  it("records the session cause, not the route's slug and not the generic failure", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(result.current.error).toBe(RUN_FAILURE_SENTINEL.session);
    // "Unauthorized" is what the route actually sends. It must never reach the glass.
    expect(result.current.error).not.toMatch(/unauthorized/i);
    expect(result.current.error).not.toMatch(/analysis failed/i);
  });

  /**
   * The cause stated as the sentence the creator reads. `test` has no skill override, so without
   * the cause this run renders "The generation or SIM-1 pass dropped out. Tap to retry" — a
   * description of a failure that did not happen, offering a retry that earns the same 401.
   */
  it("reads as signed-out on the failed turn", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    const copy = runErrorCopy(result.current.error, "test");
    expect(copy.headline).toMatch(/signed out/i);
    expect(copy.body).toMatch(/nothing was charged/i);
    expect(copy.body).not.toMatch(/dropped out/i);
  });

  it("lands in the error phase rather than streaming forever", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(result.current.phase).toBe("error");
  });

  /**
   * The 401 fires ABOVE the credit gate in the route, so nothing was metered. A `quotaError` here
   * would mount `ReadingLimitDialog` on top of the session dialog and tell a signed-out user their
   * allowance was spent.
   */
  it("does not raise the credit wall", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(result.current.quotaError).toBeNull();
  });

  /**
   * A 401 means every subsequent request carries the same dead cookie, so the GET EventSource
   * reconnect ladder would earn the same refusal — and `phase: "reconnecting"` would replace the
   * session copy with a spinner that can never resolve.
   */
  it("does not open the reconnect ladder", async () => {
    respondWith(401, { error: "Unauthorized" });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(result.current.phase).not.toBe("reconnecting");
    expect(result.current.phase).not.toBe("polling");
  });
});

/**
 * The two refusals must stay distinguishable. Ordering the checks 401-then-402 is only correct if
 * each reads its own status, and a regression here is silent: a 402 that also raised the session
 * dialog would tell a paying customer they had been signed out.
 */
describe("the credit 402 is not a session refusal", () => {
  it("does not raise the session dialog, and still fills quotaError", async () => {
    respondWith(402, {
      error: "credit_quota_exceeded",
      message: "You're out of credits.",
      tier: "free",
      used: 0,
      limit: 0,
    });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(raised).toBe(0);
    expect(result.current.error).not.toBe(RUN_FAILURE_SENTINEL.session);
    expect(result.current.quotaError).not.toBeNull();
  });
});

/**
 * A 500 is an ordinary engine failure and must keep saying so — the generic copy is CORRECT there.
 * Without this, "always report the session" would pass every test above.
 */
describe("an ordinary failure is untouched", () => {
  it("does not raise the session dialog on a 500", async () => {
    respondWith(500, { error: "boom", message: "The engine fell over." });

    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await runAndSettle(result.current.start);

    expect(raised).toBe(0);
    expect(result.current.error).not.toBe(RUN_FAILURE_SENTINEL.session);
    expect(result.current.error).toBe("The engine fell over.");
  });
});
