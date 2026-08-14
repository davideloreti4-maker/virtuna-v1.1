/** @vitest-environment happy-dom */
/**
 * "PULL LIVE" IS THE MOST EXPENSIVE BUTTON ON THE SURFACE, AND IT ATE ITS OWN REFUSALS.
 *
 * Both fetches on this page hit paid routes — `/api/discover` runs the credit gate for 5 credits
 * (its own subtitle says so) and `/api/tools/remix/run` runs it again for the remix. Each swallowed
 * its refusal in a different way, and both were invisible to `session-401-coverage`: the remix POST
 * reads its URL out of the CHAIN_HANDOFFS registry, which that guard's literal-URL regex cannot see.
 *
 *  - `runPull` checked `res.ok` but reported every failure as the grid's generic error state. That
 *    state renders a Retry button, and retrying a 402 gets the same 402 forever — the exact futile
 *    loop `credit-wall.ts` was written to end.
 *  - `handleRemix` never checked the status at all: it pushed to /home on a 402, a 401 and a 500
 *    alike, so a refused creator landed on an unchanged home screen with no card and no reason.
 *
 * Verified against the real signed-in app before the fix (route-intercepted, nothing billed): both
 * refusals navigated to /home and drew no dialog.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import { DiscoverClient } from "../discover-client";

/** The tiles mount SaveAffordance, which reads its saved state through react-query. */
function renderClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <DiscoverClient />
    </QueryClientProvider>,
  );
}

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

/** The exact body `quotaRefusalBody` writes — the only shape `isCreditQuotaExceeded` accepts. */
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

const TILE = {
  platformVideoId: "7300000000000000000",
  videoUrl: "https://www.tiktok.com/@someone/video/7300000000000000000",
  caption: "I replaced my whole workflow with three prompts",
  views: 412000,
  likes: 38000,
  comments: 900,
  shares: 1200,
  saves: 4100,
  durationSeconds: 34,
  postedAt: "2026-07-30T10:00:00.000Z",
  multiplier: 6.2,
  baselineLabel: "vs their usual views",
  mode: "profile" as const,
  source: "profile:someone",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
  window.addEventListener(CREDIT_WALL_EVENT, onWall);
  window.addEventListener(SESSION_EXPIRED_EVENT, onSession);
});

afterEach(() => {
  cleanup();
  window.removeEventListener(CREDIT_WALL_EVENT, onWall);
  window.removeEventListener(SESSION_EXPIRED_EVENT, onSession);
  vi.restoreAllMocks();
});

/** Type a niche and submit — the real form, not a hand-called callback. */
function pull(): void {
  const input = screen.getByLabelText(/Discover input/i);
  fireEvent.change(input, { target: { value: "productivity" } });
  fireEvent.submit(input.closest("form")!);
}

/** Run a pull that succeeds, so the grid holds a tile whose Remix can then be clicked. */
async function pullThenFindRemix() {
  pull();
  const remix = await screen.findByRole("button", { name: /remix/i }, { timeout: 3000 });
  return remix;
}

/**
 * Tap a tile's Remix and get through the D3 brief sheet, which now sits between the tap and the
 * POST. Skipping is the path that reproduces the old one-tap behaviour exactly — the request body
 * carries no `brief` — so these refusal tests keep measuring the refusal and not the sheet.
 */
async function remixVia(remix: HTMLElement, brief?: string) {
  fireEvent.click(remix);
  const field = await screen.findByRole("textbox", {}, { timeout: 3000 });
  if (brief !== undefined) fireEvent.change(field, { target: { value: brief } });
  // An empty field IS the skip — submitting it is the path that reproduces the old one-tap run.
  fireEvent.submit(field.closest("form")!);
}

describe("Pull live — a refused PULL does not become a retry loop", () => {
  it("a 402 raises the wall instead of the grid's generic error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json(402, QUOTA_402))));
    renderClient();
    pull();

    await waitFor(() => expect(walls).toHaveLength(1));
    expect((walls[0] as { message: string }).message).toBe(QUOTA_402.message);
    // The wall is the UI. A Retry under it re-POSTs and gets the same 402 forever.
    expect(screen.queryByRole("button", { name: /try again|retry/i })).toBeNull();
  });

  it("a 401 announces the dead session instead of the grid's generic error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json(401, { error: "Unauthorized" }))));
    renderClient();
    pull();

    await waitFor(() => expect(sessions).toBe(1));
    expect(screen.queryByRole("button", { name: /try again|retry/i })).toBeNull();
  });

  it("a 500 still shows the retryable error — that dead-end is honest and must survive", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json(500, { error: "scrape_failed" }))));
    renderClient();
    pull();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /try again|retry/i })).toBeTruthy(),
    );
    expect(walls).toHaveLength(0);
    expect(sessions).toBe(0);
  });
});

