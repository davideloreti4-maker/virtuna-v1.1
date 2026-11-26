/** @vitest-environment happy-dom */

/**
 * The pull page (spec 3.6; drawing frames 6 and 7): `/feed/discover?input=…` under the new look. The real
 * container (`PullNext`), screen, offer row, pulled sheet, Remix sheet, Save (over the app's saved-items
 * hooks and a real QueryClient), Follow (the app's `useAddChannel`), Remix (the hand-off to a new chat,
 * `remix-from`, and the shell's `newThreadAt`), and the app's real walls and toasts. Stand-ins only at the edges: `fetch` (every route), the router, `matchMedia` (phone
 * or desk) and the build-time flag. Every handle, id and link is made up.
 *
 * The rule that matters most: an address never starts a pull. A pull costs 5 credits; only a press on
 * Pull sends it, or the intent a Pull button armed just before it opened this page.
 */

import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import type { PullTarget } from "@/lib/discover-next/pull";
import { armPull, takePull } from "@/lib/discover-next/pull-intent";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { takeRemixFrom } from "@/lib/thread-next/remix-from";
import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/feed/discover",
  useRouter: () => router,
}));

import { PullNext, PullNextLoading } from "../pull-next";
import { forgetPulls } from "../use-pull";

// ─── Fixtures (made-up) ──────────────────────────────────────────────────────

const JAY: PullTarget = { kind: "handle", input: "@jay.makes", handle: "jay.makes", shown: "@jay.makes" };
const MEAL: PullTarget = { kind: "words", input: "meal prep", handle: null, shown: "meal prep" };
const LINK: PullTarget = { kind: "not-tiktok", input: "instagram.com/jay.makes", shown: "instagram.com/jay.makes" };

const LINE = "I tried to build a desk with no tools";
const TILE_A = {
  platformVideoId: "7300000000000000001",
  videoUrl: "https://www.tiktok.com/@jay.makes/video/7300000000000000001",
  caption: `${LINE} #diy #fyp`,
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
  coverUrl: "https://covers.example/jay.makes/1.jpg",
  author: { handle: "jay.makes", fans: 1000, heart: 2000, videoCount: 30 },
};
const TILE_B = { ...TILE_A, platformVideoId: "7300000000000000002", caption: "#fyp", multiplier: 2, views: 900_000, coverUrl: undefined };

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

// ─── The server ──────────────────────────────────────────────────────────────

const PULL_ROUTE = "/api/discover";
const REMIX_ROUTE = "/api/tools/remix/run";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let onPull: () => Promise<Response>;
let onIngest: () => Promise<Response>;
let onTrack: () => Promise<Response>;
let onRemix: () => Promise<Response>;
let savedList: SavedItem[];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === PULL_ROUTE) return onPull();
  if (url.pathname === "/api/channels/ingest") return onIngest();
  if (url.pathname === "/api/tracked-accounts") return onTrack();
  if (url.pathname === REMIX_ROUTE) return onRemix();
  if (url.pathname === "/api/saved") {
    if (method === "POST") {
      const body = JSON.parse(String(init!.body)) as SavedItem;
      const row = { ...body, id: "sv-1", user_id: "u-1", project_id: null, created_at: "2026-11-25T10:00:00Z" } as SavedItem;
      savedList = [row, ...savedList];
      return json({ item: row }, 201);
    }
    return json({ items: savedList });
  }
  return json({}, 404);
});

const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === path).map(([, init]) => init);
const pulls = () => callsTo(PULL_ROUTE);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function listen(name: string) {
  const heard = vi.fn();
  window.addEventListener(name, heard);
  onTestFinished(() => window.removeEventListener(name, heard));
  return heard;
}

function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;

