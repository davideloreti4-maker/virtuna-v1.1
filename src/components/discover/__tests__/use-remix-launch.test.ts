/** @vitest-environment happy-dom */
/**
 * THE REFUSAL MUST NOT LOOK LIKE A BROKEN PRODUCT.
 *
 * `useRemixLaunch` is the discover→remix chain: it POSTs the source URL to `/api/tools/remix/run`
 * and navigates to /home, where the card the run writes into the thread will appear.
 *
 * `fetch` does not reject on an HTTP status. The hook awaited it, ignored the response entirely and
 * pushed to /home regardless — so a 402 credit refusal, a 401 dead session and a 500 all produced
 * the SAME thing: the creator lands on an unchanged home screen with no card, no message and no
 * idea why. That is indistinguishable from the product being broken, and on a 402 it is worse than
 * silence: the wall dialog exists, is mounted, and was never given the payload that raises it.
 *
 * `/api/tools/remix/run` is a PAID route (`creditGate` at route.ts:114), so both refusals are real
 * shapes it returns, not hypotheticals. The two one-liners the rest of the product uses —
 * `reportCredit402` / `reportSession401` — are the fix; these tests pin that they are reached and
 * that navigation is refused in every failure case.
 *
 * ⚠️ The success path deliberately LEAVES `pendingId` set. See the test at the bottom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import { useRemixLaunch } from "../use-remix-launch";

const push = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast }) }));

/** The exact body `quotaRefusalBody` writes — the only shape `isCreditQuotaExceeded` accepts. */
const QUOTA_402 = {
  error: "credit_quota_exceeded",
  message: "$1 unlocks the whole platform for 3 days — every skill, 50 credits.",
  tier: "free",
  used: 0,
  limit: 10,
  inTrial: false,
  reason: "trial_required",
  cost: 3,
};

const VIDEO_URL = "https://www.tiktok.com/@someone/video/7300000000000000000";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The 200 is an SSE stream, NOT json — the route answers `text/event-stream` and the hook must
 * never try to read that body (it does not close until the ~4-minute pipeline finishes).
 */
function sseAccepted(): Response {
  return new Response("event: stage\ndata: {}\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

let walls: unknown[];
let sessions: number;
const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
const onSession = () => sessions++;

beforeEach(() => {
  walls = [];
  sessions = 0;
  push.mockClear();
  toast.mockClear();
  window.addEventListener(CREDIT_WALL_EVENT, onWall);
  window.addEventListener(SESSION_EXPIRED_EVENT, onSession);
});

afterEach(() => {
  window.removeEventListener(CREDIT_WALL_EVENT, onWall);
  window.removeEventListener(SESSION_EXPIRED_EVENT, onSession);
  vi.restoreAllMocks();
});

describe("useRemixLaunch — an HTTP refusal never lands the creator on an empty /home", () => {
  it("a 402 raises the credit wall and does NOT navigate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(402, QUOTA_402))));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-1", VIDEO_URL);
    });

    expect(walls).toHaveLength(1);
    expect((walls[0] as { message: string }).message).toBe(QUOTA_402.message);
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it("a 402 draws NO toast — the wall dialog is the whole UI (never both)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(402, QUOTA_402))));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-1", VIDEO_URL);
    });

    expect(walls).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it("a 401 announces the dead session and does NOT navigate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(401, { error: "Unauthorized" }))));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-2", VIDEO_URL);
    });

    expect(sessions).toBe(1);
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it("a 401 draws NO toast — the session dialog explains it, and `Unauthorized` is not a sentence", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(401, { error: "Unauthorized" }))));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-2", VIDEO_URL);
    });

    expect(sessions).toBe(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it("a 500 tells the creator and does NOT navigate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(500, { error: "resolve_failed" }))));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-3", VIDEO_URL);
    });

    expect(push).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it("a refusal with a non-JSON body still refuses cleanly instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("<html>502 Bad Gateway</html>", { status: 502 })),
      ),
    );
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-4", VIDEO_URL);
    });

    expect(push).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });
});

describe("useRemixLaunch — the accepted run", () => {
  it("navigates to /home once the route accepts the POST", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(sseAccepted())));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-5", VIDEO_URL);
    });

    expect(push).toHaveBeenCalledWith("/home");
    expect(walls).toHaveLength(0);
    expect(sessions).toBe(0);
  });

  /**
   * NOT an oversight, and deliberately opposite to what the handoff proposed.
   *
   * `pendingId` is what disables the tile and prints "Starting…". The three panels that consume it
   * all unmount when the push to /home resolves, so clearing it first would only re-enable the
   * button for the width of a route transition — and that button starts a run that costs credits.
   * The pending state IS the double-fire guard; it should die with the component, not before it.
   */
  it("KEEPS pendingId set while navigating — the tile must not re-arm mid-transition", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(sseAccepted())));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-5", VIDEO_URL);
    });

    expect(result.current.pendingId).toBe("vid-5");
  });

  /** The success body is an unbounded SSE stream — reading it would hang the navigation. */
  it("never reads the 200 body", async () => {
    const res = sseAccepted();
    const json = vi.spyOn(res, "json");
    const text = vi.spyOn(res, "text");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(res)));
    const { result } = renderHook(() => useRemixLaunch());

    await act(async () => {
      await result.current.remix("vid-6", VIDEO_URL);
    });

    expect(json).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });
});
