/** @vitest-environment happy-dom */

/**
 * A followed creator's page with its data (spec 3.2 to 3.4): `/competitors/<handle>` under the new look.
 * The real container (`CreatorNext`), screen, card, More, figures, pulled cards, the pulled video's sheet
 * and its Remix question, Save over the app's saved-items hooks, Read again (`useReadChannel`,
 * `useChannelReadOut`), Simulate (`useSetDefaultAudience`, the shell's `newThreadAt`), Remove
 * (`useRemoveCreator`), a real QueryClient, the real toasts. Stand-ins only at the edges: `fetch` (every
 * route), the competitor action module (a server action, stubbed at its boundary), the router,
 * `matchMedia` (a phone), the page's clock where the confirming Remove is timed (`performance.now`) and
 * the build-time flag. Every handle, id and address is made up.
 *
 * What matters most: a press sends one request at most (a read again, a simulate, a remove), a Pull is
 * only armed (the pull page spends), and Remix leaves the video for Home with nothing sent from here.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { Figure } from "@/lib/audience-next/audience-model";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import type { CreatorPage, CreatorRead } from "@/lib/discover-next/creator";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { armPull, takePull } from "@/lib/discover-next/pull-intent";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { takeRemixFrom } from "@/lib/thread-next/remix-from";
import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const removeCompetitor = vi.hoisted(() => vi.fn<(id: string) => Promise<{ error?: string; success?: boolean }>>());
vi.mock("@/app/actions/competitors/remove", () => ({ removeCompetitor }));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/competitors/jay.makes",
  useRouter: () => router,
}));

import { CreatorNext, CreatorNextLoading } from "../creator-next";

// ─── Fixtures (made-up) ──────────────────────────────────────────────────────

const LINE = "I built a desk with no tools";
const TOP: PulledVideo = {
  id: "7300000000000000001",
  coverUrl: "https://covers.example/jay.makes/1.jpg",
  handle: "jay.makes",
  spokenHook: LINE,
  niche: null,
  platform: "tiktok",
  views: 106_100,
  postedAt: "2026-07-12T10:00:00.000Z",
  multiplier: 12,
  baselineLabel: "vs their average",
  proven: true,
  extreme: false,
  formats: [],
  captioned: true,
  likes: 4_200,
  comments: 310,
  videoUrl: "https://videos.example/jay.makes/1",
};
const SECOND: PulledVideo = {
  ...TOP,
  id: "7300000000000000002",
  coverUrl: null,
  spokenHook: "The joint nobody teaches you",
  views: 12_900,
  multiplier: 1.5,
  proven: false,
  videoUrl: "https://videos.example/jay.makes/2",
};

const FIGURES: Figure[] = [
  { key: "followers", label: "Followers", value: "15.4M" },
  { key: "likes", label: "Likes", value: "369.1M" },
  { key: "posts", label: "Posts", value: "6,364" },
  { key: "usual", label: "Usual views", value: "8.6K" },
];

/** Followed under two spellings and linked: three records. */
const MERGED = { trackedIds: ["t-jay-tt", "t-jay-ig"], competitorId: "p-jay" };

function creator(over: Partial<CreatorPage> = {}): CreatorPage {
  return {
    handle: "jay.makes",
    name: "Jay Makes",
    bio: "Furniture from hand tools, one board at a time.",
    avatarUrl: "https://store.example/jay.jpg",
    held: false,
    read: "read 13 Jul",
    canReadAgain: true,
    figures: FIGURES,
    videos: [TOP, SECOND],
    audience: null,
    removal: MERGED,
    ...over,
  };
}
const ready = (over: Partial<CreatorPage> = {}): CreatorRead => ({ state: "ready", creator: creator(over) });
const THEIRS: Partial<CreatorPage> = { audience: { id: "aud-jay", builtOn: "14 Nov" } };

// ─── The server ──────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ingestAnswer = (status: "scraped" | "cached") =>
  json({ status, handle: "jay.makes", profile: { handle: "jay.makes", displayName: "Jay Makes", avatarUrl: "", followerCount: 1, videoCount: 2 }, videosUpserted: 2 });