function renderPull({ subject = JAY, followed = false, strict = false }: { subject?: PullTarget; followed?: boolean; strict?: boolean } = {}) {
  const ui = (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PullNext subject={subject} followed={followed} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
}

const offer = () => document.querySelector<HTMLElement>('[data-part="pull-offer"]');
const pullButton = () => screen.queryByRole("button", { name: "Pull" });
const followButton = () => screen.queryByRole("button", { name: /^Follow(ing)?$/ });
const grid = () => screen.getByRole("list", { name: "Videos" });
const settle = () => act(async () => {});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  onPull = async () => json({ mode: "profile", input: "jay.makes", cached: false, tiles: [TILE_A, TILE_B] });
  onIngest = async () =>
    json({ status: "scraped", handle: "jay.makes", profile: { handle: "jay.makes", displayName: "Jay", avatarUrl: "", followerCount: 1, videoCount: 1 }, videosUpserted: 3 });
  onTrack = async () => json({ ok: true }, 201);
  onRemix = async () => new Response("", { status: 200 });
  savedList = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  widthIs("phone");
  for (const fn of Object.values(router)) fn.mockReset();
  useShellStore.setState({ pushedTitle: "" });
  takePull("");
  forgetPulls();
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  takePull("");
  // A remix hand-off or a pointer left by one test must not reach the next.
  takeRemixFrom();
  clearActiveThreadCookie();
  router.push.mockReset();
});

// ─── Arriving ────────────────────────────────────────────────────────────────

