/** @vitest-environment happy-dom */

/**
 * LibraryNext — Library with its data (plan 2026-11-23-library; spec §3, §5): the real screen, the
 * real `useLibraryChats`, `useSavedItems` and `useThreadList` through TanStack Query, the real thread
 * actions (the active-thread cookie, the board store, the shell store) and the app's real toasts.
 * Stand-ins only at the edges: `fetch` (the endpoint, answered page by page; the saved list and its
 * remove request; the sidebar's short list; a chat's rename, pin and delete), the router,
 * `matchMedia`, the build-time flag (on: this is the new look), and the clock for the search's
 * 250 ms.
 *
 * The QueryClient is the app's (`providers.tsx`: a minute fresh, no refetch on focus) without
 * retries, so a refused request is an error at once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { ThreadSummary } from "@/hooks/queries/use-threads";
import type { LibraryChat, LibraryPage, LibrarySim, LibrarySummary } from "@/lib/library/library-page";
import type { LibraryView } from "@/lib/library/library-view";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { THREAD_TITLE_MAX } from "@/lib/threads/title";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

// One object, as the real App Router returns.
const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };

/**
 * The address's parameters as Next keeps them: `useSearchParams` follows a navigation and the
 * native History API (Next patches `replaceState`). A stand-in for the router, so a test can move
 * the address from outside (a tab, a link, Back) and see what the screen writes.
 */
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
    usePathname: () => "/library",
    useRouter: () => router,
    useSearchParams: () => {
      const search = useSyncExternalStore(nav.subscribe, nav.search, nav.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

import { LibraryNext, LibraryNextLoading, withPin } from "../library-next";
import { libraryKeys } from "@/hooks/queries/use-library";
import { DEFAULT_LIBRARY_VIEW, libraryHref } from "@/lib/library/library-view";

/** The browser's own `replaceState`, before each test's spy wraps it. */
const nativeReplaceState = window.history.replaceState.bind(window.history);
/** The address moved without the screen: the browser's, and what `useSearchParams` reads. */
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
}
/** A navigation the screen did not make (the Library tab, the sidebar's link, Back, Forward). */
const navigate = (href: string) => act(() => setAddress(href));
/** The screen's own writes to the address. */
const addressWrites = () => vi.mocked(window.history.replaceState);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const NONE: LibrarySummary["counts"] = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

type Over = Partial<Omit<LibraryChat, "summary">> & { summary?: Partial<LibrarySummary> };
function chat(id: string, over: Over = {}): LibraryChat {
  const { summary, ...rest } = over;
  return {
    id,
    title: `Chat ${id}`,
    updatedAt: ago(3),
    pinned: false,
    ...rest,
    summary: { counts: NONE, lead: "chat", stage: "chat", sim: null, frame: null, videoPath: null, posted: null, ...summary },
  };
}

const textSim = (id: string, number: number, as: "hook" | "idea" | "opening" = "hook", hours = 2): LibrarySim => ({
  number,
  measure: "stop",
  at: ago(hours),
  kind: as === "idea" ? "ideas" : as === "opening" ? "script" : "hooks",
  link: { type: "text", key: `key-${id}`, as },
});

const simulated = (id: string, title = `Simulated ${id}`) =>
  chat(id, { title, summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim(id, 60) } });
const draft = (id: string, title = `Draft ${id}`) =>
  chat(id, { title, updatedAt: ago(24), summary: { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "draft" } });
const plain = (id: string, title = `Plain ${id}`) => chat(id, { title });

/** A page of `sims` simulated chats and `plains` plain ones; ids carry the page number. */
const mixed = (n: number, sims: number, plains = 30 - sims) => [
  ...Array.from({ length: sims }, (_, i) => simulated(`p${n}-s${i}`)),
  ...Array.from({ length: plains }, (_, i) => plain(`p${n}-c${i}`)),
];

// ─── The server ──────────────────────────────────────────────────────────────

/** One search's pages, by the cursor that asks for each ("" for the first). */
type Book = Record<string, LibraryPage | number | (() => Promise<LibraryPage | number>)>;

/** A book of `pages` in order: page n's `next` is the cursor of page n + 1, the last one's null. */
function bookOf(pages: LibraryChat[][], lastNext: string | null = null): Book {
  const book: Book = {};
  pages.forEach((chats, i) => {
    book[i === 0 ? "" : `cursor-${i}`] = { chats, next: i < pages.length - 1 ? `cursor-${i + 1}` : lastNext };
  });
  return book;
}

let books: Record<string, Book> = {};

/** The saved list `/api/saved` answers (or its status), and how it answers a remove. */
let savedList: SavedItem[] | number | (() => Promise<SavedItem[] | number>) = [];
let onDelete: (id: string) => number | Promise<number> = () => 200;
/** The sidebar's short list of chats (`/api/threads/list`). */
let threadList: ThreadSummary[] = [];
/** How `/api/threads/{id}` answers a rename or a pin (PATCH) and a delete (DELETE): a status. */
let onThread: (method: "PATCH" | "DELETE", id: string, body: unknown) => number | Promise<number> = () => 200;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === "/api/saved") {
    if (method === "DELETE") {
      const status = await onDelete(url.searchParams.get("id") ?? "");
      return status === 200 ? json({ success: true }) : json({}, status);
    }
    const list = typeof savedList === "function" ? await savedList() : savedList;
    return typeof list === "number" ? json({}, list) : json({ items: list });
  }
  const thread = /^\/api\/threads\/([^/]+)$/.exec(url.pathname);
  if (thread && (method === "PATCH" || method === "DELETE")) {
    const id = thread[1]!;
    const status = await onThread(method, id, init?.body ? JSON.parse(String(init.body)) : undefined);
    if (status !== 200) return json({ error: "Thread not found" }, status);
    return json(method === "DELETE" ? { threadId: id } : { ok: true });
  }
  if (url.pathname === "/api/threads/list") return json({ threads: threadList });
  if (url.pathname !== "/api/threads/library") return new Response("{}", { status: 404 });
  const entry = books[url.searchParams.get("q") ?? ""]?.[url.searchParams.get("cursor") ?? ""];
  const answer = typeof entry === "function" ? await entry() : entry;
  if (answer === undefined) return new Response("{}", { status: 404 });
  if (typeof answer === "number") return new Response("{}", { status: answer });
  return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
});

const urls = () => fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
const libraryCalls = () => urls().filter((url) => url.pathname === "/api/threads/library");
/** Every request to `/api/saved`: its method, the id a remove names, any body it carries, and
 *  whether it is kept alive past a navigation. */
const savedCalls = () =>
  fetchMock.mock.calls
    .filter(([input]) => new URL(String(input), "http://localhost").pathname === "/api/saved")
    .map(([input, init]) => ({
      method: init?.method ?? "GET",
      id: new URL(String(input), "http://localhost").searchParams.get("id"),
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
      keepalive: init?.keepalive,
    }));
const deletes = () => savedCalls().filter((call) => call.method === "DELETE");
const threadListCalls = () => urls().filter((url) => url.pathname === "/api/threads/list");
/** Every rename, pin and delete sent to `/api/threads/{id}`: its method, its address, its body. */
const threadCalls = () =>
  fetchMock.mock.calls
    .map(([input, init]) => ({ path: new URL(String(input), "http://localhost").pathname, init }))
    .filter(({ path, init }) => /^\/api\/threads\/[^/]+$/.test(path) && (init?.method === "PATCH" || init?.method === "DELETE"))
    .map(({ path, init }) => ({ method: init!.method, path, body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined }));

// ─── Saved pieces ────────────────────────────────────────────────────────────

/** A saved row as `GET /api/saved` returns it (`select *`); a piece of a chat by default. */
function piece(id: string, type: SavedItemType, over: Partial<SavedItem> = {}): SavedItem {
  return { id, user_id: "u-1", item_type: type, ref_id: `m-${id}:0`, thread_id: null, project_id: null, title: null, snapshot: {}, created_at: ago(1), ...over };
}

const HOOK_TEXT = "Stop scrolling if you lift at 5am";
const IDEA_TEXT = "A week of meal prep in one hour";
const SCRIPT_TEXT = "I quit sugar for a month and this happened";
const VIDEO_TEXT = "There's a wave of $100,000 challenges";

/** The chats the hook and the idea were saved from, on the first page. */
const SAVED_FROM = [simulated("c-gym", "Gym hooks"), draft("c-meal", "Meal ideas")];

/** Newest first, as the server orders them: a hook and an idea from loaded chats, a script from a
 *  chat not loaded, and a video saved in Discover (no chat). */
const PIECES: SavedItem[] = [
  piece("sv-hook", "hook", {
    thread_id: "c-gym",
    title: HOOK_TEXT,
    snapshot: { hookLine: HOOK_TEXT, band: "Strong", fraction: "8/10", mechanism: "A time and a place" },
    created_at: ago(1),
  }),
  piece("sv-idea", "idea", {
    thread_id: "c-meal",
    title: IDEA_TEXT,
    snapshot: { title: IDEA_TEXT, angle: "Batch it on Sunday", whyItFits: "Students cook once" },
    created_at: ago(5),
  }),
  piece("sv-script", "script", {
    thread_id: "c-far",
    snapshot: { openingBeatSeed: SCRIPT_TEXT, beats: [{ content: SCRIPT_TEXT, seconds: 4 }] },
    created_at: ago(30),
  }),
  piece("sv-video", "outlier", {
    ref_id: "pv-1",
    title: VIDEO_TEXT,
    snapshot: { caption: VIDEO_TEXT, videoUrl: "https://videos.example/nia.tests/1", views: 120_000, multiplier: 14 },
    created_at: ago(72),
  }),
];

const savedListEl = () => screen.getByRole("list", { name: "Saved" });
/** The saved rows' own texts, top to bottom. */
const savedTexts = () =>
  within(savedListEl())
    .getAllByRole("listitem")
    .map((li) => li.querySelector('[id$="-text"]')?.textContent);
/** The "Remove from saved" of the row that shows `text`. */
const removeOf = (text: string) =>
  screen.getAllByRole("button", { name: "Remove from saved" }).find((button) => button.closest("li")?.textContent?.includes(text))!;
const address = () => window.location.pathname + window.location.search;

/** A request the test answers by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Lets every request the screen would make on its own go out and come back. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 80)));

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;

/** Library as the page renders it, opened on the address of `view` (All and no search by default). */
function renderLibrary(view: LibraryView = DEFAULT_LIBRARY_VIEW, container?: HTMLElement) {
  setAddress(libraryHref(view));
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryNext />
      </ToastProvider>
    </QueryClientProvider>,
    container ? { container } : undefined,
  );
}

const chatList = () => screen.getByRole("list", { name: "Chats" });
/** The rows' titles, top to bottom: each row's open button (its More is another control). */
const rowTitles = () =>
  within(chatList())
    .queryAllByRole("button")
    .filter((button) => button.parentElement?.tagName === "LI")
    .map((button) => button.getAttribute("aria-labelledby"))
    .map((id) => document.getElementById(id!.split(" ")[0]!)!.textContent);
const chip = (name: string) => screen.getByRole("button", { name });
const showMore = () => screen.queryByRole("button", { name: "Show more" });
const searchField = () => screen.getByRole("textbox", { name: "Search" });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false } } });
  books = {};
  savedList = [];
  onDelete = () => 200;
  threadList = [];
  onThread = () => 200;
  setAddress("/library");
  // Next keeps `useSearchParams` in step with the History API: a write moves both.
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplaceState(data, unused, url);
    if (url != null) nav.set(new URL(String(url), "http://localhost").search);
  });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // A phone: the search hands its focus back to its button when cleared.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  router.push.mockReset();
  router.replace.mockReset();
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  useShellStore.setState({ threadOpen: false, threadBack: null, threadTitleHint: null, libraryScroll: null });
});