let onIngest: () => Promise<Response>;
let onDefault: () => Promise<Response>;
let onUntrack: (id: string) => Promise<Response>;
let savedList: SavedItem[];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === "/api/channels/ingest") return onIngest();
  if (url.pathname === "/api/settings/last-audience") return onDefault();
  if (url.pathname === "/api/tracked-accounts" && method === "DELETE") return onUntrack(url.searchParams.get("id")!);
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

/** Every request sent, as its method and path. */
const sent = () => fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input), "http://localhost").pathname}`);
const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === path).map(([, init]) => init);
const ingests = () => callsTo("/api/channels/ingest");
const defaults = () => callsTo("/api/settings/last-audience");
const untracked = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "DELETE")
    .map(([input]) => new URL(String(input), "http://localhost").searchParams.get("id"));

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

/** The page's clock, for the confirming Remove (it waits 500 ms). */
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;

/**
 * The page under the app's providers, which stand above it: the toasts and the query client stay when the
 * page goes. `show(null)` leaves the page; `show(read)` opens it again, on the same client.
 */
function renderPage(read: CreatorRead) {
  const ui = (r: CreatorRead | null) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{r && <CreatorNext read={r} />}</ToastProvider>
    </QueryClientProvider>
  );
  const view = render(ui(read));
  return { ...view, show: (r: CreatorRead | null) => view.rerender(ui(r)) };
}

const card = () => document.querySelector<HTMLElement>('[data-part="creator-card"]')!;
const cardLine = () => card().querySelector<HTMLElement>("[aria-live]")!;
const readAgain = () => within(card()).getByRole("button", { name: "Read again" });
const simulateButton = () => screen.getByRole("button", { name: "Simulate a video for their viewers" });
const pullButton = () => screen.getByRole("button", { name: "Pull their best videos · 5 credits" });
const grid = () => screen.getByRole("list", { name: "Their videos" });
const cards = () => within(grid()).getAllByRole("button");
const toasts = () => screen.queryAllByRole("alert");
const settle = () => act(async () => {});
/** Radix hands the focus back on a timer once a layer is gone. */
const wait = (ms = 20) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** More (the card's, on a phone), Remove, then the confirming Remove once its half second has passed. */
async function confirmRemove() {
  const more = within(card()).getByRole("button", { name: "More: @jay.makes" });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
  expect(within(screen.getByRole("dialog")).getByText("Remove @jay.makes?")).toBeInTheDocument();
  vi.advanceTimersByTime(500);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
  await wait();
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  onIngest = async () => ingestAnswer("scraped");
  onDefault = async () => json({ success: true });
  onUntrack = async () => json({ success: true });
  savedList = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  removeCompetitor.mockReset();
  removeCompetitor.mockResolvedValue({ success: true });
  widthIs("phone");
  for (const fn of Object.values(router)) fn.mockReset();
  useShellStore.setState({ pushedTitle: "" });
  clearActiveThreadCookie();
  takePull("");
  // The page's own address is on screen, as when the creator opened it.
  window.history.replaceState(null, "", "/competitors/jay.makes");
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
  window.history.replaceState(null, "", "/");
});

// ─── The states that are not the creator ─────────────────────────────────────

describe("CreatorNext — without the creator", () => {
  it("failed: Try again reads the page again", async () => {
    renderPage({ state: "failed" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this creator.");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gone: the sentence and Watchlist", async () => {
    renderPage({ state: "gone" });
    expect(screen.getByText("This creator isn't on your watchlist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/feed?tab=watchlist");
    expect(screen.queryByRole("alert")).toBeNull();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CreatorNext — arriving", () => {
  it("draws the creator and sends nothing", async () => {
    renderPage(ready());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@jay.makes");
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul · 2\u00a0videos");
    expect(cards().map((c) => c.getAttribute("aria-label"))).toEqual([LINE, "The joint nobody teaches you"]);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

// ─── Read again ──────────────────────────────────────────────────────────────

describe("CreatorNext — Read again", () => {
  it("Read again reads the creator alone: one POST /api/channels/ingest with the handle, nothing else", async () => {
    renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual(["POST /api/channels/ingest"]);
    expect(JSON.parse(String(ingests()[0]!.body))).toEqual({ handle: "jay.makes" });
  });

  it("while it reads: the button turns, the line says Reading…, a second press sends nothing", async () => {
    const out = deferred<Response>();
    onIngest = () => out.promise;
    renderPage(ready());
    const button = readAgain();
    // Two presses before the page has drawn the first.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · Reading… · 2\u00a0videos");
    fireEvent.click(button);
    await settle();
    expect(ingests()).toHaveLength(1);

    await act(async () => out.resolve(ingestAnswer("scraped")));
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul · 2\u00a0videos");
    expect(ingests()).toHaveLength(1);
  });

  it("read: the page reads itself again, no toast", async () => {
    renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    await settle();
    expect(toasts()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("read: until the page it asked for lands, a press sends nothing and says nothing; the new page decides", async () => {
    const view = renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));

    // The page is being read again: a press in between would only be answered "Read today".
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);
    expect(toasts()).toEqual([]);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    // It lands, read a moment ago: a press says the sentence and sends nothing.
    view.show(ready({ read: "read 25 Nov", canReadAgain: false }));
    fireEvent.click(readAgain());
    expect(await screen.findByRole("alert")).toHaveTextContent("Read today. Maven reads a creator once a day.");
    await settle();
    expect(ingests()).toHaveLength(1);
  });

  it("read: a new page frees Read again (the props are the signal, not a timer)", async () => {
    const view = renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);

    // A page that may be read again (the server's gate decides): a press reads.
    view.show(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(ingests()).toHaveLength(2));
  });

  it("read today by the server: the sentence, and the page reads itself again", async () => {
    onIngest = async () => ingestAnswer("cached");
    renderPage(ready());
    fireEvent.click(readAgain());
    expect(await screen.findByRole("alert")).toHaveTextContent("Read today. Maven reads a creator once a day.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(ingests()).toHaveLength(1);
    // Said once: until the page lands, a press sends nothing more.
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);
    expect(toasts()).toHaveLength(1);
  });

  it("refused: Couldn't read @jay.makes. Try again later., and the page keeps what it showed", async () => {
    onIngest = async () => json({ message: "scrape_failed" }, 502);
    renderPage(ready());
    fireEvent.click(readAgain());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes. Try again later.");
    expect(router.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul · 2\u00a0videos");
    expect(cards()).toHaveLength(2);
    // Pressable again: the next press reads again.
    fireEvent.click(readAgain());
    await waitFor(() => expect(ingests()).toHaveLength(2));
  });

  it("a creator that could not be read, read again: Reading… while it is out; refused, Couldn't be read again", async () => {
    const out = deferred<Response>();
    onIngest = () => out.promise;
    renderPage(ready({ held: true, name: null, bio: null, avatarUrl: null, figures: [], videos: [] }));
    expect(cardLine().textContent).toBe("Couldn't be read");
    fireEvent.click(readAgain());
    await waitFor(() => expect(readAgain()).toHaveAttribute("aria-busy", "true"));
    expect(cardLine().textContent).toBe("Reading…");

    await act(async () => out.resolve(json({ message: "scrape_failed" }, 502)));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes. Try again later.");
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));
    expect(cardLine().textContent).toBe("Couldn't be read");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a read that got no answer: the same toast", async () => {
    onIngest = async () => {
      throw new TypeError("Failed to fetch");
    };
    renderPage(ready());
    fireEvent.click(readAgain());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes. Try again later.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a lapsed session: the app's sign-in dialog, no toast of ours", async () => {
    const session = listen(SESSION_EXPIRED_EVENT);
    onIngest = async () => json({ error: "Unauthorized" }, 401);
    renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(session).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));
    expect(toasts()).toEqual([]);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("inside 24 hours: a press says the sentence, sends no read, and reads the page again (the day may have passed)", async () => {
    renderPage(ready({ canReadAgain: false }));
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(readAgain());
    expect(await screen.findByRole("alert")).toHaveTextContent("Read today. Maven reads a creator once a day.");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("opened again while its read is out: Reading…, and a press sends nothing", async () => {
    const out = deferred<Response>();
    onIngest = () => out.promise;
    const view = renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(readAgain()).toHaveAttribute("aria-busy", "true"));

    // Left, then opened again on the same client: the read is still out.
    view.show(null);
    expect(card()).toBeNull();
    view.show(ready());
    expect(readAgain()).toHaveAttribute("aria-busy", "true");
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · Reading… · 2\u00a0videos");
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);

    // It ends: the page is read again (asked by the press that sent it, and once by this page, which saw
    // it end), and until that page lands a press sends nothing and says nothing.
    await act(async () => out.resolve(ingestAnswer("scraped")));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);
    expect(toasts()).toEqual([]);
    expect(router.refresh).toHaveBeenCalledTimes(2);

    // The page lands: Read again is released.
    view.show(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(ingests()).toHaveLength(2));
  });

  it("opened again while its read is out, and the read is refused: this page asks to be read again, and its press waits for it", async () => {
    const out = deferred<Response>();
    onIngest = () => out.promise;
    const view = renderPage(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(readAgain()).toHaveAttribute("aria-busy", "true"));
    view.show(null);
    view.show(ready());

    await act(async () => out.resolve(json({ message: "scrape_failed" }, 502)));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes. Try again later.");
    // A refused read asks for nothing; this page, which saw it end, asks once.
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readAgain()).not.toHaveAttribute("aria-busy"));
    fireEvent.click(readAgain());
    await settle();
    expect(ingests()).toHaveLength(1);

    view.show(ready());
    fireEvent.click(readAgain());
    await waitFor(() => expect(ingests()).toHaveLength(2));
  });

  it("left while it reads: the answer is still said, and the page on screen is read again", async () => {
    const refused = deferred<Response>();
    onIngest = () => refused.promise;
    const view = renderPage(ready());
    fireEvent.click(readAgain());
    view.show(null);
    await act(async () => refused.resolve(json({ message: "scrape_failed" }, 502)));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read @jay.makes. Try again later.");

    const done = deferred<Response>();
    onIngest = () => done.promise;
    view.show(ready());
    fireEvent.click(readAgain());
    view.show(null);
    await act(async () => done.resolve(ingestAnswer("scraped")));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });
});

// ─── The main button ─────────────────────────────────────────────────────────

describe("CreatorNext — Build their audience, and Simulate", () => {
  it("Build their audience is a link: nothing sent", async () => {
    renderPage(ready());
    const link = screen.getByRole("link", { name: "Build their audience" });
    expect(link).toHaveAttribute("href", "/audience/new?door=handle&handle=jay.makes");
    // The browser's own navigation is not run here.
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Simulate: their audience becomes the one new chats use, then Home opens on a new chat", async () => {
    setActiveThreadCookie("t-open");
    const out = deferred<Response>();
    onDefault = () => out.promise;
    renderPage(ready(THEIRS));
    fireEvent.click(simulateButton());
    await waitFor(() => expect(defaults()).toHaveLength(1));
    const put = defaults()[0]!;
    expect(put.method).toBe("PUT");
    expect(JSON.parse(String(put.body))).toEqual({ audienceId: "aud-jay" });
    // Home opens only once the server said yes.
    await settle();
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => out.resolve(json({ success: true })));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home?v=Test"));
    expect(router.push).toHaveBeenCalledTimes(1);
    // A new chat, never the last one: the pointer is the new-chat sentinel.
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(sent()).toEqual(["PUT /api/settings/last-audience"]);
    expect(toasts()).toEqual([]);
  });

  it("Simulate waits: a second press sends nothing", async () => {
    const out = deferred<Response>();
    onDefault = () => out.promise;
    renderPage(ready(THEIRS));
    const button = simulateButton();
    // Two presses before the page has drawn the first.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    await settle();
    expect(defaults()).toHaveLength(1);

    await act(async () => out.resolve(json({ success: true })));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    // It waits until the page goes: a press meanwhile opens nothing more and sends nothing.
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    await settle();
    expect(defaults()).toHaveLength(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("refused: Couldn't switch the audience., pressable again, Home not opened", async () => {
    onDefault = async () => json({ error: "nope" }, 500);
    renderPage(ready(THEIRS));
    fireEvent.click(simulateButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't switch the audience.");
    await waitFor(() => expect(simulateButton()).not.toHaveAttribute("aria-busy"));
    expect(simulateButton()).not.toHaveAttribute("aria-disabled");
    expect(router.push).not.toHaveBeenCalled();
    expect(getActiveThreadCookie()).toBeNull();

    onDefault = async () => json({ success: true });
    fireEvent.click(simulateButton());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home?v=Test"));
    expect(defaults()).toHaveLength(2);
  });

  it("a lapsed session: the dialog, no toast", async () => {
    const session = listen(SESSION_EXPIRED_EVENT);
    onDefault = async () => json({ error: "Unauthorized" }, 401);
    renderPage(ready(THEIRS));
    fireEvent.click(simulateButton());
    await waitFor(() => expect(session).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(simulateButton()).not.toHaveAttribute("aria-busy"));
    expect(toasts()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("answered after the page was left: Home does not open over the page the creator went to", async () => {
    const out = deferred<Response>();
    onDefault = () => out.promise;
    const view = renderPage(ready(THEIRS));
    fireEvent.click(simulateButton());
    await waitFor(() => expect(defaults()).toHaveLength(1));
    view.show(null);
    await act(async () => out.resolve(json({ success: true })));
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    expect(getActiveThreadCookie()).toBeNull();
  });
});

// ─── Pull ────────────────────────────────────────────────────────────────────

describe("CreatorNext — Pull their best videos", () => {
  it("Pull: armed for @jay.makes, then the pull page; nothing sent", async () => {
    renderPage(ready());
    fireEvent.click(pullButton());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40jay.makes");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(takePull("@jay.makes")).toBe(true);
  });

  it("a Pull armed and the page left elsewhere: dropped", () => {
    const view = renderPage(ready());
    fireEvent.click(pullButton());
    window.history.replaceState(null, "", "/library");
    view.unmount();
    expect(takePull("@jay.makes")).toBe(false);
  });

  it("a Pull armed and the page giving way to its pull page: kept for it", () => {
    const view = renderPage(ready());
    fireEvent.click(pullButton());
    window.history.replaceState(null, "", "/feed/discover?input=%40jay.makes");
    view.unmount();
    expect(takePull("@jay.makes")).toBe(true);
  });

  it("arriving drops a press left behind, so its pull page cannot start without one", () => {
    armPull("@jay.makes");
    renderPage(ready());
    expect(takePull("@jay.makes")).toBe(false);
  });
});

// ─── Remove ──────────────────────────────────────────────────────────────────

describe("CreatorNext — Remove", () => {
  it("Remove: every record, then the Watchlist in the page's place, read again", async () => {
    clock();
    renderPage(ready());
    await confirmRemove();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed?tab=watchlist"));
    expect(untracked()).toEqual(["t-jay-tt", "t-jay-ig"]);
    expect(removeCompetitor).toHaveBeenCalledTimes(1);
    expect(removeCompetitor).toHaveBeenCalledWith("p-jay");
    expect(sent()).toEqual(["DELETE /api/tracked-accounts", "DELETE /api/tracked-accounts"]);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace.mock.invocationCallOrder[0]!).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
    expect(router.push).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it("Remove refused: the toast, and the page stays", async () => {
    clock();
    onUntrack = async (id) => (id === "t-jay-ig" ? json({ error: "nope" }, 500) : json({ success: true }));
    renderPage(ready());
    await confirmRemove();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove @jay.makes.");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(card()).not.toBeNull();
    // Asked again, it sends again.
    onUntrack = async () => json({ success: true });
    await confirmRemove();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed?tab=watchlist"));
    expect(untracked()).toHaveLength(4);
  });

  it("the action's answer with an error: the same toast", async () => {
    clock();
    removeCompetitor.mockResolvedValue({ error: "Failed to remove competitor" });
    renderPage(ready());
    await confirmRemove();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove @jay.makes.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("asked again while one is out: nothing more is sent", async () => {
    clock();
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    renderPage(ready());
    await confirmRemove();
    await waitFor(() => expect(untracked()).toHaveLength(2));
    await confirmRemove();
    await settle();
    expect(untracked()).toHaveLength(2);
    expect(removeCompetitor).toHaveBeenCalledTimes(1);

    await act(async () => held.resolve(json({ success: true })));
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it("done after the page was left: the page on screen is read again, and the creator is not taken from it", async () => {
    clock();
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    const view = renderPage(ready());
    await confirmRemove();
    await waitFor(() => expect(untracked()).toHaveLength(2));
    // The creator went elsewhere: another address is on screen.
    view.show(null);
    window.history.replaceState(null, "", "/library");
    await act(async () => held.resolve(json({ success: true })));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("done after a fresh read already took the page down, the address still this creator's: the Watchlist still opens", async () => {
    clock();
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    const view = renderPage(ready());
    await confirmRemove();
    await waitFor(() => expect(untracked()).toHaveLength(2));
    // The link's removal re-read the page before a DELETE answered: it now says the creator is gone.
    view.show({ state: "gone" });
    expect(screen.getByText("This creator isn't on your watchlist.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/competitors/jay.makes");
    await act(async () => held.resolve(json({ success: true })));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed?tab=watchlist"));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a lapsed session: the app's sign-in dialog, no toast of ours, and Remove can be asked again", async () => {
    clock();
    const session = listen(SESSION_EXPIRED_EVENT);
    removeCompetitor.mockResolvedValue({ error: "Not authenticated" });
    renderPage(ready());
    await confirmRemove();
    await waitFor(() => expect(session).toHaveBeenCalledTimes(1));
    await settle();
    expect(toasts()).toEqual([]);
    expect(router.replace).not.toHaveBeenCalled();
    expect(card()).not.toBeNull();
    // Signed in again, asked again: it sends again.
    removeCompetitor.mockResolvedValue({ success: true });
    await confirmRemove();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed?tab=watchlist"));
    expect(removeCompetitor).toHaveBeenCalledTimes(2);
  });
});

// ─── A video ─────────────────────────────────────────────────────────────────

describe("CreatorNext — a video's sheet", () => {
  async function opened() {
    renderPage(ready());
    const first = cards()[0]!;
    first.focus();
    fireEvent.click(first);
    const sheet = await screen.findByRole("dialog", { name: LINE });
    return { card: first, sheet };
  }

  it("a video: its sheet, Remix leaves it for a new chat, nothing sent from here", async () => {
    setActiveThreadCookie("t-open");
    const { sheet } = await opened();
    expect(within(sheet).getByText("12× their average")).toBeInTheDocument();
    const remix = within(sheet).getByRole("button", { name: "Remix this · 10 credits" });
    expect(remix).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(remix);
    const ask = await screen.findByRole("dialog", { name: "What do you want to make from this?" });
    expect(screen.queryByRole("dialog", { name: LINE })).toBeNull();
    fireEvent.change(within(ask).getByRole("textbox"), { target: { value: "for my bakery" } });
    fireEvent.click(within(ask).getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    expect(takeRemixFrom()).toEqual({ url: TOP.videoUrl, platform: "tiktok", brief: "for my bakery" });
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    // Home's own Remix runs it: the only request from here is the saved list's read (the sheet's Save).
    expect(sent().length).toBeGreaterThan(0);
    expect(new Set(sent())).toEqual(new Set(["GET /api/saved"]));
  });

  it("Save keeps the video under its TikTok id", async () => {
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
    });
  });

  it("closing the sheet gives the focus back to its card", async () => {
    const { card: first, sheet } = await opened();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(first).toHaveFocus());
  });

  it("another card opens its own sheet", async () => {
    await opened();
    fireEvent.keyDown(screen.getByRole("dialog", { name: LINE }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(cards()[1]!);
    const other = await screen.findByRole("dialog", { name: "The joint nobody teaches you" });
    expect(within(other).getByRole("button", { name: "Remix this · 10 credits" })).toBeInTheDocument();
  });
});

// ─── Loading ─────────────────────────────────────────────────────────────────

describe("CreatorNextLoading", () => {
  it("CreatorNextLoading: the outline, and nothing sent", async () => {
    render(<CreatorNextLoading />);
    expect(screen.getByTestId("creator-next")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll('[data-part="outline"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Creator");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