describe("the pull page — arriving by its address", () => {
  it("shows the offer row and sends NOTHING", async () => {
    renderPull();
    await settle();
    expect(offer()).toHaveTextContent("Pull @jay.makes's best videos");
    expect(offer()).toHaveTextContent("Ranked against their own average. 5 credits.");
    expect(pullButton()).toBeInTheDocument();
    expect(pulls()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing in strict mode either (its effects run twice)", async () => {
    renderPull({ strict: true });
    await settle();
    expect(pulls()).toEqual([]);
    expect(pullButton()).toBeInTheDocument();
  });

  it("an intent armed for another input, or longer ago than 15 seconds, starts nothing", async () => {
    armPull("@nia.cooks");
    renderPull();
    await settle();
    expect(pulls()).toEqual([]);
    cleanup();

    armPull("@jay.makes", Date.now() - 16_000);
    renderPull();
    await settle();
    expect(pulls()).toEqual([]);
    expect(pullButton()).toBeInTheDocument();
  });

  it("words: the offer for them, nothing sent", async () => {
    renderPull({ subject: MEAL });
    await settle();
    expect(offer()).toHaveTextContent("Pull videos about “meal prep”");
    expect(offer()).toHaveTextContent("5 credits");
    expect(pulls()).toEqual([]);
  });

  it("a link that is not TikTok: its sentence alone, no Pull, nothing sent (even when armed)", async () => {
    armPull(LINK.input);
    renderPull({ subject: LINK });
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Only TikTok can be read right now.");
    expect(pullButton()).toBeNull();
    expect(followButton()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is titled by the input: the shell's header on a phone, the page's own h1 on a desk", () => {
    renderPull();
    expect(useShellStore.getState().pushedTitle).toBe("@jay.makes");
    expect(screen.getByRole("heading", { level: 1, name: "@jay.makes" })).toBeInTheDocument();
  });
});

describe("the pull page — arriving from a Pull button", () => {
  it("a second mount of the same page after the intent was taken (Back, then Forward) sends nothing more: the cards it holds", async () => {
    armPull("@jay.makes");
    renderPull();
    await screen.findByText("2 videos read");
    expect(pulls()).toHaveLength(1);
    cleanup();

    renderPull();
    await settle();
    expect(pulls()).toHaveLength(1);
    expect(screen.getByText("2 videos read")).toBeInTheDocument();
    expect(pullButton()).toBeNull();
  });

  it("the armed intent sends ONE request at once, in strict mode too", async () => {
    armPull("@jay.makes");
    renderPull({ strict: true });
    await waitFor(() => expect(screen.getByText("2 videos read")).toBeInTheDocument());
    expect(pulls()).toHaveLength(1);
    expect(JSON.parse(String(pulls()[0]!.body))).toEqual({ input: "@jay.makes" });
    // Taken once: a later visit to the same address starts nothing.
    expect(takePull("@jay.makes")).toBe(false);
  });
});

// ─── Pulling ─────────────────────────────────────────────────────────────────

describe("the pull page — Pull, and what it shows", () => {
  it("only the button starts: one request; a second press while it runs sends nothing", async () => {
    const out = deferred<Response>();
    onPull = () => out.promise;
    renderPull();
    const pull = pullButton()!;
    pull.focus();
    fireEvent.click(pull);
    expect(pulls()).toHaveLength(1);
    // Running: the sentence and twelve outlines; no count, no percent; the offer has gone.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Reading @jay.makes's videos. This can take a few minutes.");
    expect(grid()).toHaveAttribute("aria-busy", "true");
    expect(grid().querySelectorAll('[data-part="outline"]')).toHaveLength(12);
    expect(document.body.textContent).not.toMatch(/%|\d+ videos read/);
    expect(pullButton()).toBeNull();
    // The focus the button held lands on the sentence.
    await waitFor(() => expect(status).toHaveFocus());

    await act(async () => out.resolve(json({ cached: false, tiles: [TILE_A, TILE_B] })));
    await waitFor(() => expect(screen.getByText("2 videos read")).toBeInTheDocument());
    expect(pulls()).toHaveLength(1);
  });

  it("done: the count, Biggest jump, and the cards in the server's order, each a button, not a link", async () => {
    renderPull();
    fireEvent.click(pullButton()!);
    await screen.findByText("2 videos read");
    expect(screen.getByText("Biggest jump")).toBeInTheDocument();
    expect(grid()).not.toHaveAttribute("aria-busy");
    expect(within(grid()).queryAllByRole("link")).toEqual([]);
    const cards = within(grid()).getAllByRole("button");
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([LINE, "Video by @jay.makes"]);
    expect(cards[0]).toHaveAttribute("aria-haspopup", "dialog");
    // The first: its badge and meta describe it, with the ▲ of a proven video; the second beat their
    // usual (2×) without being proven: its multiple, no ▲.
    expect(cards[0]).toHaveAccessibleDescription("16× @jay.makes · 18.4M");
    expect(cards[0]!.querySelector('[data-part="badge"] svg')).not.toBeNull();
    expect(cards[1]!.querySelector('[data-part="badge"]')).toHaveTextContent("2×");
    expect(cards[1]!.querySelector('[data-part="badge"] svg')).toBeNull();
    expect(screen.getByText(LINE)).toBeInTheDocument();
    expect(screen.queryByText(/#diy/)).toBeNull();
    // The library card's face: the count is never the part a narrow card cuts.
    expect(cards[0]!.querySelector('[data-part="handle"]')!.className.split(/\s+/)).toContain("truncate");
    expect(cards[0]!.querySelector('[data-part="views"]')!.className.split(/\s+/)).toContain("shrink-0");
  });

  it("one video: said in the singular", async () => {
    onPull = async () => json({ cached: true, tiles: [TILE_A] });
    renderPull();
    fireEvent.click(pullButton()!);
    expect(await screen.findByText("1 video read")).toBeInTheDocument();
  });

  it("none: No standout videos, for a creator and for words", async () => {
    onPull = async () => json({ cached: false, tiles: [] });
    renderPull();
    fireEvent.click(pullButton()!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No standout videos for @jay.makes."));
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    cleanup();

    renderPull({ subject: MEAL });
    fireEvent.click(pullButton()!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No standout videos about “meal prep”."));
  });

  it("the running sentence wraps, even a long word with no spaces", () => {
    onPull = () => new Promise(() => {});
    renderPull({ subject: { kind: "words", input: "a".repeat(120), handle: null, shown: "a".repeat(120) } });
    fireEvent.click(pullButton()!);
    expect(screen.getByRole("status").className.split(/\s+/)).toContain("break-words");
  });

  it("words: the running sentence names them", async () => {
    onPull = () => new Promise(() => {});
    renderPull({ subject: MEAL });
    fireEvent.click(pullButton()!);
    expect(screen.getByRole("status")).toHaveTextContent("Reading videos about “meal prep”. This can take a few minutes.");
    expect(JSON.parse(String(pulls()[0]!.body))).toEqual({ input: "meal prep" });
  });
});

describe("the pull page — left and come back (the pull is held by its input)", () => {
  it("left while it reads: coming back shows it reading, offers nothing to pay twice, and sends nothing", async () => {
    const out = deferred<Response>();
    onPull = () => out.promise;
    renderPull();
    fireEvent.click(pullButton()!);
    cleanup();

    armPull("@jay.makes");
    renderPull();
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Reading @jay.makes's videos. This can take a few minutes.");
    expect(pullButton()).toBeNull();
    expect(pulls()).toHaveLength(1);
    await act(async () => out.resolve(json({ cached: false, tiles: [TILE_A, TILE_B] })));
    expect(await screen.findByText("2 videos read")).toBeInTheDocument();
    expect(pulls()).toHaveLength(1);
  });

  it("left after the answer: coming back shows the cards, and nothing is sent", async () => {
    renderPull();
    fireEvent.click(pullButton()!);
    await screen.findByText("2 videos read");
    cleanup();

    renderPull();
    expect(screen.getByText("2 videos read")).toBeInTheDocument();
    await settle();
    expect(pulls()).toHaveLength(1);
  });

  it("a failure is not held: coming back shows the offer", async () => {
    onPull = async () => json({}, 502);
    renderPull();
    fireEvent.click(pullButton()!);
    await screen.findByRole("alert");
    cleanup();

    renderPull();
    expect(pullButton()).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the pull page — failures", () => {
  it.each([
    [403, { error: "verdict_sealed" }],
    [415, { error: "Unsupported Media Type" }],
  ])("%i, turned away: the sentence, and no Try again (a retry would be turned away too)", async (status, body) => {
    onPull = async () => json(body, status);
    renderPull();
    fireEvent.click(pullButton()!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(pulls()).toHaveLength(1);
  });

  it("the daily limit: its sentence with the answer's number, and no Try again", async () => {
    onPull = async () => json({ error: "daily_cap_reached", message: "x", used: 20, limit: 20 }, 429);
    renderPull();
    fireEvent.click(pullButton()!);
    expect(await screen.findByRole("alert")).toHaveTextContent("You've pulled 20 times today. Try again tomorrow.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(pullButton()).toBeNull();
  });

  it("a link the server cannot read: Only TikTok, and no Try again", async () => {
    onPull = async () => json({ error: "unsupported_input", message: "x" }, 400);
    renderPull({ subject: MEAL });
    fireEvent.click(pullButton()!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Only TikTok can be read right now.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("anything else: Couldn't read, with Try again, which sends again", async () => {
    onPull = async () => json({ error: "scrape_failed", message: "x" }, 502);
    renderPull();
    fireEvent.click(pullButton()!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes.");
    onPull = async () => json({ cached: false, tiles: [TILE_A] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1 video read")).toBeInTheDocument();
    expect(pulls()).toHaveLength(2);
  });

  it("words that could not be read: their own sentence", async () => {
    onPull = async () => {
      throw new TypeError("Failed to fetch");
    };
    renderPull({ subject: MEAL });
    fireEvent.click(pullButton()!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read videos about “meal prep”.");
  });

  it("no credits: the app's wall, and the offer again underneath (no failure to retry)", async () => {
    const wall = listen(CREDIT_WALL_EVENT);
    onPull = async () => json(QUOTA_402, 402);
    renderPull();
    fireEvent.click(pullButton()!);
    await waitFor(() => expect(wall).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pullButton()).toBeInTheDocument());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a lapsed session: the app's sign-in dialog, and the offer again", async () => {
    const session = listen(SESSION_EXPIRED_EVENT);
    onPull = async () => json({ error: "Unauthorized" }, 401);
    renderPull();
    fireEvent.click(pullButton()!);
    await waitFor(() => expect(session).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pullButton()).toBeInTheDocument());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ─── Follow ──────────────────────────────────────────────────────────────────

describe("the pull page — Follow", () => {
  it("on a desk it sits at the right of the page's header", () => {
    widthIs("desk");
    renderPull();
    const header = screen.getByRole("heading", { level: 1, name: "@jay.makes" }).parentElement!;
    expect(within(header).getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(1);
  });

  it("on a phone it is not in the page's header (the shell's holds the title and New chat)", () => {
    renderPull();
    const header = screen.getByRole("heading", { level: 1, name: "@jay.makes" }).parentElement!;
    expect(within(header).queryByRole("button", { name: "Follow" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(1);
  });

  it("on a phone, arrived: at the right of the offer's first line, beside its title", () => {
    renderPull();
    const follow = screen.getByRole("button", { name: "Follow" });
    const line = follow.closest('[data-part="first-line"]')!;
    expect(line).not.toBeNull();
    expect(line.closest('[data-part="pull-offer"]')).not.toBeNull();
    expect(line).toHaveTextContent("Pull @jay.makes's best videos");
  });

  it("on a phone, running: at the right of the running sentence's line", () => {
    onPull = () => new Promise(() => {});
    renderPull();
    fireEvent.click(pullButton()!);
    const line = screen.getByRole("button", { name: "Follow" }).closest('[data-part="first-line"]')!;
    expect(within(line as HTMLElement).getByRole("status")).toHaveTextContent("Reading @jay.makes's videos.");
  });

  it("on a phone, done: at the right of the count line, after Biggest jump", async () => {
    renderPull();
    fireEvent.click(pullButton()!);
    await screen.findByText("2 videos read");
    const line = screen.getByRole("button", { name: "Follow" }).closest('[data-part="first-line"]')!;
    expect(line).toHaveTextContent(/^2 videos readBiggest jumpFollow$/);
  });

  it.each([
    ["none", async () => json({ cached: false, tiles: [] })],
    ["a failure", async () => json({}, 502)],
  ] as const)("on a phone, %s: the sentence stands alone, so Follow keeps a row of its own", async (_name, answer) => {
    onPull = answer;
    renderPull();
    fireEvent.click(pullButton()!);
    await waitFor(() => expect(pullButton()).toBeNull());
    await waitFor(() => expect(screen.queryByText(/Reading/)).toBeNull());
    const line = screen.getByRole("button", { name: "Follow" }).closest('[data-part="first-line"]')!;
    expect(line).toHaveTextContent(/^Follow$/);
  });

  it("is the quiet button in every state; the one ink button is Pull", async () => {
    const ink = (el: HTMLElement) => el.className.split(/\s+/).includes("bg-action");
    const read = deferred<Response>();
    onIngest = () => read.promise;
    renderPull();
    expect(ink(pullButton()!)).toBe(true);
    expect(ink(followButton()!)).toBe(false);
    fireEvent.click(followButton()!);
    expect(ink(followButton()!)).toBe(false);
    await act(async () =>
      read.resolve(json({ status: "cached", handle: "jay.makes", profile: { handle: "jay.makes", displayName: "", avatarUrl: "", followerCount: 1, videoCount: 1 }, videosUpserted: 0 })),
    );
    await waitFor(() => expect(followButton()).toHaveAccessibleName("Following"));
    expect(ink(followButton()!)).toBe(false);
  });

  it("not for words, and not for a link", () => {
    renderPull({ subject: MEAL });
    expect(followButton()).toBeNull();
  });

  it("follows the creator (read, then follow); waits meanwhile; then Following, pressed and inert", async () => {
    const read = deferred<Response>();
    onIngest = () => read.promise;
    renderPull();
    fireEvent.click(followButton()!);
    expect(followButton()).toHaveAttribute("aria-busy", "true");
    expect(followButton()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(followButton()!);
    await waitFor(() => expect(callsTo("/api/channels/ingest")).toHaveLength(1));
    await settle();
    expect(callsTo("/api/channels/ingest")).toHaveLength(1);
    expect(JSON.parse(String(callsTo("/api/channels/ingest")[0]!.body))).toEqual({ handle: "jay.makes" });

    await act(async () =>
      read.resolve(
        json({ status: "cached", handle: "jay.makes", profile: { handle: "jay.makes", displayName: "", avatarUrl: "", followerCount: 1, videoCount: 1 }, videosUpserted: 0 }),
      ),
    );
    await waitFor(() => expect(followButton()).toHaveAccessibleName("Following"));
    expect(followButton()).toHaveAttribute("aria-pressed", "true");
    expect(followButton()).toHaveAttribute("aria-disabled", "true");
    expect(JSON.parse(String(callsTo("/api/tracked-accounts")[0]!.body))).toEqual({ platform: "tiktok", handle: "jay.makes" });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(followButton()!);
    await settle();
    expect(callsTo("/api/channels/ingest")).toHaveLength(1);
    // Following does not touch the pull.
    expect(pulls()).toEqual([]);
  });

  it("already followed: Following from the start, and a press sends nothing", async () => {
    renderPull({ followed: true });
    expect(followButton()).toHaveAccessibleName("Following");
    expect(followButton()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(followButton()!);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refused: a toast, and Follow again", async () => {
    onIngest = async () => json({ message: "channel_not_found" }, 404);
    renderPull();
    fireEvent.click(followButton()!);
    expect(await screen.findByText("Couldn't follow @jay.makes.")).toBeInTheDocument();
    await waitFor(() => expect(followButton()).toHaveAccessibleName("Follow"));
    expect(followButton()).toHaveAttribute("aria-pressed", "false");
    expect(followButton()).not.toHaveAttribute("aria-disabled");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("the follow itself refused after the read: the same toast", async () => {
    onTrack = async () => json({ error: "nope" }, 500);
    renderPull();
    fireEvent.click(followButton()!);
    expect(await screen.findByText("Couldn't follow @jay.makes.")).toBeInTheDocument();
  });

  it("a lapsed session: the app's sign-in dialog, no toast of ours", async () => {
    const session = listen(SESSION_EXPIRED_EVENT);
    onIngest = async () => json({ error: "Unauthorized" }, 401);
    renderPull();
    fireEvent.click(followButton()!);
    await waitFor(() => expect(session).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(followButton()).toHaveAccessibleName("Follow"));
    expect(screen.queryByText("Couldn't follow @jay.makes.")).toBeNull();
  });
});

// ─── A pulled video ──────────────────────────────────────────────────────────

describe("the pull page — a pulled video's sheet", () => {
  async function opened() {
    renderPull();
    fireEvent.click(pullButton()!);
    await screen.findByText(/^\d+ videos? read$/);
    const card = within(grid()).getAllByRole("button")[0]!;
    card.focus();
    fireEvent.click(card);
    const sheet = await screen.findByRole("dialog", { name: LINE });
    return { card, sheet };
  }

  it("the cover, the line, the multiple's words, the numbers, Remix, Save and Watch on TikTok", async () => {
    const { sheet } = await opened();
    expect(within(sheet).getByText("16× their average")).toBeInTheDocument();
    expect(within(sheet).getByText("18.4M views · 1.2M likes · 3.4K comments")).toBeInTheDocument();
    expect(sheet.querySelector('img[src="https://covers.example/jay.makes/1.jpg"]')).not.toBeNull();
    expect(within(sheet).getByRole("button", { name: "Remix this · 10 credits" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(sheet).getByRole("button", { name: "Save" })).toBeInTheDocument();
    const watch = within(sheet).getByRole("link", { name: "Watch on TikTok, opens in a new tab" });
    expect(watch).toHaveAttribute("href", TILE_A.videoUrl);
    expect(watch).toHaveAttribute("target", "_blank");
    expect(watch).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("past 100: more than 100×, and the quiet line", async () => {
    onPull = async () => json({ cached: false, tiles: [{ ...TILE_A, multiplier: 240 }] });
    const { sheet } = await opened();
    expect(within(sheet).getByText("more than 100× their average")).toBeInTheDocument();
    expect(within(sheet).getByText("A small account makes this number shaky.")).toBeInTheDocument();
  });

  it("Save puts it in Library under its TikTok id, and marks it", async () => {
    const { sheet } = await opened();
    const save = within(sheet).getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled"));
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveAttribute("aria-pressed", "true"));
    const writes = fetchMock.mock.calls.filter(([input, init]) => String(input).includes("/api/saved") && init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0]![1]!.body))).toMatchObject({
      item_type: "outlier",
      ref_id: "tiktok:7300000000000000001",
      thread_id: null,
      title: LINE,
      snapshot: { caption: LINE, videoUrl: TILE_A.videoUrl, views: 18_400_000, multiplier: 16, handle: "jay.makes", platform: "tiktok" },
    });
  });

  it("Remix this closes the sheet and asks what to make; Remix leaves the video for a new chat and opens it; nothing is sent from here", async () => {
    setActiveThreadCookie("t-open");
    await opened();
    fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
    const ask = await screen.findByRole("dialog", { name: "What do you want to make from this?" });
    expect(screen.queryByRole("dialog", { name: LINE })).toBeNull();
    fireEvent.change(within(ask).getByRole("textbox"), { target: { value: "for my bakery" } });
    fireEvent.click(within(ask).getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    expect(takeRemixFrom()).toEqual({ url: TILE_A.videoUrl, platform: "tiktok", brief: "for my bakery" });
    // A new chat, also from inside one: the pointer is the new-chat sentinel.
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    // Home's own Remix runs it (its walls, its billing): no request from Discover.
    expect(callsTo(REMIX_ROUTE)).toEqual([]);
  });

  it("while one remix is on its way to Home, another card's Remix waits and leaves nothing", async () => {
    await opened();
    fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
    const ask = await screen.findByRole("dialog", { name: "What do you want to make from this?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const left = takeRemixFrom();
    expect(left?.url).toBe(TILE_A.videoUrl);

    fireEvent.click(within(grid()).getAllByRole("button")[1]!);
    const other = await screen.findByRole("dialog", { name: "Video by @jay.makes" });
    const remix = within(other).getByRole("button", { name: "Remix this · 10 credits" });
    expect(remix).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(remix);
    await settle();
    expect(screen.queryByRole("dialog", { name: "What do you want to make from this?" })).toBeNull();
    expect(takeRemixFrom()).toBeNull();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(callsTo(REMIX_ROUTE)).toEqual([]);
  });

  it("the focus comes back to the card once the question is closed", async () => {
    const { card } = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
    const ask = await screen.findByRole("dialog", { name: "What do you want to make from this?" });
    fireEvent.keyDown(ask, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(card).toHaveFocus());
  });

  it("closing the sheet gives the focus back to its card", async () => {
    const { card, sheet } = await opened();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(card).toHaveFocus();
  });

  it("a video with no web address: no Remix and no watch link", async () => {
    onPull = async () => json({ cached: false, tiles: [{ ...TILE_A, videoUrl: "" }] });
    const { sheet } = await opened();
    expect(within(sheet).queryByRole("button", { name: "Remix this · 10 credits" })).toBeNull();
    expect(within(sheet).queryByRole("link")).toBeNull();
  });
});

describe("PullNextLoading", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("is the offer row's outline, busy, and sends nothing", () => {
    render(<PullNextLoading />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(document.querySelector('[data-part="outline"]')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("giving way to its pull page keeps a press's intent", () => {
    window.history.replaceState(null, "", "/feed/discover?input=%40jay.makes");
    armPull("@jay.makes");
    render(<PullNextLoading />).unmount();
    expect(takePull("@jay.makes")).toBe(true);
  });

  it("left for anywhere else before the page came: the intent is dropped, so Back to the address starts nothing", () => {
    window.history.replaceState(null, "", "/feed/discover?input=%40jay.makes");
    armPull("@jay.makes");
    const loading = render(<PullNextLoading />);
    window.history.replaceState(null, "", "/library");
    loading.unmount();
    expect(takePull("@jay.makes")).toBe(false);
  });
});