afterEach(() => {
  // Nothing on this screen spends credits (spec §5): no request to a paid route, in any test.
  const paid = urls().filter((url) => url.pathname.startsWith("/api/tools/") || url.pathname.startsWith("/api/analyze"));
  expect(paid.map(String)).toEqual([]);
  // An Undo sends nothing, so this screen never saves anything.
  expect(savedCalls().filter((call) => call.method === "POST")).toEqual([]);
  cleanup();
  vi.useRealTimers();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── The route's loading file ────────────────────────────────────────────────

describe("LibraryNextLoading", () => {
  it("is the screen's own loading state (header, chips, six quiet rows) and asks for nothing", () => {
    render(<LibraryNextLoading />);
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(chatList()).toHaveAttribute("aria-busy", "true");
    expect(chatList().querySelectorAll("[data-part=placeholder]")).toHaveLength(6);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── The drawer's opener ─────────────────────────────────────────────────────

describe("LibraryNext — the drawer's opener on the phone", () => {
  // The face the drawer's frame publishes (the shell mounts it; here it is set as it would be).
  beforeEach(() => useShellStore.setState({ drawerOpen: false, accountFace: { picture: null, initials: "NL" } }));
  afterEach(() => useShellStore.setState({ drawerOpen: false, accountFace: null }));

  /** The header's row holds the opener's slot first, then the h1. */
  function expectOpenerBeforeHeading() {
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    const slot = opener.closest<HTMLElement>('[data-part="opener"]')!;
    expect(slot).toHaveClass("md:hidden");
    expect(slot).not.toHaveClass("hidden");
    expect(slot.parentElement!.tagName).toBe("HEADER");
    expect(slot.parentElement!.firstElementChild).toBe(slot);
    expect(slot.nextElementSibling).toBe(screen.getByRole("heading", { level: 1, name: "Library" }));
    return opener;
  }

  it("Library carries the opener", async () => {
    books = { "": bookOf([[plain("c1", "Just talking")]]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Just talking" });
    const opener = expectOpenerBeforeHeading();
    fireEvent.click(opener);
    expect(useShellStore.getState().drawerOpen).toBe(true);
    await settle();
    // The opener reads the shell's store only: Library's one read, and nothing else.
    expect(urls().map((url) => url.pathname)).toEqual(["/api/threads/library"]);
    // It opens no chat and goes nowhere.
    expect(router.push).not.toHaveBeenCalled();
    expect(useBoardStore.getState().activeThreadId).toBeNull();
  });

  it("LibraryNextLoading draws the opener too", () => {
    render(<LibraryNextLoading />);
    expectOpenerBeforeHeading();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── 1. The first page ───────────────────────────────────────────────────────

describe("LibraryNext — the first page", () => {
  const FIRST: LibraryChat[] = [
    chat("c-a", {
      title: "Hook formats, the $400 test",
      pinned: true,
      summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim("c-a", 66) },
    }),
    chat("c-b", { title: "Morning routine, no cuts", updatedAt: ago(24), summary: { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "draft" } }),
    chat("c-c", {
      title: null,
      summary: {
        counts: { ...NONE, videos: 1 },
        lead: "video",
        stage: "simulated",
        sim: { number: 38, measure: "end", at: ago(5), kind: "video", link: { type: "video", analysisId: "run-c" } },
        frame: "https://frames.example/c-c.jpg",
      },
    }),
    chat("c-d", { title: "Why the last one flopped", updatedAt: ago(72) }),
  ];

  it("while the page loads the screen is loading: six quiet rows, busy", async () => {
    const answer = deferred<LibraryPage>();
    books = { "": { "": () => answer.promise } };
    renderLibrary();

    const list = chatList();
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(list.querySelectorAll("[data-part=placeholder]")).toHaveLength(6);

    await act(async () => answer.resolve({ chats: FIRST, next: null }));
    await waitFor(() => expect(chatList()).not.toHaveAttribute("aria-busy"));
  });

  it("renders the chats as rows: title, the line of what is inside and when, the stage, the tile", async () => {
    books = { "": bookOf([FIRST]) };
    renderLibrary();

    const hooks = await screen.findByRole("button", { name: "Hook formats, the $400 test" });
    expect(hooks).toHaveAccessibleDescription("Pinned, 3 hooks · simulated 2h ago");
    expect(within(hooks).getByText("Simulated")).toBeInTheDocument();

    const script = screen.getByRole("button", { name: "Morning routine, no cuts" });
    expect(script).toHaveAccessibleDescription("Script · 1d ago");
    expect(within(script).getByText("Draft")).toBeInTheDocument();

    // An untitled chat that holds a video is named for it; its tile is the stored frame.
    const video = screen.getByRole("button", { name: "Video simulation" });
    expect(video).toHaveAccessibleDescription("Video · simulated 5h ago");
    expect(video.querySelector("img")).toHaveAttribute("src", "https://frames.example/c-c.jpg");

    const talk = screen.getByRole("button", { name: "Why the last one flopped" });
    expect(talk).toHaveAccessibleDescription("Chat · 3d ago");
    expect(talk.querySelector("[data-part=stage]")).toBeEmptyDOMElement();
    expect(talk.querySelector("[data-part=mark]")).toHaveAttribute("data-kind", "chat");

    // In the endpoint's order, newest message first.
    expect(rowTitles()).toEqual(["Hook formats, the $400 test", "Morning routine, no cuts", "Video simulation", "Why the last one flopped"]);
    // Only the simulated chats carry a gauge.
    expect(screen.getAllByRole("link", { name: /^Open the result: / })).toHaveLength(2);
    // One page, no next: nothing more to show.
    expect(showMore()).toBeNull();
  });

  it("a cap-long title is shown as the headers and Home show it, cut at a word", async () => {
    // Stored titles are cut at the cap, often inside a word ("…morning r").
    const stored = "Three hooks for the gym video about my morning routine".slice(0, THREAD_TITLE_MAX);
    expect(stored).toBe("Three hooks for the gym video about my morning r");
    books = { "": bookOf([[chat("c-l", { title: stored })]]) };
    renderLibrary();
    expect(await screen.findByRole("button", { name: "Three hooks for the gym video about my morning…" })).toBeInTheDocument();
  });

  it("a failed request shows the failure; Try again asks again and the rows come", async () => {
    let fail = true;
    books = { "": { "": async () => (fail ? 500 : { chats: FIRST, next: null }) } };
    renderLibrary();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your library.");
    expect(libraryCalls()).toHaveLength(1);

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Hook formats, the $400 test" })).toBeInTheDocument();
    expect(libraryCalls()).toHaveLength(2);
  });

  // The screen must not sit on the failure with no sign of work while the
  // retry is out (the app's client retries three times). The query is pending again then, not in
  // error: with no data, TanStack clears the error when a fetch starts. This pins what the creator
  // sees either way.
  it("while Try again is out the screen is loading, not the failure", async () => {
    const retry = deferred<LibraryPage>();
    let calls = 0;
    books = { "": { "": () => (++calls === 1 ? Promise.resolve(500) : retry.promise) } };
    renderLibrary();

    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(chatList()).toHaveAttribute("aria-busy", "true");
    expect(chatList().querySelectorAll("[data-part=placeholder]")).toHaveLength(6);

    await act(async () => retry.resolve({ chats: FIRST, next: null }));
    expect(await screen.findByRole("button", { name: "Hook formats, the $400 test" })).toBeInTheDocument();
  });
});

// ─── 2. The chips ────────────────────────────────────────────────────────────

describe("LibraryNext — the chips filter what is loaded", () => {
  const PAGE = [simulated("s1", "Gym hooks"), draft("d1", "Morning script"), plain("c1", "Just talking"), draft("d2", "Ideas for next week"), simulated("s2", "Meal prep")];

  it("All lists every chat; Drafts only drafts; Simulated only simulated; a plain chat only under All", async () => {
    books = { "": bookOf([PAGE]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Gym hooks", "Morning script", "Just talking", "Ideas for next week", "Meal prep"]);

    fireEvent.click(chip("Drafts"));
    expect(chip("Drafts")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Morning script", "Ideas for next week"]);

    fireEvent.click(chip("Simulated"));
    expect(rowTitles()).toEqual(["Gym hooks", "Meal prep"]);

    fireEvent.click(chip("All"));
    expect(rowTitles()).toContain("Just talking");
    // Filtering is on what is loaded: no request of its own once everything is in.
    expect(libraryCalls()).toHaveLength(1);
  });

  it("a filter with nothing says so", async () => {
    books = { "": bookOf([[plain("c1", "Just talking")]]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Just talking" });

    fireEvent.click(chip("Drafts"));
    expect(screen.getByText("No drafts.")).toBeInTheDocument();
    fireEvent.click(chip("Simulated"));
    expect(screen.getByText("Nothing simulated yet.")).toBeInTheDocument();
  });

  it("Saved with nothing saved says how to save something", async () => {
    books = { "": bookOf([PAGE]) };
    savedList = [];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    fireEvent.click(chip("Saved"));
    expect(await screen.findByText("Nothing saved yet. Save a hook or an idea from its details.")).toBeInTheDocument();
    // Read from the saved list: one request, a free read.
    expect(savedCalls()).toEqual([{ method: "GET", id: null, body: undefined }]);
  });
});

// ─── 3. Loading older pages on its own ───────────────────────────────────────

describe("LibraryNext — older pages, on their own and with Show more", () => {
  it("Simulated with fewer than 12 matches asks for older pages without a tap, four at most; then Show more asks for one", async () => {
    // Two matches a page, as on real data (twelve simulated chats spread over nine pages).
    books = { "": bookOf(Array.from({ length: 9 }, (_, n) => mixed(n + 1, 2))) };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated p1-s0" });
    await settle();
    // All has a screenful: nothing more on its own.
    expect(libraryCalls()).toHaveLength(1);

    fireEvent.click(chip("Simulated"));
    await waitFor(() => expect(libraryCalls()).toHaveLength(5));
    await settle();
    expect(libraryCalls()).toHaveLength(5);
    expect(rowTitles()).toHaveLength(10);
    // Each one went on from the page before.
    expect(libraryCalls().map((url) => url.searchParams.get("cursor"))).toEqual([null, "cursor-1", "cursor-2", "cursor-3", "cursor-4"]);

    const more = showMore()!;
    expect(more).not.toHaveAttribute("aria-disabled");
    fireEvent.click(more);
    await waitFor(() => expect(rowTitles()).toHaveLength(12));
    await settle();
    expect(libraryCalls()).toHaveLength(6);
    expect(showMore()).not.toBeNull();
  });

  it("a tap that brings a match stops there, even under twelve", async () => {
    books = { "": bookOf(Array.from({ length: 9 }, (_, n) => mixed(n + 1, 1))) };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated p1-s0" });
    fireEvent.click(chip("Simulated"));
    await waitFor(() => expect(libraryCalls()).toHaveLength(5));
    await settle();
    expect(rowTitles()).toHaveLength(5);

    fireEvent.click(showMore()!);
    await waitFor(() => expect(rowTitles()).toHaveLength(6));
    await settle();
    expect(libraryCalls()).toHaveLength(6);
  });

  it("a tap that brings no match keeps going by the same rule: up to twelve, four requests at most", async () => {
    const pages = [...Array.from({ length: 5 }, (_, n) => mixed(n + 1, 2)), mixed(6, 0), mixed(7, 1), mixed(8, 1), mixed(9, 1), mixed(10, 1)];
    books = { "": bookOf(pages) };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated p1-s0" });
    fireEvent.click(chip("Simulated"));
    await waitFor(() => expect(libraryCalls()).toHaveLength(5));
    await settle();

    fireEvent.click(showMore()!);
    // Page 6 brings none; pages 7 and 8 bring one each, and twelve is a screenful.
    await waitFor(() => expect(rowTitles()).toHaveLength(12));
    await settle();
    expect(libraryCalls()).toHaveLength(8);
  });

  it("with no match at all in the burst: no empty line while older pages exist, only Show more", async () => {
    books = { "": bookOf(Array.from({ length: 12 }, (_, n) => mixed(n + 1, 0))) };
    renderLibrary();
    await screen.findByRole("button", { name: "Plain p1-c0" });
    fireEvent.click(chip("Simulated"));
    await waitFor(() => expect(libraryCalls()).toHaveLength(5));
    await settle();

    expect(screen.queryByText("Nothing simulated yet.")).toBeNull();
    expect(showMore()).not.toBeNull();

    // The tap brings none: four more on their own (the tap's page and four), then Show more again.
    fireEvent.click(showMore()!);
    await waitFor(() => expect(libraryCalls()).toHaveLength(10));
    await settle();
    expect(libraryCalls()).toHaveLength(10);
    expect(screen.queryByText("Nothing simulated yet.")).toBeNull();
    expect(showMore()).not.toBeNull();
  });

  it("All with a full first page asks for nothing on its own", async () => {
    books = { "": bookOf([mixed(1, 0), mixed(2, 0)]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Plain p1-c0" });
    await settle();
    expect(libraryCalls()).toHaveLength(1);
    expect(showMore()).not.toBeNull();
  });

  it("All with short pages (empty chats left out on the server) keeps going, and is never empty while a next exists", async () => {
    const second = deferred<LibraryPage>();
    books = {
      "": {
        "": { chats: [], next: "cursor-1" },
        "cursor-1": () => second.promise,
        "cursor-2": { chats: mixed(3, 0), next: "cursor-3" },
        "cursor-3": { chats: mixed(4, 0), next: null },
      },
    };
    renderLibrary();
    await waitFor(() => expect(libraryCalls()).toHaveLength(2));
    // No row yet, but older pages exist: still loading, not "Nothing here yet."
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(chatList()).toHaveAttribute("aria-busy", "true");

    await act(async () => second.resolve({ chats: [plain("p2-c0"), plain("p2-c1"), plain("p2-c2")], next: "cursor-2" }));
    // Three rows: fewer than twelve, so on to the third page; thirty-three is a screenful.
    await waitFor(() => expect(rowTitles()).toHaveLength(33));
    await settle();
    expect(libraryCalls()).toHaveLength(3);
  });

  it("\"Nothing here yet.\" only with no chats and no older page", async () => {
    books = { "": bookOf([[], []]) };
    renderLibrary();
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(libraryCalls()).toHaveLength(2);
    expect(showMore()).toBeNull();
  });

  it("a page that fails stops the loading on its own; Show more asks for it again", async () => {
    let fail = true;
    const pages = bookOf(Array.from({ length: 6 }, (_, n) => mixed(n + 1, 2)));
    const second = pages["cursor-1"] as LibraryPage;
    pages["cursor-1"] = async () => (fail ? 500 : second);
    books = { "": pages };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated p1-s0" });

    fireEvent.click(chip("Simulated"));
    await waitFor(() => expect(libraryCalls()).toHaveLength(2));
    await settle();
    expect(libraryCalls()).toHaveLength(2);
    // The rows that came stay; no failure in place of them.
    expect(rowTitles()).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();

    fail = false;
    fireEvent.click(showMore()!);
    await waitFor(() => expect(rowTitles()).toHaveLength(4));
    await settle();
    expect(libraryCalls()).toHaveLength(3);
  });

  // The failed older page says so, quietly; Show more tries again.
  it('a failed older page says "Couldn\'t load more." above Show more, until a retry brings it', async () => {
    let fail = true;
    const pages = bookOf(Array.from({ length: 6 }, (_, n) => mixed(n + 1, 2)));
    const second = pages["cursor-1"] as LibraryPage;
    pages["cursor-1"] = async () => (fail ? 500 : second);
    books = { "": pages };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated p1-s0" });
    expect(screen.queryByText("Couldn't load more.")).toBeNull();

    fireEvent.click(chip("Simulated"));
    expect(await screen.findByText("Couldn't load more.")).toHaveAttribute("role", "status");
    expect(showMore()).not.toBeNull();

    fail = false;
    fireEvent.click(showMore()!);
    await waitFor(() => expect(rowTitles()).toHaveLength(4));
    expect(screen.queryByText("Couldn't load more.")).toBeNull();
  });

  it("with no row for the chip, the failed page's line stands with Show more (no empty line)", async () => {
    const pages = bookOf(Array.from({ length: 4 }, (_, n) => mixed(n + 1, 0)));
    pages["cursor-1"] = 500;
    books = { "": pages };
    renderLibrary();
    await screen.findByRole("button", { name: "Plain p1-c0" });

    fireEvent.click(chip("Simulated"));
    expect(await screen.findByText("Couldn't load more.")).toBeInTheDocument();
    expect(showMore()).not.toBeNull();
    expect(screen.queryByText("Nothing simulated yet.")).toBeNull();
  });
});

// ─── The view in the address, and the scroll ──────────

describe("LibraryNext — its chip and search live in the address", () => {
  const ALL = [plain("c1", "Meal prep for students"), draft("d1", "Meal plan script"), simulated("s1", "Gym hooks"), simulated("s2", "Meal hooks")];
  const MEAL = [plain("c1", "Meal prep for students"), draft("d1", "Meal plan script"), simulated("s2", "Meal hooks")];

  // Written with the History API, so no server render of the page goes out, and the
  // address is what the screen shows (`useSearchParams`), not a copy of it.
  it("a chip tap and a settled search are written with history.replaceState, never the router; nothing on the first render", async () => {
    books = { "": bookOf([ALL]), meal: bookOf([MEAL]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    expect(addressWrites()).not.toHaveBeenCalled();

    fireEvent.click(chip("Simulated"));
    expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library?filter=simulated");
    expect(address()).toBe("/library?filter=simulated");
    expect(chip("Simulated")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(searchField(), { target: { value: "meal" } });
    // Not while it is typed: the search's address comes with its request.
    expect(addressWrites()).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library?filter=simulated&q=meal"));
    await waitFor(() => expect(libraryCalls().at(-1)!.searchParams.get("q")).toBe("meal"));
    expect(searchField()).toHaveValue("meal");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library?filter=simulated");

    fireEvent.click(chip("All"));
    expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library");
    expect(addressWrites()).toHaveBeenCalledTimes(4);
    expect(address()).toBe("/library");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opened on ?filter=simulated&q=meal: that chip, that text, and the server is asked for q=meal", async () => {
    books = { "": bookOf([ALL]), meal: bookOf([MEAL]) };
    renderLibrary({ filter: "simulated", q: "meal" });

    expect(chip("Simulated")).toHaveAttribute("aria-pressed", "true");
    expect(searchField()).toHaveValue("meal");
    await waitFor(() => expect(rowTitles()).toEqual(["Meal hooks"]));
    expect(libraryCalls()).toHaveLength(1);
    expect(libraryCalls()[0]!.searchParams.get("q")).toBe("meal");
    // It reads the address; it does not write it back.
    expect(addressWrites()).not.toHaveBeenCalled();
  });

  it("a navigation to /library from ?filter=simulated&q=meal (the Library tab, the sidebar's link) puts the chip on All and empties the field; it writes nothing", async () => {
    books = { "": bookOf([ALL]), meal: bookOf([MEAL]) };
    renderLibrary({ filter: "simulated", q: "meal" });
    await waitFor(() => expect(rowTitles()).toEqual(["Meal hooks"]));

    navigate("/library");
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(searchField()).toHaveValue("");
    await waitFor(() => expect(rowTitles()).toEqual(["Meal prep for students", "Meal plan script", "Gym hooks", "Meal hooks"]));
    await settle();
    expect(addressWrites()).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("a navigation to ?filter=drafts&q=meal (Back, Forward) selects Drafts, shows \"meal\" and asks the server for q=meal", async () => {
    books = { "": bookOf([ALL]), meal: bookOf([MEAL]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    navigate("/library?filter=drafts&q=meal");
    expect(chip("Drafts")).toHaveAttribute("aria-pressed", "true");
    expect(searchField()).toHaveValue("meal");
    await waitFor(() => expect(rowTitles()).toEqual(["Meal plan script"]));
    expect(libraryCalls().at(-1)!.searchParams.get("q")).toBe("meal");
    await settle();
    expect(addressWrites()).not.toHaveBeenCalled();
  });

  it("a navigation from outside starts the loading on its own over, as a chip tap does", async () => {
    // Two simulated chats a page, no draft: Simulated fills four pages more on its own, then stops.
    books = { "": bookOf(Array.from({ length: 12 }, (_, n) => mixed(n + 1, 2))) };
    renderLibrary({ filter: "simulated", q: "" });
    await waitFor(() => expect(libraryCalls()).toHaveLength(5));
    await settle();
    expect(libraryCalls()).toHaveLength(5);

    // Drafts has none: four pages more come on their own, from where the loading stood.
    navigate("/library?filter=drafts");
    await waitFor(() => expect(libraryCalls()).toHaveLength(9));
    await settle();
    expect(libraryCalls()).toHaveLength(9);
    expect(addressWrites()).not.toHaveBeenCalled();
  });
});

describe("LibraryNext — coming back to it puts the scroll back", () => {
  /** The shell's scrolling element: Library renders inside <main>, which stays across routes. */
  let main: HTMLElement;
  beforeEach(() => {
    main = document.body.appendChild(document.createElement("main"));
  });
  afterEach(() => {
    main.remove();
  });
  /** A page's place in <main>: a new one for each visit (React cannot reuse an unmounted root). */
  const visit = () => main.appendChild(document.createElement("div"));

  /** Library scrolled down, then a row opened (its chat), then Library gone (the route changed). */
  async function leaveFromRow(view?: LibraryView) {
    books = { "": bookOf([mixed(1, 2), mixed(2, 2)]) };
    const first = renderLibrary(view, visit());
    await screen.findByRole("button", { name: view?.filter === "simulated" ? "Simulated p1-s0" : "Plain p1-c0" });
    main.scrollTop = 640;
    fireEvent.click(screen.getByRole("button", { name: "Simulated p1-s1" }));
    expect(useShellStore.getState().threadBack).toBe("/library");
    first.unmount();
    main.scrollTop = 0;
  }

  it("the same address with its rows still cached: the scroll as it was left, once", async () => {
    await leaveFromRow({ filter: "simulated", q: "" });
    const again = renderLibrary({ filter: "simulated", q: "" }, visit());
    expect(main.scrollTop).toBe(640);

    // Used: another return does not put it back again.
    again.unmount();
    main.scrollTop = 0;
    renderLibrary({ filter: "simulated", q: "" }, visit());
    expect(main.scrollTop).toBe(0);
  });

  it("another address: not put back (and not kept for later)", async () => {
    await leaveFromRow({ filter: "simulated", q: "" });
    const other = renderLibrary({ filter: "drafts", q: "" }, visit());
    expect(main.scrollTop).toBe(0);

    other.unmount();
    renderLibrary({ filter: "simulated", q: "" }, visit());
    expect(main.scrollTop).toBe(0);
  });

  // What was remembered goes when the address moves from outside, as with a chip tap.
  it("an address change from outside after a row was opened drops what was remembered", async () => {
    books = { "": bookOf([mixed(1, 2), mixed(2, 2)]) };
    const first = renderLibrary({ filter: "simulated", q: "" }, visit());
    await screen.findByRole("button", { name: "Simulated p1-s0" });
    main.scrollTop = 640;
    fireEvent.click(screen.getByRole("button", { name: "Simulated p1-s1" }));
    // Still on screen (the chat is on its way) when the address moves from outside, and back.
    navigate("/library?filter=drafts");
    navigate("/library?filter=simulated");
    first.unmount();
    main.scrollTop = 0;

    renderLibrary({ filter: "simulated", q: "" }, visit());
    expect(main.scrollTop).toBe(0);
  });

  it("a saved piece's chat opened under Saved: back on ?filter=saved, the scroll as it was left", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    const first = renderLibrary({ filter: "saved", q: "" }, visit());
    const hook = await screen.findByRole("button", { name: HOOK_TEXT });
    main.scrollTop = 320;
    fireEvent.click(hook);
    expect(useShellStore.getState().threadBack).toBe("/library");
    first.unmount();
    main.scrollTop = 0;

    renderLibrary({ filter: "saved", q: "" }, visit());
    expect(main.scrollTop).toBe(320);
  });

  it("the rows no longer cached: not put back (the list loads from the top)", async () => {
    await leaveFromRow();
    client.clear();
    renderLibrary(undefined, visit());
    expect(main.scrollTop).toBe(0);
    await screen.findByRole("button", { name: "Plain p1-c0" });
    expect(main.scrollTop).toBe(0);
  });
});

// ─── 4. Search ───────────────────────────────────────────────────────────────

describe("LibraryNext — search asks the server", () => {
  const ALL = [plain("c1", "Meal prep for students"), draft("d1", "Meal plan script"), simulated("s1", "Gym hooks")];
  const MEAL = [draft("d1", "Meal plan script"), plain("c1", "Meal prep for students"), plain("c9", "An old meal idea")];

  it("one request 250 ms after the last key, with q; the chip applies to its rows; clearing goes back to the cache", async () => {
    books = { "": bookOf([ALL]), meal: bookOf([MEAL]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    for (const text of ["m", "me", "mea", "meal"]) {
      fireEvent.change(searchField(), { target: { value: text } });
      act(() => vi.advanceTimersByTime(100));
    }
    act(() => vi.advanceTimersByTime(149));
    expect(libraryCalls()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    // The query's notifications scheduled meanwhile (0 ms), before the clock is real again. Not
    // `runOnlyPendingTimers`: that would also run the cache's 5-minute collection of the unsearched
    // list, which the app would keep.
    act(() => vi.advanceTimersByTime(20));
    vi.useRealTimers();

    await waitFor(() => expect(libraryCalls()).toHaveLength(2));
    expect(libraryCalls()[1]!.searchParams.get("q")).toBe("meal");
    await waitFor(() => expect(rowTitles()).toEqual(["Meal plan script", "Meal prep for students", "An old meal idea"]));

    fireEvent.click(chip("Drafts"));
    expect(rowTitles()).toEqual(["Meal plan script"]);
    fireEvent.click(chip("All"));

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(searchField()).toHaveValue("");
    expect(rowTitles()).toEqual(["Meal prep for students", "Meal plan script", "Gym hooks"]);
    await settle();
    expect(libraryCalls()).toHaveLength(2);
  });

  it("while a search loads, the rows before stay, busy, and no empty line is decided; then its answer", async () => {
    const answer = deferred<LibraryPage>();
    books = { "": bookOf([ALL]), meal: { "": () => answer.promise } };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    fireEvent.change(searchField(), { target: { value: "meal" } });
    // Until the request goes (250 ms), and while it is out: the rows before, marked busy.
    expect(chatList()).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(libraryCalls()).toHaveLength(2));
    expect(chatList()).toHaveAttribute("aria-busy", "true");
    expect(rowTitles()).toEqual(["Meal prep for students", "Meal plan script", "Gym hooks"]);
    expect(screen.queryByText(/^No chat called/)).toBeNull();

    await act(async () => answer.resolve({ chats: [], next: null }));
    expect(await screen.findByText('No chat called "meal".')).toBeInTheDocument();
  });

  it("a search's empty answer is not shown for the next text while that one is not yet asked", async () => {
    books = { "": bookOf([ALL]), zzz: bookOf([[]]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    fireEvent.change(searchField(), { target: { value: "zzz" } });
    expect(await screen.findByText('No chat called "zzz".')).toBeInTheDocument();

    fireEvent.change(searchField(), { target: { value: "zzzy" } });
    expect(screen.queryByText(/^No chat called/)).toBeNull();
    expect(chatList()).toHaveAttribute("aria-busy", "true");
  });

  it("a search that fails shows the failure, not the rows before", async () => {
    books = { "": bookOf([ALL]), meal: { "": 500 } };
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    fireEvent.change(searchField(), { target: { value: "meal" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your library.");
    expect(screen.queryByRole("button", { name: "Gym hooks" })).toBeNull();
  });
});

// ─── 5–7. Opening ────────────────────────────────────────────────────────────

describe("LibraryNext — opening", () => {
  it("a row opens its chat: the cookie points at it, the app goes Home, and Back there returns to Library", async () => {
    books = { "": bookOf([[draft("d1", "Morning script"), plain("c1", "Just talking")]]) };
    renderLibrary();

    fireEvent.click(await screen.findByRole("button", { name: "Just talking" }));

    expect(getActiveThreadCookie()).toBe("c1");
    expect(useBoardStore.getState().activeThreadId).toBe("c1");
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().threadBack).toBe("/library");
  });

  it("a gauge opens its piece's result: a text's page by its key and kind, a video's by its run", async () => {
    books = {
      "": bookOf([
        [
          chat("h1", { title: "Gym hooks", summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim("h1", 66) } }),
          chat("i1", { title: "Ideas for June", summary: { counts: { ...NONE, ideas: 5 }, lead: "ideas", stage: "simulated", sim: textSim("i1", 52, "idea") } }),
          chat("o1", { title: "Night script", summary: { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "simulated", sim: textSim("o1", 47, "opening") } }),
          chat("v1", {
            title: "Reacting to my first video",
            summary: {
              counts: { ...NONE, videos: 1 },
              lead: "video",
              stage: "simulated",
              sim: { number: 38, measure: "end", at: ago(5), kind: "video", link: { type: "video", analysisId: "run-v1" } },
            },
          }),
        ],
      ]),
    };
    renderLibrary();

    const hook = await screen.findByRole("link", { name: "Open the result: Gym hooks" });
    expect(hook).toHaveAttribute("href", "/simulation/hook/h1/key-h1");
    expect(hook).toHaveAccessibleDescription("66% would stop to watch");

    expect(screen.getByRole("link", { name: "Open the result: Ideas for June" })).toHaveAttribute("href", "/simulation/hook/i1/key-i1?as=idea");
    expect(screen.getByRole("link", { name: "Open the result: Night script" })).toHaveAttribute("href", "/simulation/hook/o1/key-o1?as=opening");

    const video = screen.getByRole("link", { name: "Open the result: Reacting to my first video" });
    expect(video).toHaveAttribute("href", "/simulation/run-v1");
    expect(video).toHaveAccessibleDescription("38% watch to the end");
    // Reads only: the page, and nothing else.
    expect(urls().map((url) => url.pathname)).toEqual(["/api/threads/library"]);
  });

  it("New chat on the empty Library starts a new chat (and leaves no way back to Library)", async () => {
    books = { "": bookOf([[]]) };
    useShellStore.setState({ threadBack: "/library" });
    renderLibrary();

    fireEvent.click(await screen.findByRole("button", { name: "New chat" }));

    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().threadBack).toBeNull();
  });
});

// An untitled chat has one name: opened from its row, its header shows the row's name.
describe("LibraryNext — an untitled chat keeps its row's name when opened", () => {
  const untitledVideo = chat("c-v", {
    title: null,
    summary: {
      counts: { ...NONE, videos: 1 },
      lead: "video",
      stage: "simulated",
      sim: { number: 38, measure: "end", at: ago(5), kind: "video", link: { type: "video", analysisId: "run-v" } },
    },
  });

  it("opened from a row reading \"Video simulation\": the chat is handed that name, with the way back", async () => {
    books = { "": bookOf([[untitledVideo, plain("c1", "Just talking")]]) };
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "Video simulation" }));
    expect(getActiveThreadCookie()).toBe("c-v");
    expect(useShellStore.getState().threadTitleHint).toEqual({ id: "c-v", title: "Video simulation" });
    expect(useShellStore.getState().threadBack).toBe("/library");
  });

  it("a chat with a title of its own is handed none", async () => {
    useShellStore.setState({ threadTitleHint: { id: "c-v", title: "Video simulation" } });
    books = { "": bookOf([[untitledVideo, plain("c1", "Just talking")]]) };
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "Just talking" }));
    expect(useShellStore.getState().threadTitleHint).toBeNull();
  });

  it("a saved piece of an untitled chat on the loaded pages: its chat is handed the row's name too", async () => {
    books = { "": bookOf([[untitledVideo]]) };
    savedList = [piece("sv-v", "hook", { thread_id: "c-v", title: HOOK_TEXT, snapshot: { hookLine: HOOK_TEXT } })];
    renderLibrary({ filter: "saved", q: "" });
    await screen.findByRole("button", { name: HOOK_TEXT });
    // The chat's own page is read for the saved line's title.
    await waitFor(() => expect(screen.getByRole("button", { name: HOOK_TEXT })).toHaveAccessibleDescription("Hook · from Video simulation"));
    fireEvent.click(screen.getByRole("button", { name: HOOK_TEXT }));
    expect(getActiveThreadCookie()).toBe("c-v");
    expect(useShellStore.getState().threadTitleHint).toEqual({ id: "c-v", title: "Video simulation" });
  });
});

// What happens in a chat opened from here (a simulation, a message) shows when the creator comes
// back: the lists are marked old as the chat opens, and read again on the way back, only then.
describe("LibraryNext — coming back from a chat reads the list again", () => {
  let main: HTMLElement;
  beforeEach(() => {
    main = document.body.appendChild(document.createElement("main"));
  });
  afterEach(() => {
    main.remove();
  });
  const visit = () => main.appendChild(document.createElement("div"));
  const entries = () => client.getQueryCache().findAll({ queryKey: libraryKeys.all });

  it("opening a chat marks every Library list old (Home's page too) and reads nothing", async () => {
    books = { "": bookOf([[simulated("s1"), plain("c1")]]) };
    renderLibrary();
    await screen.findByRole("button", { name: "Simulated s1" });
    await settle();
    // Home's first page, as Recent left it in the cache.
    client.setQueryData(libraryKeys.recent, { chats: [], next: null });
    expect(entries().some((query) => query.isStale())).toBe(false);
    const before = libraryCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "Plain c1" }));

    expect(entries()).toHaveLength(2);
    expect(entries().every((query) => query.isStale())).toBe(true);
    await settle();
    expect(libraryCalls()).toHaveLength(before);
  });

  it("a saved piece's chat opened under Saved marks them old too, and reads nothing", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });
    const hook = await screen.findByRole("button", { name: HOOK_TEXT });
    await settle();
    const before = libraryCalls().length;
    fireEvent.click(hook);
    expect(entries().every((query) => query.isStale())).toBe(true);
    await settle();
    expect(libraryCalls()).toHaveLength(before);
  });

  it("back: the list is read again; its cached rows stay on screen meanwhile (no placeholder); the scroll and the focus stay where they are", async () => {
    books = { "": bookOf([[simulated("s1"), simulated("s2"), plain("c1"), plain("c2")]]) };
    const first = renderLibrary(undefined, visit());
    await screen.findByRole("button", { name: "Simulated s1" });
    await settle();
    main.scrollTop = 640;
    fireEvent.click(screen.getByRole("button", { name: "Plain c1" }));
    first.unmount();
    main.scrollTop = 0;
    const before = libraryCalls().length;

    // In the chat, c1 was simulated: the server's page now says so, once the test answers.
    const answer = deferred<LibraryPage>();
    books[""]![""] = () => answer.promise;
    renderLibrary(undefined, visit());
    expect(main.scrollTop).toBe(640);
    await waitFor(() => expect(libraryCalls()).toHaveLength(before + 1));
    expect(rowTitles()).toEqual(["Simulated s1", "Simulated s2", "Plain c1", "Plain c2"]);
    expect(document.querySelector("[data-part=placeholder]")).toBeNull();
    expect(chatList()).not.toHaveAttribute("aria-busy");
    const row = screen.getByRole("button", { name: "Simulated s2" });
    row.focus();

    const nowSimulated = chat("c1", { title: "Plain c1", summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim("c1", 71, "hook", 0.5) } });
    await act(async () => answer.resolve({ chats: [simulated("s1"), simulated("s2"), nowSimulated, plain("c2")], next: null }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Plain c1" })).toHaveAccessibleDescription("3 hooks · simulated 30m ago"));
    expect(screen.getByRole("link", { name: "Open the result: Plain c1" })).toBeInTheDocument();
    expect(main.scrollTop).toBe(640);
    expect(document.activeElement).toBe(row);
    expect(libraryCalls()).toHaveLength(before + 1);
  });

  it("a remount without an open in between reads nothing (the list is still fresh)", async () => {
    books = { "": bookOf([[simulated("s1"), plain("c1")]]) };
    const first = renderLibrary(undefined, visit());
    await screen.findByRole("button", { name: "Simulated s1" });
    await settle();
    first.unmount();
    const before = libraryCalls().length;
    renderLibrary(undefined, visit());
    await settle();
    expect(libraryCalls()).toHaveLength(before);
  });
});

// ─── 8. Saved ───────────────────────────────────────────────────────

describe("LibraryNext — Saved: the list", () => {
  it("the saved list is asked for only once the Saved chip is first selected, and once", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    await settle();
    // Not with the page: nor the sidebar's list its lines may read.
    expect(savedCalls()).toEqual([]);
    expect(threadListCalls()).toEqual([]);

    fireEvent.click(chip("Saved"));
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    fireEvent.click(chip("All"));
    fireEvent.click(chip("Saved"));
    await settle();
    expect(savedTexts()).toHaveLength(4);
    expect(savedCalls()).toEqual([{ method: "GET", id: null, body: undefined }]);
  });

  it("opened on ?filter=saved, the list is asked for at once", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    expect(savedCalls()).toHaveLength(1);
  });

  it("lists the pieces newest first: each one's own text, its mark, and where it came from", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toEqual([HOOK_TEXT, IDEA_TEXT, SCRIPT_TEXT, VIDEO_TEXT]));
    await waitFor(() => expect(threadListCalls()).toHaveLength(1));
    await settle();

    // The hook's line, the idea's title, the script's opener, the video's caption.
    expect(screen.getByRole("button", { name: HOOK_TEXT })).toHaveAccessibleDescription("Hook · from Gym hooks");
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Idea · from Meal ideas");
    // Its chat is neither on the loaded pages nor in the sidebar's list: still opens it.
    expect(screen.getByRole("button", { name: SCRIPT_TEXT })).toHaveAccessibleDescription("Script · from a chat");

    // Saved in Discover: its own address, in a new tab.
    const video = screen.getByRole("link", { name: VIDEO_TEXT });
    expect(video).toHaveAttribute("href", "https://videos.example/nia.tests/1");
    expect(video).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Video · saved in Discover")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: VIDEO_TEXT })).toBeNull();

    const marks = [...savedListEl().querySelectorAll('[data-part="mark"]')].map((mark) => mark.getAttribute("data-kind"));
    expect(marks).toEqual(["hooks", "ideas", "script", "video"]);
    expect(screen.getAllByRole("button", { name: "Remove from saved" })).toHaveLength(4);
  });

  it("a chat beyond the loaded pages is named from the sidebar's list; an untitled chat by its fallback title", async () => {
    books = {
      "": bookOf([
        [
          chat("c-vid", {
            title: null,
            summary: {
              counts: { ...NONE, videos: 1 },
              lead: "video",
              stage: "simulated",
              sim: { number: 38, measure: "end", at: ago(5), kind: "video", link: { type: "video", analysisId: "run-v" } },
            },
          }),
        ],
      ]),
    };
    threadList = [
      { id: "c-sugar", title: "Sugar month", updated_at: ago(400), created_at: ago(500), pinned_at: null },
      { id: "c-blank", title: null, updated_at: ago(400), created_at: ago(500), pinned_at: null },
    ];
    savedList = [
      piece("sv-read", "read", { thread_id: "c-vid", snapshot: { audiences: [{ name: "Gym regulars", lever: "Cut the first two seconds" }] } }),
      piece("sv-script", "script", { thread_id: "c-sugar", title: "Sugar month, the script" }),
      piece("sv-remix", "remix", { thread_id: "c-blank", snapshot: { adaptedHook: "The $100 version of the challenge" } }),
    ];
    renderLibrary({ filter: "saved", q: "" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Sugar month, the script" })).toHaveAccessibleDescription("Script · from Sugar month"));
    expect(screen.getByRole("button", { name: "Cut the first two seconds" })).toHaveAccessibleDescription("Video · from Video simulation");
    // Untitled and not loaded: what it holds is not known here, so no name is made up.
    expect(screen.getByRole("button", { name: "The $100 version of the challenge" })).toHaveAccessibleDescription("Remix · from a chat");
    expect([...savedListEl().querySelectorAll('[data-part="mark"]')].map((mark) => mark.getAttribute("data-kind"))).toEqual([
      "video",
      "script",
      "remix",
    ]);
  });

  it("a library video saved in Discover (its id as the ref, no chat) opens its page in Discover, not its original", async () => {
    const LIBRARY_VIDEO = "0b6f3c1e-8f2a-4c55-9d3e-2a7b1c4d5e6f";
    const TEXT = "I ran an experiment to see if the pool really smells of chlorine";
    books = { "": bookOf([SAVED_FROM]) };
    savedList = [
      piece("sv-lib", "outlier", {
        ref_id: LIBRARY_VIDEO,
        title: TEXT,
        snapshot: { caption: TEXT, videoUrl: "https://videos.example/nia.tests/9", views: 25_000_000, multiplier: 16 },
      }),
      // The same id with a chat is a piece of that chat: it opens the chat, as before.
      piece("sv-chat", "outlier", { ref_id: LIBRARY_VIDEO, thread_id: "c-gym", title: "From the gym chat", snapshot: { caption: "From the gym chat" } }),
    ];
    renderLibrary({ filter: "saved", q: "" });

    const row = await screen.findByRole("button", { name: TEXT });
    expect(row).toHaveAccessibleDescription("Video · saved in Discover");
    expect(screen.queryByRole("link", { name: TEXT })).toBeNull();

    fireEvent.click(row);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/feed/video/${LIBRARY_VIDEO}`);
    // Not a chat: nothing of a chat's way back is left behind.
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useBoardStore.getState().activeThreadId).toBeNull();

    router.push.mockReset();
    fireEvent.click(screen.getByRole("button", { name: "From the gym chat" }));
    expect(router.push).not.toHaveBeenCalledWith(`/feed/video/${LIBRARY_VIDEO}`);
    expect(useBoardStore.getState().activeThreadId).toBe("c-gym");
  });

  it("a video saved in Discover with no web address, and an old piece with neither chat nor address, are listed but open nothing", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = [
      piece("sv-v2", "outlier", { ref_id: "pv-2", snapshot: { caption: "Morning light, no filter" } }),
      piece("sv-v3", "outlier", { ref_id: "pv-3", snapshot: { caption: "Shot on a train", videoUrl: "ftp://videos.example/nia.tests/3" } }),
      piece("sv-old", "hook", { ref_id: null, title: "An old hook from before" }),
    ];
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toEqual(["Morning light, no filter", "Shot on a train", "An old hook from before"]));

    expect(screen.queryByRole("link")).toBeNull();
    for (const text of ["Morning light, no filter", "Shot on a train", "An old hook from before"]) {
      expect(screen.queryByRole("button", { name: text })).toBeNull();
    }
    expect(screen.getAllByText("Video · saved in Discover")).toHaveLength(2);
    // A row a tap cannot open promises no chat: its line is its kind and when it was saved, in the
    // chat rows' time words.
    expect(screen.queryByText("Hook · from a chat")).toBeNull();
    expect(screen.getByText("Hook · 1h ago")).toBeInTheDocument();
    // Each can still be removed.
    expect(screen.getAllByRole("button", { name: "Remove from saved" })).toHaveLength(3);
  });

  it("a piece with no chat says when it was saved: within a week as a time ago, then its date; with no time, its kind alone", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    const older = new Date(Date.now() - 21 * 24 * HOUR);
    savedList = [
      piece("sv-new", "idea", { ref_id: null, title: "An idea from this morning", created_at: ago(3) }),
      piece("sv-older", "hook", { ref_id: null, title: "A hook from three weeks back", created_at: older.toISOString() }),
      piece("sv-when", "script", { ref_id: null, snapshot: { openingBeatSeed: "A script with no time" }, created_at: "not a time" }),
      // A piece with its chat is unchanged.
      PIECES[0]!,
    ];
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    const lineOf = (text: string) => screen.getByText(text).closest("li")!.querySelector('[id$="-line"]')!.textContent;
    expect(lineOf("An idea from this morning")).toBe("Idea · 3h ago");
    const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(older.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) }).format(older);
    expect(lineOf("A hook from three weeks back")).toBe(`Hook · ${date}`);
    expect(lineOf("A script with no time")).toBe("Script");
    expect(lineOf(HOOK_TEXT)).toBe("Hook · from Gym hooks");
  });

  it("while the list loads the screen is loading; a failure says so and Try again asks again", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    let fail = true;
    const first = deferred<SavedItem[] | number>();
    let calls = 0;
    savedList = () => (++calls === 1 ? first.promise : Promise.resolve(fail ? 500 : PIECES));
    renderLibrary({ filter: "saved", q: "" });

    expect(chatList()).toHaveAttribute("aria-busy", "true");
    await act(async () => first.resolve(500));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your library.");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    expect(savedCalls()).toHaveLength(2);
  });
});

describe("LibraryNext — Saved: opening a piece", () => {
  it("a tap on a piece opens the chat it came from: the cookie, Home, and the way back to Library", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });

    fireEvent.click(await screen.findByRole("button", { name: HOOK_TEXT }));
    expect(getActiveThreadCookie()).toBe("c-gym");
    expect(useBoardStore.getState().activeThreadId).toBe("c-gym");
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().threadBack).toBe("/library");

    // A chat Library has not loaded opens all the same.
    fireEvent.click(screen.getByRole("button", { name: SCRIPT_TEXT }));
    expect(getActiveThreadCookie()).toBe("c-far");
    // Reads only.
    expect(savedCalls().map((call) => call.method)).toEqual(["GET"]);
  });
});

describe("LibraryNext — Saved: the search is the pieces' own", () => {
  it("filters the pieces by their own text, case-blind, on this side; the server is not asked", async () => {
    books = { "": bookOf([SAVED_FROM]), meal: bookOf([[draft("c-meal", "Meal ideas")]]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toHaveLength(4));

    fireEvent.change(searchField(), { target: { value: "  MEAL " } });
    expect(savedTexts()).toEqual([IDEA_TEXT]);
    // Past the search's wait: its text goes to the address, and no search goes to the server.
    await waitFor(() => expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library?filter=saved&q=MEAL"));
    await settle();
    expect(libraryCalls().filter((url) => url.searchParams.has("q"))).toEqual([]);
    // The screen's own write is not taken for a navigation: the field keeps what was typed.
    expect(searchField()).toHaveValue("  MEAL ");

    fireEvent.change(searchField(), { target: { value: "zzz" } });
    expect(screen.getByText('Nothing saved matches "zzz".')).toBeInTheDocument();
    expect(screen.queryByText(/No chat called/)).toBeNull();

    // The chats' search is the server's: All asks for it.
    fireEvent.change(searchField(), { target: { value: "meal" } });
    await waitFor(() => expect(addressWrites()).toHaveBeenLastCalledWith(null, "", "/library?filter=saved&q=meal"));
    expect(libraryCalls().filter((url) => url.searchParams.has("q"))).toEqual([]);
    fireEvent.click(chip("All"));
    await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas"]));
    expect(libraryCalls().at(-1)!.searchParams.get("q")).toBe("meal");
  });

  it("opened on ?filter=saved&q=meal: the pieces filtered, and no search sent", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "meal" });
    await waitFor(() => expect(savedTexts()).toEqual([IDEA_TEXT]));
    await settle();
    expect(searchField()).toHaveValue("meal");
    expect(libraryCalls().filter((url) => url.searchParams.has("q"))).toEqual([]);
  });
});

// "Removed. Undo" is a line in the list, in the
// piece's place, with no toast. The delete is sent only when the line's 6 seconds end or the creator
// leaves it (another chip, a search that hides it, a navigation, the screen going); an Undo before
// that sends nothing, so the piece keeps its place and its save time.
describe("LibraryNext — Saved: Remove from saved, and Undo", () => {
  /** Each saved row, top to bottom: its text, or "Removed." while its line is up. */
  const rowsShown = () =>
    within(savedListEl())
      .getAllByRole("listitem")
      .map((li) => (li.querySelector('[data-part="removed"]') ? "Removed." : li.querySelector('[id$="-text"]')?.textContent));
  const undoOf = (text: string) => screen.getByRole("button", { name: `Undo: ${text}` });
  /** The saved list as the cache holds it: what the chat's details sheet reads too. */
  const cachedIds = () => client.getQueryData<{ items: SavedItem[] }>(["saved", "list", "all"])?.items.map((item) => item.id);
  /** With the clock stopped: `ms` on, the timers due run, and the requests answer. */
  const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
  const noToast = () => expect(document.querySelector('[aria-label="Notifications"]')).toBeNull();

  /** Saved, loaded, with the clock stopped from here on (the line's 6 s are counted by it). */
  async function openSaved() {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    const view = renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    return view;
  }

  it("Remove turns the row, in its place, into \"Removed.\" and Undo; the focus is on Undo; nothing is sent", async () => {
    await openSaved();
    removeOf(IDEA_TEXT).focus();
    fireEvent.click(removeOf(IDEA_TEXT));

    expect(rowsShown()).toEqual([HOOK_TEXT, "Removed.", SCRIPT_TEXT, VIDEO_TEXT]);
    const line = within(savedListEl()).getAllByRole("listitem")[1]!;
    expect(within(line).getByRole("status")).toHaveTextContent("Removed.");
    expect(undoOf(IDEA_TEXT)).toHaveFocus();
    expect(deletes()).toEqual([]);
    // Still saved until its delete has gone through: the chat's details sheet agrees.
    expect(cachedIds()).toContain("sv-idea");
    noToast();
  });

  it("after 6 s exactly one DELETE /api/saved?id=… goes out, kept alive, and the row is gone", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));

    await tick(5_999);
    expect(deletes()).toEqual([]);
    await tick(1);
    expect(deletes()).toEqual([{ method: "DELETE", id: "sv-idea", body: undefined, keepalive: true }]);
    await tick(50);
    expect(rowsShown()).toEqual([HOOK_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    expect(cachedIds()).not.toContain("sv-idea");

    await tick(10_000);
    expect(deletes()).toHaveLength(1);
    noToast();
  });

  it("a line that leaves by itself with the focus on its Undo hands the focus to the next row's Remove", async () => {
    await openSaved();
    removeOf(IDEA_TEXT).focus();
    fireEvent.click(removeOf(IDEA_TEXT));
    expect(undoOf(IDEA_TEXT)).toHaveFocus();

    await tick(6_050);
    expect(rowsShown()).toEqual([HOOK_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    expect(removeOf(SCRIPT_TEXT)).toHaveFocus();
  });

  it("Undo before then sends nothing: the row is back as it was, the focus on its Remove", async () => {
    await openSaved();
    removeOf(IDEA_TEXT).focus();
    fireEvent.click(removeOf(IDEA_TEXT));
    await tick(3_000);

    fireEvent.click(undoOf(IDEA_TEXT));
    expect(rowsShown()).toEqual([HOOK_TEXT, IDEA_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Idea · from Meal ideas");
    expect(removeOf(IDEA_TEXT)).toHaveFocus();

    await tick(10_000);
    expect(deletes()).toEqual([]);
    // The same row, its own save time: nothing was saved again.
    expect(cachedIds()).toEqual(["sv-hook", "sv-idea", "sv-script", "sv-video"]);
    noToast();
  });

  it("two removals run independently, each with its own 6 s", async () => {
    await openSaved();
    fireEvent.click(removeOf(HOOK_TEXT));
    await tick(3_000);
    fireEvent.click(removeOf(SCRIPT_TEXT));
    expect(rowsShown()).toEqual(["Removed.", IDEA_TEXT, "Removed.", VIDEO_TEXT]);

    await tick(3_000);
    expect(deletes().map((call) => call.id)).toEqual(["sv-hook"]);
    await tick(50);
    // The script is still counted as saved: its delete has not gone yet.
    expect(cachedIds()).toEqual(["sv-idea", "sv-script", "sv-video"]);
    expect(rowsShown()).toEqual([IDEA_TEXT, "Removed.", VIDEO_TEXT]);

    fireEvent.click(undoOf(SCRIPT_TEXT));
    await tick(10_000);
    expect(deletes().map((call) => call.id)).toEqual(["sv-hook"]);
    expect(rowsShown()).toEqual([IDEA_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
  });

  it("leaving the Saved chip sends the delete at once", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    fireEvent.click(chip("All"));
    expect(deletes()).toEqual([{ method: "DELETE", id: "sv-idea", body: undefined, keepalive: true }]);

    await tick(50);
    fireEvent.click(chip("Saved"));
    expect(rowsShown()).toEqual([HOOK_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    await tick(10_000);
    expect(deletes()).toHaveLength(1);
  });

  it("a navigation away from Saved (the Library tab) sends the delete at once", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    navigate("/library");
    expect(deletes().map((call) => call.id)).toEqual(["sv-idea"]);
  });

  it("a search that hides the line sends the delete at once; one that keeps it in view does not", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));

    // The idea's text has "meal": the line stays.
    fireEvent.change(searchField(), { target: { value: "meal" } });
    expect(rowsShown()).toEqual(["Removed."]);
    expect(deletes()).toEqual([]);

    fireEvent.change(searchField(), { target: { value: "zzz" } });
    expect(deletes().map((call) => call.id)).toEqual(["sv-idea"]);
  });

  it("the screen going sends the delete at once, kept alive, and it still lands in the saved list", async () => {
    const view = await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    view.unmount();
    expect(deletes()).toEqual([{ method: "DELETE", id: "sv-idea", body: undefined, keepalive: true }]);

    await tick(50);
    expect(cachedIds()).toEqual(["sv-hook", "sv-script", "sv-video"]);
  });

  it("the page going (a reload, the tab closed) sends the delete at once, kept alive", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(deletes()).toEqual([{ method: "DELETE", id: "sv-idea", body: undefined, keepalive: true }]);
  });

  // Once a delete is sent, nothing on screen offers to undo it.
  it("once its delete is sent the line leaves at once, its Undo with it; a refusal brings the row back with \"Couldn't remove it.\"", async () => {
    await openSaved();
    const answer = deferred<number>();
    onDelete = () => answer.promise;
    removeOf(IDEA_TEXT).focus();
    fireEvent.click(removeOf(IDEA_TEXT));
    await tick(6_000);
    expect(deletes()).toHaveLength(1);

    // On its way: no line, no Undo. Still saved until the answer (the chat's details sheet agrees).
    expect(rowsShown()).toEqual([HOOK_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    expect(screen.queryByRole("button", { name: `Undo: ${IDEA_TEXT}` })).toBeNull();
    expect(cachedIds()).toContain("sv-idea");
    // The focus was on its Undo: handed to the row now in its place.
    expect(removeOf(SCRIPT_TEXT)).toHaveFocus();

    await act(async () => answer.resolve(500));
    await tick(50);
    expect(rowsShown()).toEqual([HOOK_TEXT, IDEA_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    const idea = screen.getByRole("button", { name: IDEA_TEXT });
    expect(idea).toHaveAccessibleDescription("Couldn't remove it.");
    expect(within(idea.closest("li")!).getByRole("status")).toHaveTextContent("Couldn't remove it.");
    // The focus stays where the creator is now.
    expect(removeOf(SCRIPT_TEXT)).toHaveFocus();
    expect(cachedIds()).toContain("sv-idea");
    expect(deletes()).toHaveLength(1);
    noToast();

    // The next thing done on the list: the line is the row's own again.
    fireEvent.click(removeOf(HOOK_TEXT));
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Idea · from Meal ideas");
  });

  it("an answered delete takes the piece off for good: nothing to undo, nothing sent again", async () => {
    await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    await tick(6_000);
    expect(screen.queryByRole("button", { name: `Undo: ${IDEA_TEXT}` })).toBeNull();
    await tick(50);
    expect(rowsShown()).toEqual([HOOK_TEXT, SCRIPT_TEXT, VIDEO_TEXT]);
    expect(cachedIds()).not.toContain("sv-idea");
    await tick(10_000);
    expect(deletes()).toHaveLength(1);
  });

  // A refusal that comes while the creator is away from the line is still said.
  it("a delete refused after the creator left the line (another chip) is reported when they come back", async () => {
    await openSaved();
    onDelete = () => 500;
    fireEvent.click(removeOf(IDEA_TEXT));
    fireEvent.click(chip("All"));
    expect(deletes()).toHaveLength(1);
    // Refused while All is up.
    await tick(50);

    fireEvent.click(chip("Saved"));
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Couldn't remove it.");
    // Seen once: the next thing done on the list clears it.
    fireEvent.click(removeOf(HOOK_TEXT));
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Idea · from Meal ideas");
  });

  it("…and after a search hid it: clearing the search shows the refusal", async () => {
    await openSaved();
    onDelete = () => 500;
    fireEvent.click(removeOf(IDEA_TEXT));
    fireEvent.change(searchField(), { target: { value: "zzz" } });
    expect(deletes()).toHaveLength(1);
    await tick(50);

    fireEvent.change(searchField(), { target: { value: "" } });
    expect(screen.getByRole("button", { name: IDEA_TEXT })).toHaveAccessibleDescription("Couldn't remove it.");
  });

  // Only the screen going sends the waiting deletes, whatever else is new.
  it("a rerender that gives `send` a new identity sends nothing; the line keeps its own time", async () => {
    const view = await openSaved();
    fireEvent.click(removeOf(IDEA_TEXT));
    await tick(1_000);

    // Another query client: the removal's functions, and so `send`, are new ones. The saved list is
    // the same, so the line stays in view.
    const other = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false } } });
    other.setQueryData(["saved", "list", "all"], { items: PIECES });
    view.rerender(
      <QueryClientProvider client={other}>
        <ToastProvider>
          <LibraryNext />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await tick(50);
    expect(deletes()).toEqual([]);
    expect(rowsShown()).toEqual([HOOK_TEXT, "Removed.", SCRIPT_TEXT, VIDEO_TEXT]);

    await tick(5_000);
    expect(deletes().map((call) => call.id)).toEqual(["sv-idea"]);
    view.unmount();
    other.clear();
  });
});

// ─── 9. Managing a chat from its row ────────────────────────────────

// Spec §3.5 and §5: each chat row ends in a More with the sidebar's own actions and requests.
// Rename, pin and delete change the row at once, in every list that holds the chat (the Library's
// pages for each search, Home's first page, the sidebar's short list), and put it back with the
// sidebar's kind of message when the server refuses. The sidebar's list and Home's page are asked
// for again afterwards. Nothing in the More opens the chat.
describe("LibraryNext — managing a chat from its row", () => {
  const ROWS = [simulated("c1", "Gym hooks"), draft("c2", "Meal ideas"), plain("c3", "Just talking")];
  const summaryOf = (c: LibraryChat): ThreadSummary => ({
    id: c.id,
    title: c.title,
    updated_at: c.updatedAt,
    created_at: c.updatedAt,
    pinned_at: c.pinned ? c.updatedAt : null,
  });
  const LIST_KEY = ["threads", "list"];
  const RECENT_KEY = ["library", "recent"];
  const SEARCH_KEY = ["library", "chats", "gym"];

  const moreOf = (title: string) => screen.getByRole("button", { name: `More: ${title}` });
  const sheet = (title: string) => screen.getByRole("dialog", { name: title });
  const inSheet = (title: string, name: string) => within(sheet(title)).getByRole("button", { name });
  const openMenu = (title: string) => {
    moreOf(title).focus();
    fireEvent.click(moreOf(title));
  };
  const rename = (title: string, next: string) => {
    openMenu(title);
    fireEvent.click(inSheet(title, "Rename"));
    // Renaming, the sheet reads "Rename" (to a screen reader, "Rename {title}").
    const field = within(sheet(`Rename ${title}`)).getByRole("textbox", { name: `Rename ${title}` });
    fireEvent.change(field, { target: { value: next } });
    fireEvent.keyDown(field, { key: "Enter" });
  };
  const pin = (title: string, name: "Pin" | "Unpin" = "Pin") => {
    openMenu(title);
    fireEvent.click(inSheet(title, name));
  };
  const remove = (title: string) => {
    openMenu(title);
    fireEvent.click(inSheet(title, "Delete"));
    fireEvent.click(inSheet(title, "Delete"));
  };

  /** What the other lists hold for the chats: Home's first page, a search's pages, the sidebar's list. */
  const recentChats = () => client.getQueryData<LibraryPage>(RECENT_KEY)?.chats;
  const searchChats = () => client.getQueryData<{ pages: LibraryPage[] }>(SEARCH_KEY)?.pages.flatMap((page) => page.chats);
  const listed = () => client.getQueryData<ThreadSummary[]>(LIST_KEY);
  const invalidated = (key: readonly string[]) => client.getQueryState(key)?.isInvalidated;
  const toastSays = (text: string) => screen.findByText(text);

  /** The Library on ROWS, with Home's first page, a search for "gym" and the sidebar's list cached
   *  as a visit to them leaves them. */
  async function renderRows(rows: LibraryChat[] = ROWS) {
    books = { "": bookOf([rows]) };
    client.setQueryData(RECENT_KEY, { chats: rows, next: null });
    client.setQueryData(SEARCH_KEY, { pages: [{ chats: rows.slice(0, 1), next: null }], pageParams: [null] });
    client.setQueryData(LIST_KEY, rows.map(summaryOf));
    renderLibrary();
    await waitFor(() => expect(rowTitles()).toHaveLength(rows.length));
  }

  it("each chat row ends in its More, after its gauge", async () => {
    await renderRows();
    for (const chat of ROWS) {
      const row = screen.getByRole("button", { name: chat.title! });
      expect(moreOf(chat.title!).closest("li")).toBe(row.closest("li"));
    }
    const gym = screen.getByRole("link", { name: "Open the result: Gym hooks" });
    expect(gym.compareDocumentPosition(moreOf("Gym hooks")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Rename sends PATCH /api/threads/{id} with the title, and the row shows it at once, in every list", async () => {
    await renderRows();
    const answer = deferred<number>();
    onThread = () => answer.promise;

    rename("Gym hooks", "Leg day hooks");

    // Before the server answers.
    expect(await screen.findByRole("button", { name: "Leg day hooks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gym hooks" })).toBeNull();
    expect(threadCalls()).toEqual([{ method: "PATCH", path: "/api/threads/c1", body: { title: "Leg day hooks" } }]);
    expect(recentChats()?.[0]?.title).toBe("Leg day hooks");
    expect(searchChats()?.[0]?.title).toBe("Leg day hooks");
    expect(listed()?.[0]?.title).toBe("Leg day hooks");

    await act(async () => answer.resolve(200));
    await settle();
    expect(screen.getByRole("button", { name: "Leg day hooks" })).toBeInTheDocument();
    // The sidebar's list and Home's page are asked for again.
    expect(invalidated(LIST_KEY)).toBe(true);
    expect(invalidated(RECENT_KEY)).toBe(true);
    // The focus is back on the row's More, and the chat was never opened.
    expect(moreOf("Leg day hooks")).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
    expect(getActiveThreadCookie()).toBeNull();
  });

  it("the row shows the title as the server stores it (its wrapping quotes and extra spaces cleaned)", async () => {
    await renderRows();
    rename("Gym hooks", '"Leg   day hooks"');
    expect(await screen.findByRole("button", { name: "Leg day hooks" })).toBeInTheDocument();
    await settle();
    expect(threadCalls()[0]?.body).toEqual({ title: '"Leg   day hooks"' });
  });

  it("a refused rename puts the title back in every list and says so", async () => {
    await renderRows();
    onThread = () => 500;

    rename("Gym hooks", "Leg day hooks");

    expect(await toastSays("Couldn't rename that chat.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Gym hooks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leg day hooks" })).toBeNull();
    expect(recentChats()?.[0]?.title).toBe("Gym hooks");
    expect(searchChats()?.[0]?.title).toBe("Gym hooks");
    expect(listed()?.[0]?.title).toBe("Gym hooks");
    expect(invalidated(LIST_KEY)).toBe(true);
    expect(invalidated(RECENT_KEY)).toBe(true);
  });

  it("an untitled chat's rename starts from an empty field, its shown title the placeholder", async () => {
    const untitled = chat("c-v", { title: null, summary: { counts: { ...NONE, videos: 1 }, lead: "video", stage: "draft" } });
    await renderRows([untitled, ...ROWS]);
    openMenu("Video simulation");
    fireEvent.click(inSheet("Video simulation", "Rename"));
    const field = within(sheet("Rename Video simulation")).getByRole("textbox", { name: "Rename Video simulation" });
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "Video simulation");
    // Nothing to send yet.
    fireEvent.keyDown(field, { key: "Enter" });
    await settle();
    expect(threadCalls()).toEqual([]);
  });

  it("Pin sends { pinned: true }; the row is marked pinned at once and moves first", async () => {
    await renderRows();
    const answer = deferred<number>();
    onThread = () => answer.promise;

    pin("Meal ideas");

    await waitFor(() => expect(screen.getByRole("button", { name: "Meal ideas" })).toHaveAccessibleDescription("Pinned, Script · 1d ago"));
    expect(threadCalls()).toEqual([{ method: "PATCH", path: "/api/threads/c2", body: { pinned: true } }]);
    // Pinned chats come first, as the endpoint lists them.
    expect(rowTitles()).toEqual(["Meal ideas", "Gym hooks", "Just talking"]);
    expect(recentChats()?.find((c) => c.id === "c2")?.pinned).toBe(true);
    expect(listed()?.find((t) => t.id === "c2")?.pinned_at).not.toBeNull();

    await act(async () => answer.resolve(200));
    await settle();
    expect(invalidated(LIST_KEY)).toBe(true);
    expect(invalidated(RECENT_KEY)).toBe(true);
    expect(moreOf("Meal ideas")).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Unpin on a pinned chat sends { pinned: false } and the mark goes at once", async () => {
    await renderRows([chat("c1", { title: "Gym hooks", pinned: true }), ...ROWS.slice(1)]);
    pin("Gym hooks", "Unpin");
    await waitFor(() => expect(screen.getByRole("button", { name: "Gym hooks" })).toHaveAccessibleDescription("Chat · 3h ago"));
    await settle();
    expect(threadCalls()).toEqual([{ method: "PATCH", path: "/api/threads/c1", body: { pinned: false } }]);
  });

  it("a refused pin puts the row back and says so", async () => {
    await renderRows();
    onThread = () => 500;

    pin("Meal ideas");

    expect(await toastSays("Couldn't pin that chat.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Meal ideas" })).toHaveAccessibleDescription("Script · 1d ago"));
    expect(recentChats()?.find((c) => c.id === "c2")?.pinned).toBe(false);
    expect(listed()?.find((t) => t.id === "c2")?.pinned_at).toBeNull();
  });

  it("a refused unpin says so in its own words", async () => {
    await renderRows([chat("c1", { title: "Gym hooks", pinned: true }), ...ROWS.slice(1)]);
    onThread = () => 500;
    pin("Gym hooks", "Unpin");
    expect(await toastSays("Couldn't unpin that chat.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Gym hooks" })).toHaveAccessibleDescription("Pinned, Chat · 3h ago"));
  });

  it("Delete asks once more, and Cancel sends nothing", async () => {
    await renderRows();
    openMenu("Gym hooks");
    fireEvent.click(inSheet("Gym hooks", "Delete"));
    expect(within(sheet("Gym hooks")).getByText("Delete this chat?")).toBeInTheDocument();
    fireEvent.click(inSheet("Gym hooks", "Cancel"));
    await settle();
    expect(threadCalls()).toEqual([]);
    expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]);
    expect(moreOf("Gym hooks")).toHaveFocus();
  });

  it("Delete's question says what goes with the chat: its row's pieces in lower case, or for a plain chat only that it is for good", async () => {
    await renderRows();
    const lineOf = (title: string) => {
      openMenu(title);
      fireEvent.click(inSheet(title, "Delete"));
      const confirm = inSheet(title, "Delete");
      const description = confirm.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent).join(" ");
      fireEvent.click(inSheet(title, "Cancel"));
      return description;
    };
    expect(lineOf("Gym hooks")).toBe("Delete this chat? This also deletes what's in it (3 hooks). It can't be undone.");
    await settle();
    expect(lineOf("Meal ideas")).toBe("Delete this chat? This also deletes what's in it (script). It can't be undone.");
    await settle();
    expect(lineOf("Just talking")).toBe("Delete this chat? It can't be undone.");
    expect(threadCalls()).toEqual([]);
  });

  it("Delete sends DELETE /api/threads/{id}; the row leaves at once, from every list; the focus goes to the next row", async () => {
    await renderRows();
    const answer = deferred<number>();
    onThread = () => answer.promise;

    remove("Gym hooks");

    await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas", "Just talking"]));
    expect(threadCalls()).toEqual([{ method: "DELETE", path: "/api/threads/c1", body: undefined }]);
    expect(recentChats()?.map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(searchChats()).toEqual([]);
    expect(listed()?.map((t) => t.id)).toEqual(["c2", "c3"]);
    await settle();
    expect(screen.getByRole("button", { name: "Meal ideas" })).toHaveFocus();

    await act(async () => answer.resolve(200));
    await settle();
    expect(rowTitles()).toEqual(["Meal ideas", "Just talking"]);
    expect(invalidated(LIST_KEY)).toBe(true);
    expect(invalidated(RECENT_KEY)).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Couldn't delete that chat.")).toBeNull();
  });

  it("deleting the last row hands the focus to the row before; the only row, to the chip", async () => {
    await renderRows();
    remove("Just talking");
    await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas"]));
    await settle();
    expect(screen.getByRole("button", { name: "Meal ideas" })).toHaveFocus();
    cleanup();
    client.clear();

    await renderRows(ROWS.slice(0, 1));
    remove("Gym hooks");
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    await settle();
    expect(chip("All")).toHaveFocus();
  });

  it("a refused delete puts the row back in its place, in every list, with the sidebar's message", async () => {
    await renderRows();
    onThread = () => 500;

    remove("Meal ideas");

    expect(await toastSays("Couldn't delete that chat.")).toBeInTheDocument();
    await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]));
    expect(recentChats()?.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(listed()?.map((t) => t.id)).toEqual(["c1", "c2", "c3"]);
    expect(invalidated(LIST_KEY)).toBe(true);
  });

  // The rollback in a second cached list (a search that also holds the chat).
  it("a refused delete of a chat a search also holds puts it back in that search's list too", async () => {
    await renderRows();
    const answer = deferred<number>();
    onThread = () => answer.promise;

    remove("Gym hooks");
    await waitFor(() => expect(searchChats()).toEqual([]));

    await act(async () => answer.resolve(500));
    expect(await toastSays("Couldn't delete that chat.")).toBeInTheDocument();
    expect(searchChats()?.map((c) => c.id)).toEqual(["c1"]);
    expect(recentChats()?.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]);
  });

  it("two deletes out at once, the first refused: only the first row comes back", async () => {
    await renderRows();
    const first = deferred<number>();
    const second = deferred<number>();
    onThread = (_method, id) => (id === "c1" ? first.promise : second.promise);

    remove("Gym hooks");
    await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas", "Just talking"]));
    await settle();
    remove("Meal ideas");
    await waitFor(() => expect(rowTitles()).toEqual(["Just talking"]));

    await act(async () => first.resolve(500));
    await settle();
    expect(rowTitles()).toEqual(["Gym hooks", "Just talking"]);
    expect(recentChats()?.map((c) => c.id)).toEqual(["c1", "c3"]);

    await act(async () => second.resolve(200));
    await settle();
    expect(rowTitles()).toEqual(["Gym hooks", "Just talking"]);
  });

  it("a rename, then a pin of the same chat, the rename refused: the pin stays", async () => {
    await renderRows();
    const renamed = deferred<number>();
    onThread = (_method, _id, body) => ((body as { title?: string }).title !== undefined ? renamed.promise : 200);

    rename("Gym hooks", "Leg day hooks");
    await screen.findByRole("button", { name: "Leg day hooks" });
    await settle();
    pin("Leg day hooks");
    await waitFor(() => expect(screen.getByRole("button", { name: "Leg day hooks" })).toHaveAccessibleDescription(/^Pinned, /));

    // The server once both are answered (the list is read again then): pinned, the old title.
    books[""] = bookOf([[{ ...ROWS[0]!, pinned: true }, ROWS[1]!, ROWS[2]!]]);
    await act(async () => renamed.resolve(500));
    await settle();
    expect(screen.getByRole("button", { name: "Gym hooks" })).toHaveAccessibleDescription(/^Pinned, /);
  });

  it("a tap on More, or on anything in its sheet, never opens the chat", async () => {
    await renderRows();
    openMenu("Gym hooks");
    fireEvent.click(inSheet("Gym hooks", "Close"));
    await settle();
    openMenu("Gym hooks");
    fireEvent.click(inSheet("Gym hooks", "Rename"));
    fireEvent.keyDown(within(sheet("Rename Gym hooks")).getByRole("textbox"), { key: "Escape" });
    await settle();
    openMenu("Gym hooks");
    fireEvent.click(inSheet("Gym hooks", "Delete"));
    fireEvent.click(inSheet("Gym hooks", "Cancel"));
    await settle();

    expect(router.push).not.toHaveBeenCalled();
    expect(getActiveThreadCookie()).toBeNull();
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(threadCalls()).toEqual([]);
  });

  it("the More is on the chats only, not on the saved pieces", async () => {
    books = { "": bookOf([SAVED_FROM]) };
    savedList = PIECES;
    renderLibrary({ filter: "saved", q: "" });
    await waitFor(() => expect(savedTexts()).toHaveLength(4));
    expect(screen.queryByRole("button", { name: /^More: / })).toBeNull();
  });

  // ─── While a search loads, and other edges of an action ─────────────────────

  // While a typed search loads, the rows on screen are the search before's,
  // a frozen copy, and the search's own list has no rows yet for the change to reach. The change
  // must show at once on those rows and stay done when the search's answer, already on its way,
  // still holds the chat: that list is asked for again once the action is answered.
  describe("an action while a search is still loading", () => {
    /** The rows a search for "hooks" answers: first as it was asked (before the action), then as
     *  the server holds them since. */
    let hooksAnswers: Array<Promise<LibraryPage>>;
    const hooksCalls = () => libraryCalls().filter((url) => url.searchParams.get("q") === "hooks");

    /** The Library on ROWS, then "hooks" typed: its request is out and held. */
    async function searchHooks(first: Promise<LibraryPage>, later: () => LibraryPage) {
      await renderRows();
      hooksAnswers = [first];
      books.hooks = { "": () => hooksAnswers.shift() ?? Promise.resolve(later()) };
      fireEvent.change(searchField(), { target: { value: "hooks" } });
      await waitFor(() => expect(hooksCalls()).toHaveLength(1));
      // Still the rows before, kept while the search loads.
      expect(chatList()).toHaveAttribute("aria-busy", "true");
      expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]);
    }
    const JUNE = plain("c8", "Hooks for June");

    it("Delete: the row leaves at once; the search's answer still holds it, so it is asked for again, and ends without it", async () => {
      const first = deferred<LibraryPage>();
      await searchHooks(first.promise, () => ({ chats: [JUNE], next: null }));
      const deleted = deferred<number>();
      onThread = () => deleted.promise;

      remove("Gym hooks");
      await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas", "Just talking"]));

      // The search answers as it was asked, before the delete: the chat is still in it.
      await act(async () => first.resolve({ chats: [ROWS[0]!, JUNE], next: null }));
      await waitFor(() => expect(chatList()).not.toHaveAttribute("aria-busy"));
      expect(rowTitles()).toEqual(["Hooks for June"]);

      await act(async () => deleted.resolve(200));
      await waitFor(() => expect(hooksCalls()).toHaveLength(2));
      await settle();
      expect(rowTitles()).toEqual(["Hooks for June"]);
      expect(screen.queryByRole("button", { name: "More: Gym hooks" })).toBeNull();
      expect(threadCalls()).toEqual([{ method: "DELETE", path: "/api/threads/c1", body: undefined }]);
    });

    it("…the delete answered before the search: the search is asked again all the same, and ends without it", async () => {
      const first = deferred<LibraryPage>();
      await searchHooks(first.promise, () => ({ chats: [JUNE], next: null }));

      remove("Gym hooks");
      await waitFor(() => expect(hooksCalls()).toHaveLength(2));
      // The first answer, late, holds the chat: it is not the one the list keeps.
      await act(async () => first.resolve({ chats: [ROWS[0]!, JUNE], next: null }));
      await settle();
      expect(rowTitles()).toEqual(["Hooks for June"]);
    });

    it("a refused Delete puts the row back, and the search is not asked again", async () => {
      const first = deferred<LibraryPage>();
      await searchHooks(first.promise, () => ({ chats: [JUNE], next: null }));
      onThread = () => 500;

      remove("Gym hooks");
      expect(await toastSays("Couldn't delete that chat.")).toBeInTheDocument();
      await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]));

      await act(async () => first.resolve({ chats: [ROWS[0]!, JUNE], next: null }));
      await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Hooks for June"]));
      await settle();
      expect(hooksCalls()).toHaveLength(1);
    });

    it("Rename: the new title shows at once and survives the search's answer", async () => {
      const first = deferred<LibraryPage>();
      const renamed: LibraryChat = { ...ROWS[0]!, title: "Leg day hooks" };
      await searchHooks(first.promise, () => ({ chats: [renamed, JUNE], next: null }));
      const answer = deferred<number>();
      onThread = () => answer.promise;

      rename("Gym hooks", "Leg day hooks");
      await waitFor(() => expect(rowTitles()).toEqual(["Leg day hooks", "Meal ideas", "Just talking"]));

      // The search answers with the title as it was when it was asked.
      await act(async () => first.resolve({ chats: [ROWS[0]!, JUNE], next: null }));
      await waitFor(() => expect(chatList()).not.toHaveAttribute("aria-busy"));
      expect(rowTitles()).toEqual(["Leg day hooks", "Hooks for June"]);

      await act(async () => answer.resolve(200));
      await waitFor(() => expect(hooksCalls()).toHaveLength(2));
      await settle();
      expect(rowTitles()).toEqual(["Leg day hooks", "Hooks for June"]);
    });

    it("a refused Rename puts the old title back on the rows", async () => {
      const first = deferred<LibraryPage>();
      await searchHooks(first.promise, () => ({ chats: [ROWS[0]!, JUNE], next: null }));
      onThread = () => 500;

      rename("Gym hooks", "Leg day hooks");
      expect(await toastSays("Couldn't rename that chat.")).toBeInTheDocument();
      expect(rowTitles()).toEqual(["Gym hooks", "Meal ideas", "Just talking"]);
      await act(async () => first.resolve({ chats: [ROWS[0]!, JUNE], next: null }));
      await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Hooks for June"]));
    });
  });

  // ─── Pinned chats first ─────────────────────────────────────────────────────

  // The endpoint lists the pinned chats first, then the others by last message. A pin or an unpin
  // from a row's More moves the row there at once, in every list the cache holds.
  describe("pinned chats first", () => {
    const timed = (c: LibraryChat, hours: number, pinned = false): LibraryChat => ({ ...c, updatedAt: ago(hours), pinned });
    // By last message, newest first.
    const T1 = timed(plain("t1", "Newest"), 1);
    const T2 = timed(simulated("t2", "Gym hooks"), 2);
    const T3 = timed(draft("t3", "Meal ideas"), 5);
    const T4 = timed(plain("t4", "Just talking"), 30);
    const BY_TIME = [T1, T2, T3, T4];
    const ALL_KEY = ["library", "chats", ""];
    const allChats = () => client.getQueryData<{ pages: LibraryPage[] }>(ALL_KEY)?.pages.flatMap((page) => page.chats);
    const pinsOf = (chats: LibraryChat[] | undefined) => chats?.map((c) => [c.id, c.pinned]);
    const row = (title: string) => screen.getByRole("button", { name: title });
    /** Twelve chats written to in the last twelve hours: a full screen, so no page comes on its own. */
    const RECENT = Array.from({ length: 12 }, (_, i) => timed(plain(`r${i}`, `Recent ${i}`), i + 1));
    const recentTitles = RECENT.map((c) => c.title!);

    it("Pin: the row is first at once, with its mark, in every list that shows it; the list read again keeps it there", async () => {
      await renderRows(BY_TIME);
      client.setQueryData(SEARCH_KEY, { pages: [{ chats: [T1, T3], next: null }], pageParams: [null] });
      const answer = deferred<number>();
      onThread = () => answer.promise;

      pin("Meal ideas");

      await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas", "Newest", "Gym hooks", "Just talking"]));
      expect(row("Meal ideas")).toHaveAccessibleDescription("Pinned, Script · 5h ago");
      expect(pinsOf(recentChats())).toEqual([["t3", true], ["t1", false], ["t2", false], ["t4", false]]);
      expect(searchChats()?.map((c) => c.id)).toEqual(["t3", "t1"]);
      await settle();
      expect(moreOf("Meal ideas")).toHaveFocus();

      // From now on the server lists it first.
      books[""] = bookOf([[{ ...T3, pinned: true }, T1, T2, T4]]);
      const asked = libraryCalls().length;
      await act(async () => answer.resolve(200));
      // Once answered the list on screen is read again; it stays first.
      await waitFor(() => expect(libraryCalls()).toHaveLength(asked + 1));
      await settle();
      expect(rowTitles()).toEqual(["Meal ideas", "Newest", "Gym hooks", "Just talking"]);
      expect(row("Meal ideas")).toHaveAccessibleDescription(/^Pinned, /);
      expect(moreOf("Meal ideas")).toHaveFocus();
      // Home's page and the search, off screen, are only marked old.
      expect(invalidated(RECENT_KEY)).toBe(true);
      expect(invalidated(SEARCH_KEY)).toBe(true);
      expect(libraryCalls()).toHaveLength(asked + 1);
    });

    it("Unpin: the mark goes and the row moves at once to its place by last message, in every list; the focus stays on its More", async () => {
      const P = timed(plain("p1", "Morning check-in"), 4, true);
      await renderRows([P, ...BY_TIME]);
      const answer = deferred<number>();
      onThread = () => answer.promise;

      pin("Morning check-in", "Unpin");

      await waitFor(() => expect(rowTitles()).toEqual(["Newest", "Gym hooks", "Morning check-in", "Meal ideas", "Just talking"]));
      expect(row("Morning check-in")).toHaveAccessibleDescription("Chat · 4h ago");
      expect(pinsOf(recentChats())).toEqual([["t1", false], ["t2", false], ["p1", false], ["t3", false], ["t4", false]]);
      await settle();
      expect(moreOf("Morning check-in")).toHaveFocus();

      books[""] = bookOf([[T1, T2, { ...P, pinned: false }, T3, T4]]);
      await act(async () => answer.resolve(200));
      await settle();
      expect(rowTitles()).toEqual(["Newest", "Gym hooks", "Morning check-in", "Meal ideas", "Just talking"]);
      expect(moreOf("Morning check-in")).toHaveFocus();
      expect(threadCalls()).toEqual([{ method: "PATCH", path: "/api/threads/p1", body: { pinned: false } }]);
    });

    it("Unpin of a chat older than every loaded one, with no older page: it goes last", async () => {
      const old = timed(plain("p-old", "Summer plan"), 24 * 60, true);
      await renderRows([old, ...BY_TIME]);
      books[""] = bookOf([[...BY_TIME, { ...old, pinned: false }]]);
      pin("Summer plan", "Unpin");
      await waitFor(() => expect(rowTitles()).toEqual(["Newest", "Gym hooks", "Meal ideas", "Just talking", "Summer plan"]));
      await settle();
      expect(moreOf("Summer plan")).toHaveFocus();
    });

    it("Unpin of a chat older than every loaded one while older pages exist: it leaves the list, and comes back with its page", async () => {
      const old = timed(plain("p-old", "Summer plan"), 24 * 60, true);
      const older = [timed(plain("o1", "Autumn plan"), 24 * 30), timed(plain("p-old", "Summer plan"), 24 * 60), timed(plain("o2", "Spring plan"), 24 * 90)];
      books = { "": { "": { chats: [old, ...RECENT], next: "cursor-1" }, "cursor-1": { chats: older, next: null } } };
      renderLibrary();
      await waitFor(() => expect(rowTitles()).toHaveLength(13));
      // The server once the unpin is in (the list on screen is read again then).
      books[""]![""] = { chats: RECENT, next: "cursor-1" };

      pin("Summer plan", "Unpin");

      await waitFor(() => expect(rowTitles()).toEqual(recentTitles));
      await settle();
      // Its row left: the focus is handed on to the row now in its place, as when a row is deleted.
      expect(row("Recent 0")).toHaveFocus();
      // No older page came on its own: the list still holds a screenful.
      expect(libraryCalls().filter((url) => url.searchParams.get("cursor") === "cursor-1")).toHaveLength(0);

      fireEvent.click(showMore()!);
      await waitFor(() => expect(rowTitles()).toEqual([...recentTitles, "Autumn plan", "Summer plan", "Spring plan"]));
      expect(row("Summer plan")).not.toHaveAccessibleDescription(/^Pinned, /);
    });

    it("a refused pin puts the row back where it was, without the mark, in every list; the focus stays on its More", async () => {
      await renderRows(BY_TIME);
      const answer = deferred<number>();
      onThread = () => answer.promise;

      pin("Meal ideas");
      await waitFor(() => expect(rowTitles()).toEqual(["Meal ideas", "Newest", "Gym hooks", "Just talking"]));
      await settle();
      expect(moreOf("Meal ideas")).toHaveFocus();

      await act(async () => answer.resolve(500));
      expect(await toastSays("Couldn't pin that chat.")).toBeInTheDocument();
      await waitFor(() => expect(rowTitles()).toEqual(["Newest", "Gym hooks", "Meal ideas", "Just talking"]));
      expect(row("Meal ideas")).toHaveAccessibleDescription("Script · 5h ago");
      expect(pinsOf(recentChats())).toEqual([["t1", false], ["t2", false], ["t3", false], ["t4", false]]);
      await settle();
      expect(moreOf("Meal ideas")).toHaveFocus();
    });

    it("a refused unpin puts the row back where it was among the pinned, with its mark, in every list; the focus stays on its More", async () => {
      const P1 = timed(plain("p1", "Pinned today"), 24 * 20, true);
      const P2 = timed(plain("p2", "Pinned last week"), 24 * 40, true);
      await renderRows([P1, P2, ...BY_TIME]);
      const answer = deferred<number>();
      onThread = () => answer.promise;

      pin("Pinned last week", "Unpin");
      await waitFor(() => expect(rowTitles()).toEqual(["Pinned today", "Newest", "Gym hooks", "Meal ideas", "Just talking", "Pinned last week"]));
      await settle();
      expect(moreOf("Pinned last week")).toHaveFocus();

      await act(async () => answer.resolve(500));
      expect(await toastSays("Couldn't unpin that chat.")).toBeInTheDocument();
      await waitFor(() => expect(rowTitles()).toEqual(["Pinned today", "Pinned last week", "Newest", "Gym hooks", "Meal ideas", "Just talking"]));
      expect(row("Pinned last week")).toHaveAccessibleDescription(/^Pinned, /);
      expect(pinsOf(recentChats())).toEqual([
        ["p1", true],
        ["p2", true],
        ["t1", false],
        ["t2", false],
        ["t3", false],
        ["t4", false],
      ]);
      await settle();
      expect(moreOf("Pinned last week")).toHaveFocus();
    });

    it("a chat on two pages (pinned on the first, in its place on a later one) is one row, the first; its unpin puts it in that place", async () => {
      const old = timed(plain("p-old", "Summer plan"), 24 * 60, true);
      // A later page lists a pinned chat in its place by last message.
      const later = [timed(plain("o1", "Autumn plan"), 24 * 30), old, timed(plain("o2", "Spring plan"), 24 * 90)];
      books = { "": { "": { chats: [old, ...RECENT], next: "cursor-1" }, "cursor-1": { chats: later, next: null } } };
      renderLibrary();
      await waitFor(() => expect(rowTitles()).toHaveLength(13));
      fireEvent.click(showMore()!);
      await waitFor(() => expect(rowTitles()).toEqual(["Summer plan", ...recentTitles, "Autumn plan", "Spring plan"]));
      expect(screen.getAllByRole("button", { name: "Summer plan" })).toHaveLength(1);

      books[""] = { "": { chats: RECENT, next: "cursor-1" }, "cursor-1": { chats: [later[0]!, { ...old, pinned: false }, later[2]!], next: null } };
      pin("Summer plan", "Unpin");
      await waitFor(() => expect(rowTitles()).toEqual([...recentTitles, "Autumn plan", "Summer plan", "Spring plan"]));
      expect(screen.getAllByRole("button", { name: "Summer plan" })).toHaveLength(1);
      await settle();
      expect(moreOf("Summer plan")).toHaveFocus();
    });

    it("a pin made under a search: first in that search's list at once, and in the full list's", async () => {
      const G1 = timed(plain("g1", "Gym hooks, week 1"), 1);
      const G2 = timed(plain("g2", "Gym playlist"), 3);
      const G3 = timed(plain("g3", "Gym routine"), 8);
      books = { "": bookOf([[T1, G1, G2, G3, T4]]), gym: bookOf([[G1, G2, G3]]) };
      client.setQueryData(ALL_KEY, { pages: [{ chats: [T1, G1, G2, G3, T4], next: null }], pageParams: [null] });
      renderLibrary({ filter: "all", q: "gym" });
      await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks, week 1", "Gym playlist", "Gym routine"]));
      const answer = deferred<number>();
      onThread = () => answer.promise;
      books = { "": bookOf([[{ ...G3, pinned: true }, T1, G1, G2, T4]]), gym: bookOf([[{ ...G3, pinned: true }, G1, G2]]) };

      pin("Gym routine");

      await waitFor(() => expect(rowTitles()).toEqual(["Gym routine", "Gym hooks, week 1", "Gym playlist"]));
      expect(pinsOf(allChats())).toEqual([["g3", true], ["t1", false], ["g1", false], ["g2", false], ["t4", false]]);
      await settle();
      expect(moreOf("Gym routine")).toHaveFocus();
      await act(async () => answer.resolve(200));
      await settle();
      expect(rowTitles()).toEqual(["Gym routine", "Gym hooks, week 1", "Gym playlist"]);
    });

    it("a pin made under the Simulated chip: first under it at once, and first under All", async () => {
      const S1 = timed(simulated("s1", "Hooks for June"), 2);
      const S2 = timed(simulated("s2", "Hooks for May"), 6);
      books = { "": bookOf([[T1, S1, T3, S2, T4]]) };
      renderLibrary({ filter: "simulated", q: "" });
      await waitFor(() => expect(rowTitles()).toEqual(["Hooks for June", "Hooks for May"]));
      books[""] = bookOf([[{ ...S2, pinned: true }, T1, S1, T3, T4]]);

      pin("Hooks for May");

      await waitFor(() => expect(rowTitles()).toEqual(["Hooks for May", "Hooks for June"]));
      await settle();
      expect(moreOf("Hooks for May")).toHaveFocus();
      fireEvent.click(chip("All"));
      await waitFor(() => expect(rowTitles()).toEqual(["Hooks for May", "Newest", "Hooks for June", "Meal ideas", "Just talking"]));
    });

    it("a pin while a search is still loading: first at once on the rows shown, and still first through the search's answer", async () => {
      await renderRows(BY_TIME);
      const JUNE = timed(plain("c8", "Hooks for June"), 1);
      const asAsked = deferred<LibraryPage>();
      const answers: Array<Promise<LibraryPage>> = [asAsked.promise];
      // Asked again once the pin is answered: the server lists it first by then.
      books.hooks = { "": () => answers.shift() ?? Promise.resolve({ chats: [{ ...T2, pinned: true }, JUNE], next: null }) };
      const hooksCalls = () => libraryCalls().filter((url) => url.searchParams.get("q") === "hooks");
      fireEvent.change(searchField(), { target: { value: "hooks" } });
      await waitFor(() => expect(hooksCalls()).toHaveLength(1));
      expect(chatList()).toHaveAttribute("aria-busy", "true");
      const pinned = deferred<number>();
      onThread = () => pinned.promise;

      pin("Gym hooks");

      // The rows shown are the list before's, kept while the search loads: the row is first on them.
      await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Newest", "Meal ideas", "Just talking"]));
      expect(row("Gym hooks")).toHaveAccessibleDescription(/^Pinned, /);
      await settle();
      expect(moreOf("Gym hooks")).toHaveFocus();
      // The search answers as it was asked, before the pin.
      await act(async () => asAsked.resolve({ chats: [JUNE, T2], next: null }));
      await waitFor(() => expect(chatList()).not.toHaveAttribute("aria-busy"));
      expect(rowTitles()).toEqual(["Gym hooks", "Hooks for June"]);
      expect(row("Gym hooks")).toHaveAccessibleDescription(/^Pinned, /);

      await act(async () => pinned.resolve(200));
      await waitFor(() => expect(hooksCalls()).toHaveLength(2));
      await settle();
      expect(rowTitles()).toEqual(["Gym hooks", "Hooks for June"]);
      expect(row("Gym hooks")).toHaveAccessibleDescription(/^Pinned, /);
      expect(moreOf("Gym hooks")).toHaveFocus();
    });

    // Once a pin or an unpin is answered, either way, the lists on screen are read again: the
    // server's order lands. The rows stay on screen meanwhile.
    describe("the list read again once a pin or an unpin is answered", () => {
      const firstPageCalls = () => libraryCalls().filter((url) => !url.searchParams.get("cursor") && !url.searchParams.get("q"));
      const nextPageCalls = () => libraryCalls().filter((url) => url.searchParams.get("cursor") === "cursor-1");
      const OLDER = [timed(plain("o1", "Autumn plan"), 24 * 30), timed(plain("o2", "Spring plan"), 24 * 90)];

      it("an unpin the rule took out of the list (first page only, the chat among its newest, every listed chat newer) is listed at its place", async () => {
        // On the server the chat is the first page's thirteenth by last message: its place is on the
        // page, after every chat the page lists by last message. The rule cannot see that.
        const X = timed(plain("x", "Thirteen hours ago"), 13, true);
        books = { "": { "": { chats: [X, ...RECENT], next: "cursor-1" }, "cursor-1": { chats: OLDER, next: null } } };
        client.setQueryData(RECENT_KEY, { chats: [X, ...RECENT], next: "cursor-1" });
        renderLibrary();
        await waitFor(() => expect(rowTitles()).toHaveLength(13));
        const answer = deferred<number>();
        onThread = () => answer.promise;

        pin("Thirteen hours ago", "Unpin");
        await waitFor(() => expect(rowTitles()).toEqual(recentTitles));
        await settle();
        expect(row("Recent 0")).toHaveFocus();
        expect(firstPageCalls()).toHaveLength(1);

        // The server, once the unpin is in; its answer held, to see the rows meanwhile.
        const reread = deferred<LibraryPage>();
        books[""]![""] = () => reread.promise;
        await act(async () => answer.resolve(200));
        await waitFor(() => expect(firstPageCalls()).toHaveLength(2));
        expect(rowTitles()).toEqual(recentTitles);
        expect(chatList()).not.toHaveAttribute("aria-busy");
        expect(chatList().querySelectorAll("[data-part=placeholder]")).toHaveLength(0);

        await act(async () => reread.resolve({ chats: [...RECENT, { ...X, pinned: false }], next: "cursor-1" }));
        await waitFor(() => expect(rowTitles()).toEqual([...recentTitles, "Thirteen hours ago"]));
        expect(row("Thirteen hours ago")).toHaveAccessibleDescription("Chat · 13h ago");
        expect(row("Recent 0")).toHaveFocus();
        await settle();
        // Only the list on screen: Home's page stays marked old, unread.
        expect(firstPageCalls()).toHaveLength(2);
        expect(invalidated(RECENT_KEY)).toBe(true);
        fireEvent.click(showMore()!);
        await waitFor(() => expect(rowTitles()).toEqual([...recentTitles, "Thirteen hours ago", "Autumn plan", "Spring plan"]));
      });

      it("a refused unpin ends in the server's order once read again; the focus stays on its More", async () => {
        const P1 = timed(plain("p1", "Pinned today"), 24 * 20, true);
        const P2 = timed(plain("p2", "Pinned last week"), 24 * 40, true);
        await renderRows([P1, P2, ...BY_TIME]);
        // Since the list was read, another device pinned "Gym hooks": the server lists it first.
        books[""] = bookOf([[{ ...T2, pinned: true }, P1, P2, T1, T3, T4]]);
        onThread = () => 500;

        pin("Pinned last week", "Unpin");

        expect(await toastSays("Couldn't unpin that chat.")).toBeInTheDocument();
        await waitFor(() => expect(rowTitles()).toEqual(["Gym hooks", "Pinned today", "Pinned last week", "Newest", "Meal ideas", "Just talking"]));
        expect(row("Pinned last week")).toHaveAccessibleDescription(/^Pinned, /);
        expect(row("Gym hooks")).toHaveAccessibleDescription(/^Pinned, /);
        await settle();
        expect(moreOf("Pinned last week")).toHaveFocus();
      });

      it("a Show more on its way when the list is read again is not lost: its page lands, then every page is read", async () => {
        const X = timed(plain("x", "Summer plan"), 24 * 60, true);
        const heldPage = deferred<LibraryPage>();
        let nextAsked = 0;
        books = {
          "": {
            "": { chats: [X, ...RECENT], next: "cursor-1" },
            "cursor-1": () => (++nextAsked === 1 ? heldPage.promise : Promise.resolve({ chats: OLDER, next: null })),
          },
        };
        renderLibrary();
        await waitFor(() => expect(rowTitles()).toHaveLength(13));
        const answer = deferred<number>();
        onThread = () => answer.promise;

        pin("Recent 3");
        await waitFor(() => expect(rowTitles()[0]).toBe("Recent 3"));
        // Show more, while the pin is out; its page held.
        fireEvent.click(showMore()!);
        await waitFor(() => expect(nextPageCalls()).toHaveLength(1));
        books[""]![""] = { chats: [{ ...RECENT[3]!, pinned: true }, X, ...RECENT.filter((_, i) => i !== 3)], next: "cursor-1" };
        await act(async () => answer.resolve(200));
        await settle();

        await act(async () => heldPage.resolve({ chats: OLDER, next: null }));
        await waitFor(() => expect(nextPageCalls()).toHaveLength(2));
        await waitFor(() =>
          expect(rowTitles()).toEqual(["Recent 3", "Summer plan", ...recentTitles.filter((_, i) => i !== 3), "Autumn plan", "Spring plan"]),
        );
        expect(firstPageCalls()).toHaveLength(2);
        expect(moreOf("Recent 3")).toHaveFocus();
      });

      it("a Show more tapped while the list is read again calls that read off: once its page is in, the list is read again", async () => {
        const X = timed(plain("x", "Summer plan"), 24 * 60, true);
        books = { "": { "": { chats: [X, ...RECENT], next: "cursor-1" }, "cursor-1": { chats: OLDER, next: null } } };
        renderLibrary();
        await waitFor(() => expect(rowTitles()).toHaveLength(13));
        const answer = deferred<number>();
        onThread = () => answer.promise;
        pin("Recent 3");
        await waitFor(() => expect(rowTitles()[0]).toBe("Recent 3"));

        // The server, once the pin is in. Its first answer held: the read is still out when Show more is tapped.
        const after = { chats: [{ ...RECENT[3]!, pinned: true }, X, ...RECENT.filter((_, i) => i !== 3)], next: "cursor-1" };
        const firstRead = deferred<LibraryPage>();
        let firstAsked = 0;
        books[""]![""] = () => (++firstAsked === 1 ? firstRead.promise : Promise.resolve(after));
        await act(async () => answer.resolve(200));
        await waitFor(() => expect(firstPageCalls()).toHaveLength(2));
        fireEvent.click(showMore()!);
        await waitFor(() => expect(nextPageCalls()).toHaveLength(1));
        // The called-off read answers late: it is not what the list keeps.
        await act(async () => firstRead.resolve({ chats: [X, ...RECENT], next: "cursor-1" }));

        await waitFor(() => expect(firstPageCalls()).toHaveLength(3));
        await waitFor(() =>
          expect(rowTitles()).toEqual(["Recent 3", "Summer plan", ...recentTitles.filter((_, i) => i !== 3), "Autumn plan", "Spring plan"]),
        );
        await settle();
        expect(firstPageCalls()).toHaveLength(3);
      });

      it("a pin answered while a rename is still out waits for it: the list is read once, after both", async () => {
        await renderRows(BY_TIME);
        const renamed = deferred<number>();
        onThread = (_method, _id, body) => ((body as { title?: string }).title !== undefined ? renamed.promise : 200);
        rename("Just talking", "Talking shop");
        await screen.findByRole("button", { name: "Talking shop" });
        books[""] = bookOf([[{ ...T3, pinned: true }, T1, T2, { ...T4, title: "Talking shop" }]]);
        pin("Meal ideas");
        await waitFor(() => expect(rowTitles()[0]).toBe("Meal ideas"));
        await settle();
        // The pin is answered, the rename is not: a read now would land without the rename.
        expect(firstPageCalls()).toHaveLength(1);

        await act(async () => renamed.resolve(200));
        await waitFor(() => expect(firstPageCalls()).toHaveLength(2));
        await settle();
        expect(rowTitles()).toEqual(["Meal ideas", "Newest", "Gym hooks", "Talking shop"]);
        expect(firstPageCalls()).toHaveLength(2);
      });

      it("nothing is read again after a rename, nor after a delete", async () => {
        await renderRows(BY_TIME);
        rename("Gym hooks", "Leg day hooks");
        await screen.findByRole("button", { name: "Leg day hooks" });
        await settle();
        remove("Just talking");
        await waitFor(() => expect(rowTitles()).toEqual(["Newest", "Leg day hooks", "Meal ideas"]));
        await settle();
        expect(firstPageCalls()).toHaveLength(1);
      });
    });

    // The pure function the change goes through, on the cache's two shapes.
    describe("withPin", () => {
      const ids = (data: unknown) => (data as { pages: LibraryPage[] }).pages.map((page) => page.chats.map((c) => (c.pinned ? `${c.id}*` : c.id)));
      const paged = (...pages: Array<[LibraryChat[], string | null]>) => ({
        pages: pages.map(([chats, next]) => ({ chats, next })),
        pageParams: pages.map((_, i) => (i === 0 ? null : `cursor-${i}`)),
      });
      const P = timed(plain("p", "Pinned"), 24 * 9, true);
      const Q = timed(plain("q", "Also pinned"), 24 * 3, true);

      it("is the entry itself when it does not hold the chat; Home's one page is moved like a search's pages", () => {
        const entry = paged([BY_TIME, null]);
        expect(withPin(entry, "nope", true)).toBe(entry);
        const home: LibraryPage = { chats: BY_TIME, next: "cursor-1" };
        expect((withPin(home, "t3", true) as LibraryPage).chats.map((c) => c.id)).toEqual(["t3", "t1", "t2", "t4"]);
        expect(withPin(home, "nope", false)).toBe(home);
      });

      it("an unpin skips the pinned head and goes before the first chat it comes before; the same time: the larger id first", () => {
        const twin = { ...timed(plain("t0", "Twin"), 0), updatedAt: T2.updatedAt };
        const entry = paged([[Q, P, T1, T2, T3], null]);
        expect(ids(withPin(entry, "p", false))).toEqual([["q*", "t1", "t2", "t3", "p"]]);
        const moved = withPin(paged([[{ ...twin, pinned: true }, T1, T2, T3], null]), "t0", false);
        // "t2" is the larger id at the same time: it comes first.
        expect(ids(moved)).toEqual([["t1", "t2", "t0", "t3"]]);
      });

      it("pages that do not change keep their objects", () => {
        const entry = paged([[P, T1, T2], "cursor-1"], [[T3, T4], null]);
        const pinned = withPin(entry, "t2", true) as { pages: LibraryPage[] };
        expect(ids(pinned)).toEqual([["t2*", "p*", "t1"], ["t3", "t4"]]);
        expect(pinned.pages[1]).toBe(entry.pages[1]);
      });
    });
  });

  // The sheet stays pressable while it closes.
  it("two quick taps on Pin send one request", async () => {
    await renderRows();
    books[""] = bookOf([[{ ...ROWS[1]!, pinned: true }, ROWS[0]!, ROWS[2]!]]);
    openMenu("Meal ideas");
    const pinItem = inSheet("Meal ideas", "Pin");
    act(() => {
      pinItem.click();
      pinItem.click();
    });
    await settle();
    expect(threadCalls()).toEqual([{ method: "PATCH", path: "/api/threads/c2", body: { pinned: true } }]);
    expect(screen.getByRole("button", { name: "Meal ideas" })).toHaveAccessibleDescription("Pinned, Script · 1d ago");
  });

  // An action calls off a page on its way (its answer would undo the change); a "Show
  // more" the creator tapped is asked for again once the change is in.
  it("a Show more on its way, called off by an action, is asked for again", async () => {
    const page1 = mixed(1, 2); // 30 rows: no page comes on its own
    const page2 = [plain("p2-c0"), plain("p2-c1")];
    const held = deferred<LibraryPage>();
    let asked = 0;
    books = {
      "": {
        "": { chats: page1, next: "cursor-1" },
        "cursor-1": () => (++asked === 1 ? held.promise : Promise.resolve({ chats: page2, next: null })),
      },
    };
    renderLibrary();
    await waitFor(() => expect(rowTitles()).toHaveLength(30));
    const nextPageCalls = () => libraryCalls().filter((url) => url.searchParams.get("cursor") === "cursor-1");

    fireEvent.click(showMore()!);
    await waitFor(() => expect(nextPageCalls()).toHaveLength(1));

    // The server once the pin is in (the list on screen is read again then, both pages).
    (books[""] as Book)[""] = { chats: [{ ...page1[2]!, pinned: true }, ...page1.filter((_, i) => i !== 2)], next: "cursor-1" };
    pin("Plain p1-c0");
    await waitFor(() => expect(nextPageCalls().length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(rowTitles()).toHaveLength(32));
    expect(rowTitles().slice(-2)).toEqual(["Plain p2-c0", "Plain p2-c1"]);
    expect(screen.getByRole("button", { name: "Plain p1-c0" })).toHaveAccessibleDescription(/^Pinned, /);
    await act(async () => held.resolve({ chats: page2, next: null }));
    await settle();
    expect(rowTitles()).toHaveLength(32);
  });
});
