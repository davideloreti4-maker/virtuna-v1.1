/** @vitest-environment happy-dom */
/**
 * The Watchlist chip (spec 3.5; drawing frame 5) inside the real hub (`DiscoverNext`): the real panel,
 * rows, row menus, Follow sheet, the app's own add and remove hooks over a real QueryClient, and the
 * app's real toasts. Stand-ins only at the edges: `fetch` (the add's two routes and the remove route),
 * the competitor action module (a server action, stubbed at its boundary), the router, the address
 * (`useSearchParams` following the History API, as Next does), `matchMedia` (a phone), the page's clock
 * where a test times a press, and the build-time flag. Every handle and id is made up.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { CardVideo, HubData } from "@/lib/discover-next/hub-data";
import type { WatchlistData, WatchlistSource } from "@/lib/discover/watchlist-reads";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const removeCompetitor = vi.hoisted(() => vi.fn<(id: string) => Promise<{ error?: string; success?: boolean }>>());
vi.mock("@/app/actions/competitors/remove", () => ({ removeCompetitor }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };

/** The address's parameters as Next keeps them: `useSearchParams` follows the History API. */
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let search = "";
  return {
    search: () => search,
    set(next: string) {
      if (next === search) return;
      search = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  return {
    usePathname: () => "/feed",
    useRouter: () => router,
    useSearchParams: () => {
      const search = useSyncExternalStore(nav.subscribe, nav.search, nav.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

import { takePull } from "@/lib/discover-next/pull-intent";
import { DiscoverNext } from "../discover-next";

const nativeReplaceState = window.history.replaceState.bind(window.history);
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
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

// ─── Fixtures (made-up creators) ─────────────────────────────────────────────

function source(over: Partial<WatchlistSource>): WatchlistSource {
  return {
    key: "k",
    handle: "x",
    name: "x",
    avatarUrl: null,
    followerCount: null,
    outlierCount: 0,
    bestMultiplier: null,
    videosHeld: 0,
    newestPostAt: null,
    mergedFrom: null,
    held: false,
    profileHandle: null,
    trackedIds: [],
    competitorId: null,
    covers: [],
    provenCount: 0,
    ...over,
  };
}

/** Followed and linked, on two platforms: three records. */
const JAY = source({
  key: "p-jay",
  handle: "jay.makes",
  name: "Jay Makes",
  avatarUrl: "https://store.example/jay.jpg",
  followerCount: 162_000_000,
  provenCount: 12,
  profileHandle: "jay.makes",
  trackedIds: ["t-jay-tt", "t-jay-ig"],
  competitorId: "p-jay",
  covers: ["https://store.example/j1.jpg", "https://store.example/j2.jpg", "https://store.example/j3.jpg"],
});
/** Linked only. */
const NIA = source({ key: "p-nia", handle: "nia.cooks", name: "Nia in the kitchen", followerCount: 86_000_000, profileHandle: "nia.cooks", competitorId: "p-nia" });
/** Followed only. */
const DEV = source({ key: "dev.lifts", handle: "dev.lifts", name: "dev.lifts", trackedIds: ["t-dev"] });

const WATCHLIST: WatchlistData = { sources: [JAY, NIA, DEV], latest: [], incomplete: false };
const NOBODY: WatchlistData = { sources: [], latest: [], incomplete: false };

function video(n: number): CardVideo {
  return {
    id: `v${n}`,
    coverUrl: null,
    handle: "jay.makes",
    spokenHook: `Line ${n}`,
    niche: "food",
    platform: "tiktok",
    views: 1_000_000 - n,
    postedAt: null,
    multiplier: 5,
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
  };
}
const HUB: HubData = { videos: Array.from({ length: 60 }, (_, i) => video(i + 1)), collections: [] };
const OK = { corpus: false, watchlist: false };

// ─── The server ──────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** How each request is answered; a test replaces one to hold or refuse it. */
let onUntrack: (id: string) => Promise<Response>;
let onIngest: (handle: string) => Promise<Response>;
/** The follow itself, after the account was read (the add's second call). */
let onTrack: () => Promise<Response>;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === "/api/tracked-accounts" && method === "DELETE") return onUntrack(url.searchParams.get("id")!);
  if (url.pathname === "/api/tracked-accounts" && method === "POST") return onTrack();
  if (url.pathname === "/api/channels/ingest" && method === "POST") return onIngest((JSON.parse(String(init!.body)) as { handle: string }).handle);
  return json({}, 404);
});

const calls = (path: string, method: string) =>
  fetchMock.mock.calls
    .filter(([input, init]) => new URL(String(input), "http://localhost").pathname === path && (init?.method ?? "GET") === method)
    .map(([input, init]) => ({ url: new URL(String(input), "http://localhost"), body: init?.body ? (JSON.parse(String(init.body)) as unknown) : null }));
const untracked = () => calls("/api/tracked-accounts", "DELETE").map((c) => c.url.searchParams.get("id"));

// ─── Rendering ───────────────────────────────────────────────────────────────

function ui(watchlist: WatchlistData, failures = OK, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <main>
          <DiscoverNext hub={HUB} watchlist={watchlist} failures={failures} />
        </main>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function renderChip({ watchlist = WATCHLIST, failures = OK, href = "/feed?tab=watchlist" }: { watchlist?: WatchlistData; failures?: typeof OK; href?: string } = {}) {
  setAddress(href);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(ui(watchlist, failures, client));
  return { ...view, again: (next: WatchlistData, nextFailures = OK) => view.rerender(ui(next, nextFailures, client)) };
}

const list = () => screen.getByRole("list", { name: "Watchlist" });
/** The rows' buttons by name, in order, the Follow row last. */
const rowNames = () =>
  within(list())
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? document.getElementById(b.getAttribute("aria-labelledby") ?? "")?.textContent ?? b.textContent);
const rowOf = (handle: string) => screen.getByRole("button", { name: `@${handle}` });
const followRow = () => within(list()).getByRole("button", { name: "Follow a creator" });
const field = () => screen.getByRole("textbox", { name: "Search" });
const dialog = () => screen.getByRole("dialog");
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Opens a row's menu, asks Remove, waits past the guard, and confirms. */
function removeRow(handle: string) {
  const row = rowOf(handle);
  row.focus();
  fireEvent.click(row);
  fireEvent.click(within(dialog()).getByRole("button", { name: "Remove" }));
  vi.advanceTimersByTime(600);
  const rows = dialog().querySelectorAll('[data-part="menu-row"]');
  fireEvent.click(within(rows[rows.length - 1] as HTMLElement).getByRole("button", { name: "Remove" }));
}

beforeEach(() => {
  widthIs("phone");
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplaceState(data, unused, url);
    if (url != null) nav.set(new URL(String(url), "http://localhost").search);
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  for (const fn of Object.values(router)) fn.mockReset();
  removeCompetitor.mockReset();
  removeCompetitor.mockResolvedValue({ success: true });
  onUntrack = async () => json({ success: true });
  onTrack = async () => json({ ok: true }, 201);
  onIngest = async (handle) =>
    json({ status: "scraped", handle, profile: { handle, displayName: handle, avatarUrl: "", followerCount: 10, videoCount: 3 }, videosUpserted: 3 });
  // Nothing armed from an earlier test.
  takePull("");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── The rows ────────────────────────────────────────────────────────────────

describe("Watchlist — the rows", () => {
  it("one card of rows in the read's order, each with its line, and the Follow row last", () => {
    renderChip();
    expect(rowNames()).toEqual(["@jay.makes", "@nia.cooks", "@dev.lifts", "Follow a creator"]);
    expect(rowOf("jay.makes")).toHaveAccessibleDescription("162M followers · 12 proven");
    expect(rowOf("nia.cooks")).toHaveAccessibleDescription("86M followers");
    expect(followRow()).toHaveAccessibleDescription("Paste a @handle");
    expect(rowOf("jay.makes").querySelectorAll('[data-part="covers"] img')).toHaveLength(3);
    // No video grid, no filter on this chip.
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Filter" })).toBeNull();
  });

  it("the search narrows the rows by handle or name as it is typed; the Follow row stays", () => {
    renderChip();
    fireEvent.change(field(), { target: { value: "kitchen" } });
    expect(rowNames()).toEqual(["@nia.cooks", "Follow a creator"]);
    fireEvent.change(field(), { target: { value: "@DEV" } });
    expect(rowNames()).toEqual(["@dev.lifts", "Follow a creator"]);
  });

  it("two rows of one key (the read can repeat one): both shown, each with its own React key", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const twin = source({ key: "kai.wanders", handle: "kai.wanders", name: "kai.wanders" });
    renderChip({ watchlist: { sources: [twin, { ...twin }, NIA], latest: [], incomplete: false } });
    expect(rowNames()).toEqual(["@kai.wanders", "@kai.wanders", "@nia.cooks", "Follow a creator"]);
    expect(errors.mock.calls.filter((call) => /same key/.test(String(call[0])))).toEqual([]);
  });

  it("a search no row holds: No creator matches that., and the Follow row", () => {
    renderChip();
    fireEvent.change(field(), { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No creator matches that.");
    expect(rowNames()).toEqual(["Follow a creator"]);
  });
});

describe("Watchlist — nobody followed", () => {
  it("Nobody on your watchlist yet, Follow a creator (ink), and quietly the library's count", () => {
    renderChip({ watchlist: NOBODY });
    expect(screen.getByText("Nobody on your watchlist yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Watchlist" })).toBeNull();
    const follow = screen.getByRole("button", { name: "Follow a creator" });
    expect(follow.className).toContain("bg-action");
    expect(screen.getByRole("button", { name: "60 proven videos are in the library" })).toBeInTheDocument();
  });

  it("Follow a creator opens the Follow sheet", () => {
    renderChip({ watchlist: NOBODY });
    fireEvent.click(screen.getByRole("button", { name: "Follow a creator" }));
    expect(screen.getByRole("dialog", { name: "Follow a creator" })).toBeInTheDocument();
  });

  it("the quiet button opens Videos, the whole library (no search, no filter)", () => {
    renderChip({ watchlist: NOBODY, href: "/feed?tab=watchlist&niche=food&q=zzz" });
    fireEvent.click(screen.getByRole("button", { name: "60 proven videos are in the library" }));
    expect(window.location.pathname + window.location.search).toBe("/feed");
    expect(within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name: "Videos" })).toHaveAttribute("aria-pressed", "true");
    expect(field()).toHaveValue("");
    expect(within(screen.getByRole("list", { name: "Videos" })).getAllByRole("link")).toHaveLength(24);
  });

  it("the quiet button goes with the chip: the focus goes to the heading", () => {
    renderChip({ watchlist: NOBODY });
    const quiet = screen.getByRole("button", { name: "60 proven videos are in the library" });
    quiet.focus();
    fireEvent.click(quiet);
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toHaveFocus();
  });

  it("the first creator followed: the empty state goes, and the focus goes to the Follow row", () => {
    const { again } = renderChip({ watchlist: NOBODY });
    screen.getByRole("button", { name: "Follow a creator" }).focus();
    again({ ...WATCHLIST, sources: [DEV] });
    expect(followRow()).toHaveFocus();
  });

  it("the library could not be read: no quiet button", () => {
    renderChip({ watchlist: NOBODY, failures: { corpus: true, watchlist: false } });
    expect(screen.getByText("Nobody on your watchlist yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /proven videos? (are|is) in the library/ })).toBeNull();
  });
});

describe("Watchlist — the read failed", () => {
  it("its sentence and Try again, which reads the page again", () => {
    renderChip({ watchlist: NOBODY, failures: { corpus: false, watchlist: true } });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the watchlist.");
    expect(screen.queryByText("Nobody on your watchlist yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a read that could not tell whom the creator follows is the failure too, never the rows it has", () => {
    renderChip({ watchlist: { ...WATCHLIST, incomplete: true } });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the watchlist.");
    expect(screen.queryByRole("list", { name: "Watchlist" })).toBeNull();
  });

  it("once a retry reads it, the rows replace the notice and the focus goes to the first", () => {
    const { again } = renderChip({ watchlist: NOBODY, failures: { corpus: false, watchlist: true } });
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    fireEvent.click(button);
    again(WATCHLIST);
    expect(rowOf("jay.makes")).toHaveFocus();
  });
});

// ─── Remove ──────────────────────────────────────────────────────────────────

describe("Watchlist — Remove clears every record the row rests on", () => {
  beforeEach(() => clock());

  it("a followed-only row: its record, and no competitor link", async () => {
    renderChip();
    removeRow("dev.lifts");
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(untracked()).toEqual(["t-dev"]);
    expect(removeCompetitor).not.toHaveBeenCalled();
  });

  it("a linked-only row: the link, and no followed record", async () => {
    renderChip();
    removeRow("nia.cooks");
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(untracked()).toEqual([]);
    expect(removeCompetitor).toHaveBeenCalledTimes(1);
    expect(removeCompetitor).toHaveBeenCalledWith("p-nia");
  });

  it("a merged row: each followed spelling on every platform, and the link, side by side", async () => {
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    renderChip();
    removeRow("jay.makes");
    // Both records and the link go out before any answer comes back.
    await waitFor(() => expect(untracked()).toEqual(["t-jay-tt", "t-jay-ig"]));
    expect(removeCompetitor).toHaveBeenCalledWith("p-jay");
    expect(router.refresh).not.toHaveBeenCalled();
    held.resolve(json({ success: true }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("the row leaves at once, before any answer", async () => {
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    renderChip();
    removeRow("dev.lifts");
    expect(rowNames()).toEqual(["@jay.makes", "@nia.cooks", "Follow a creator"]);
    held.resolve(json({ success: true }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(rowNames()).toEqual(["@jay.makes", "@nia.cooks", "Follow a creator"]);
  });

  it("a refused record: the row comes back, a toast says so, and the page reads again", async () => {
    onUntrack = async (id) => (id === "t-jay-ig" ? json({ error: "no" }, 500) : json({ success: true }));
    renderChip();
    removeRow("jay.makes");
    expect(rowNames()).not.toContain("@jay.makes");
    expect(await screen.findByText("Couldn't remove @jay.makes.")).toBeInTheDocument();
    expect(rowNames()).toEqual(["@jay.makes", "@nia.cooks", "@dev.lifts", "Follow a creator"]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a link the action refuses (an answer with an error) counts as refused", async () => {
    removeCompetitor.mockResolvedValue({ error: "Failed to remove competitor" });
    renderChip();
    removeRow("nia.cooks");
    expect(await screen.findByText("Couldn't remove @nia.cooks.")).toBeInTheDocument();
    expect(rowNames()).toContain("@nia.cooks");
  });

  it("the focus goes to the row now in its place", async () => {
    renderChip();
    removeRow("jay.makes");
    await settle();
    expect(rowOf("nia.cooks")).toHaveFocus();
  });

  it("the last row's focus goes to the row before", async () => {
    renderChip();
    removeRow("dev.lifts");
    await settle();
    expect(rowOf("nia.cooks")).toHaveFocus();
  });

  it("the only row's focus goes to Follow a creator", async () => {
    renderChip({ watchlist: { ...WATCHLIST, sources: [DEV] } });
    removeRow("dev.lifts");
    await settle();
    expect(screen.getByRole("button", { name: "Follow a creator" })).toHaveFocus();
  });

  it("a row whose removal is still out stays off when the page is read again meanwhile", async () => {
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    const { again } = renderChip();
    removeRow("dev.lifts");
    again({ ...WATCHLIST });
    expect(rowNames()).not.toContain("@dev.lifts");
    held.resolve(json({ success: true }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("once removed, a fresh read decides: a creator followed again shows", async () => {
    const { again } = renderChip();
    removeRow("dev.lifts");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    again({ ...WATCHLIST, sources: [JAY, NIA] });
    expect(rowNames()).not.toContain("@dev.lifts");
    again({ ...WATCHLIST, sources: [JAY, NIA, DEV] });
    expect(rowNames()).toContain("@dev.lifts");
  });
});

// ─── Pull ────────────────────────────────────────────────────────────────────

describe("Watchlist — Pull their best videos", () => {
  it("arms the pull for @handle, then opens the pull page", async () => {
    renderChip();
    fireEvent.click(rowOf("jay.makes"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Pull their best videos · 5 credits" }));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40jay.makes");
    expect(takePull("@jay.makes")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Follow ──────────────────────────────────────────────────────────────────

describe("Watchlist — Follow a creator", () => {
  it("the Follow row opens the sheet with its field focused", () => {
    renderChip();
    fireEvent.click(followRow());
    expect(screen.getByRole("dialog", { name: "Follow a creator" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "TikTok @handle" })).toHaveFocus();
  });

  it("a text it cannot read sends nothing", () => {
    renderChip();
    fireEvent.click(followRow());
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "meal prep" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(screen.getByText("Paste a TikTok @handle or link.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the account, then follows it; while it runs the sheet holds and a second submit sends nothing; done: closed, a toast, the page read again", async () => {
    const held = deferred<Response>();
    onIngest = () => held.promise;
    renderChip();
    fireEvent.click(followRow());
    const input = screen.getByRole("textbox", { name: "TikTok @handle" });
    fireEvent.change(input, { target: { value: "@ari.codes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(within(dialog()).getByRole("status")).toHaveTextContent("Reading @ari.codes");
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    fireEvent.submit(input.closest("form")!);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Follow a creator" })).toBeInTheDocument();
    await waitFor(() => expect(calls("/api/channels/ingest", "POST")).toHaveLength(1));
    await settle();
    expect(calls("/api/channels/ingest", "POST")).toHaveLength(1);
    expect(calls("/api/channels/ingest", "POST")[0]!.body).toEqual({ handle: "ari.codes" });
    held.resolve(
      json({ status: "scraped", handle: "ari.codes", profile: { handle: "ari.codes", displayName: "Ari", avatarUrl: "", followerCount: 9, videoCount: 2 }, videosUpserted: 2 }),
    );
    expect(await screen.findByText("Following @ari.codes")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls("/api/tracked-accounts", "POST").map((c) => c.body)).toEqual([{ platform: "tiktok", handle: "ari.codes" }]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("refused: the sentence in the sheet, no toast, nothing read again", async () => {
    onIngest = async () => json({ message: "not found" }, 404);
    renderChip();
    fireEvent.click(followRow());
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "@ari.codes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't follow @ari.codes. Check the handle and try again.");
    expect(screen.getByRole("dialog", { name: "Follow a creator" })).toBeInTheDocument();
    expect(screen.queryByText("Following @ari.codes")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(calls("/api/tracked-accounts", "POST")).toHaveLength(0);
  });

  it("the account was read but the follow itself refused: the sheet asks to try again, without blaming the handle", async () => {
    onTrack = async () => json({ error: "Failed to track account" }, 500);
    renderChip();
    fireEvent.click(followRow());
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "@ari.codes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't follow @ari.codes. Try again.");
    expect(screen.queryByText(/Check the handle/)).toBeNull();
    expect(calls("/api/channels/ingest", "POST")).toHaveLength(1);
    expect(screen.queryByText("Following @ari.codes")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["reading the account", () => (onIngest = async () => json({ error: "Unauthorized" }, 401))],
    ["following it", () => (onTrack = async () => json({ error: "Unauthorized" }, 401))],
  ])("a lapsed session while %s: the app's session dialog, and no sentence in the sheet", async (_when, lapse) => {
    lapse();
    const raised = vi.fn();
    window.addEventListener("maven:session-expired", raised);
    onTestFinished(() => window.removeEventListener("maven:session-expired", raised));
    renderChip();
    fireEvent.click(followRow());
    const input = screen.getByRole("textbox", { name: "TikTok @handle" });
    fireEvent.change(input, { target: { value: "@ari.codes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(raised).toHaveBeenCalledTimes(1));
    await settle();
    expect(screen.queryByRole("alert")).toBeNull();
    // The sheet stays, ready to send again once signed in.
    expect(input).not.toHaveAttribute("readonly");
    expect(within(dialog()).getByRole("status")).toHaveTextContent("");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a creator already followed: the add is the same, so the sheet closes with Following and the page is read again", async () => {
    onIngest = async (handle) =>
      json({ status: "cached", handle, profile: { handle, displayName: "Jay Makes", avatarUrl: "", followerCount: 9, videoCount: 2 }, videosUpserted: 0 });
    renderChip();
    fireEvent.click(followRow());
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "@jay.makes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(await screen.findByText("Following @jay.makes")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(rowNames()).toEqual(["@jay.makes", "@nia.cooks", "@dev.lifts", "Follow a creator"]);
  });

  it("the chip leaves before the answer (Back while Maven reads): the toast and the read again still happen", async () => {
    const held = deferred<Response>();
    onIngest = () => held.promise;
    renderChip();
    fireEvent.click(followRow());
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "@ari.codes" } });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(calls("/api/channels/ingest", "POST")).toHaveLength(1));
    // An address the screen did not write: the hub follows it, and the Watchlist chip (sheet and all) goes.
    act(() => setAddress("/feed"));
    expect(screen.queryByRole("list", { name: "Watchlist" })).toBeNull();
    held.resolve(
      json({ status: "scraped", handle: "ari.codes", profile: { handle: "ari.codes", displayName: "Ari", avatarUrl: "", followerCount: 9, videoCount: 2 }, videosUpserted: 2 }),
    );
    expect(await screen.findByText("Following @ari.codes")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