describe("Pull live — a refused REMIX does not land the creator on an empty /home", () => {
  /**
   * Dispatch by URL, never by call order. The rendered tile mounts `SaveAffordance`, which GETs
   * `/api/saved` on mount — an order-based mock hands that request the remix's status and shifts
   * every later index, which is exactly how the first version of this helper miscounted.
   */
  function fetchThen(remixResponse: () => Response) {
    return vi.fn((url: string) => {
      if (url.includes("/api/tools/remix/run")) return Promise.resolve(remixResponse());
      if (url.includes("/api/discover")) {
        return Promise.resolve(json(200, { mode: "profile", input: "productivity", tiles: [TILE] }));
      }
      return Promise.resolve(json(200, {}));
    });
  }

  /** How many times the REMIX endpoint was actually POSTed, regardless of what else fetched. */
  function remixPosts(): number {
    const mock = globalThis.fetch as unknown as { mock: { calls: [string][] } };
    return mock.mock.calls.filter(([u]) => u.includes("/api/tools/remix/run")).length;
  }

  it("a 402 raises the wall and does NOT navigate", async () => {
    vi.stubGlobal("fetch", fetchThen(() => json(402, QUOTA_402)));
    renderClient();
    await remixVia(await pullThenFindRemix());

    await waitFor(() => expect(walls).toHaveLength(1));
    expect(push).not.toHaveBeenCalled();
  });

  it("a 401 announces the dead session and does NOT navigate", async () => {
    vi.stubGlobal("fetch", fetchThen(() => json(401, { error: "Unauthorized" })));
    renderClient();
    await remixVia(await pullThenFindRemix());

    await waitFor(() => expect(sessions).toBe(1));
    expect(push).not.toHaveBeenCalled();
  });

  it("a 500 does NOT navigate and re-arms the tile", async () => {
    vi.stubGlobal("fetch", fetchThen(() => json(500, { error: "resolve_failed" })));
    renderClient();
    const remix = await pullThenFindRemix();
    await remixVia(remix);

    // The POST must actually have gone out — otherwise "the tile re-armed" is vacuously true
    // because nothing ever disabled it.
    await waitFor(() => expect(remixPosts()).toBe(1));
    await waitFor(() => expect((remix as HTMLButtonElement).disabled).toBe(false));
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * D3 END TO END, through the real surface — the piece the hook's own test cannot prove.
   * `brief` reached the route and the adapt call from day one; what never existed was a producer.
   */
  it("a typed brief rides the POST", async () => {
    vi.stubGlobal(
      "fetch",
      fetchThen(
        () =>
          new Response("event: stage\ndata: {}\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    renderClient();
    await remixVia(await pullThenFindRemix(), "a cold-email teardown for B2B founders");

    await waitFor(() => expect(remixPosts()).toBe(1));
    const mock = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } };
    const [, init] = mock.mock.calls.find(([u]) => u.includes("/api/tools/remix/run"))!;
    expect(JSON.parse(init.body as string).brief).toBe("a cold-email teardown for B2B founders");
  });

  it("leaving it blank sends NO brief key — the creator's niche stays the target", async () => {
    vi.stubGlobal(
      "fetch",
      fetchThen(
        () =>
          new Response("event: stage\ndata: {}\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    renderClient();
    await remixVia(await pullThenFindRemix());

    await waitFor(() => expect(remixPosts()).toBe(1));
    const mock = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } };
    const [, init] = mock.mock.calls.find(([u]) => u.includes("/api/tools/remix/run"))!;
    expect("brief" in JSON.parse(init.body as string)).toBe(false);
  });

  it("Cancel spends nothing — no POST at all", async () => {
    vi.stubGlobal("fetch", fetchThen(() => json(500, { error: "should never be reached" })));
    renderClient();
    fireEvent.click(await pullThenFindRemix());
    await screen.findByRole("textbox", {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // On the DIALOG, not the textbox: this page has a second one (the Discover input), which
    // Radix only aria-hides while the sheet is open — so a textbox query "passes" the moment the
    // sheet closes and would also pass if it never opened.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(remixPosts()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("an accepted remix still navigates to /home", async () => {
    vi.stubGlobal(
      "fetch",
      fetchThen(
        () =>
          new Response("event: stage\ndata: {}\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    renderClient();
    await remixVia(await pullThenFindRemix());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    expect(walls).toHaveLength(0);
    expect(sessions).toBe(0);
  });
});
