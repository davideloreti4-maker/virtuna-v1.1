/** @vitest-environment happy-dom */

/**
 * LibraryNext after posting (plan 2026-11-24-after-posting, Task 4): the Posted chip and its address, a
 * posted chat's row, the row menu's posted item with the real sheet (`PostedSheet`) and the real hooks
 * (`use-posted`), and the one read of the posts' numbers a visit asks for. The real screen, the real
 * `useLibraryChats` through TanStack Query, the app's real toasts. Stand-ins only at the edges, as in
 * `library-next.test.tsx`: `fetch` (the Library endpoint and the posted routes), the router, `matchMedia`
 * (a phone), the build-time flag. Every handle and id is made up (the repository is public).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { LibraryChat, LibraryPage, LibrarySim, LibrarySummary } from "@/lib/library/library-page";
import type { LibraryView } from "@/lib/library/library-view";
import type { Posted } from "@/lib/posted/posted";
import { clearActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { whenLabel } from "@/lib/time-ago";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

import { atWidth, postedPiece, readingPiece, soFarPiece, unreadPiece } from "./posted-chats";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };

/** The address's parameters as Next keeps them (see `library-next.test.tsx`). */
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

import { LibraryNext } from "../library-next";
import { DEFAULT_LIBRARY_VIEW, libraryHref } from "@/lib/library/library-view";

const nativeReplaceState = window.history.replaceState.bind(window.history);
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
}
const address = () => window.location.pathname + window.location.search;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const NONE: LibrarySummary["counts"] = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

const textSim = (id: string): LibrarySim => ({
  number: 67,
  measure: "stop",
  at: ago(30),
  kind: "hooks",
  link: { type: "text", key: `key-${id}`, as: "hook" },
});
const videoSim = (id: string): LibrarySim => ({
  number: 46,
  measure: "end",
  at: ago(30),
  kind: "video",
  link: { type: "video", analysisId: `run-${id}` },
});

function chat(id: string, title: string, summary: Partial<LibrarySummary>): LibraryChat {
  return {
    id,
    title,
    updatedAt: ago(3),
    pinned: false,
    summary: { counts: NONE, lead: "chat", stage: "chat", sim: null, frame: null, videoPath: null, posted: null, ...summary },
  };
}
const simulatedChat = (id: string, title: string) =>
  chat(id, title, { counts: { ...NONE, hooks: 5 }, lead: "hooks", stage: "simulated", sim: textSim(id) });
const videoChat = (id: string, title: string) =>
  chat(id, title, { counts: { ...NONE, videos: 1 }, lead: "video", stage: "simulated", sim: videoSim(id) });
const postedChat = (id: string, title: string, piece: Posted) =>
  chat(id, title, { counts: { ...NONE, hooks: 5 }, lead: "hooks", stage: "posted", sim: textSim(id), posted: { ...piece, id: `post-${id}`, threadId: id } });
const draftChat = (id: string, title: string) => chat(id, title, { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "draft" });
const plainChat = (id: string, title: string) => chat(id, title, {});

// ─── The server ──────────────────────────────────────────────────────────────

/** What `/api/threads/library` answers (one page, no next), read at each request. */
let page: () => LibraryChat[] = () => [];
/** How `/api/posted/refresh` answers: its rows, or a status. */
let onRefresh: (body: unknown) => Posted[] | number | Promise<Posted[] | number> = () => [];
/** How `/api/posted/{id}` answers a DELETE: a status. */
let onRemove: (id: string) => number | Promise<number> = () => 204;
/** How `POST /api/posted` answers an add: the new link, or a status. */
let onAdd: (body: Record<string, unknown>) => Posted | number = () => readingPiece();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
  if (url.pathname === "/api/threads/library") return json({ chats: page(), next: null } satisfies LibraryPage);
  if (url.pathname === "/api/posted/refresh" && method === "POST") {
    const answer = await onRefresh(body);
    return typeof answer === "number" ? json({}, answer) : json({ posted: answer });
  }
  if (url.pathname === "/api/posted" && method === "POST") {
    const answer = onAdd(body!);
    return typeof answer === "number" ? json({ error: "failed" }, answer) : json({ posted: answer }, 201);
  }
  const one = /^\/api\/posted\/([^/]+)$/.exec(url.pathname);
  if (one && method === "DELETE") {
    const status = await onRemove(decodeURIComponent(one[1]!));
    return status === 204 ? new Response(null, { status }) : json({ error: "not_found" }, status);
  }
  return json({}, 404);
});

const calls = () =>
  fetchMock.mock.calls.map(([input, init]) => ({
    method: init?.method ?? "GET",
    path: new URL(String(input), "http://localhost").pathname,
    body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
  }));
const libraryCalls = () => calls().filter((call) => call.path === "/api/threads/library");
const refreshCalls = () => calls().filter((call) => call.path === "/api/posted/refresh");
const postedWrites = () => calls().filter((call) => call.path.startsWith("/api/posted") && call.path !== "/api/posted/refresh");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Lets every request the screen makes on its own go out and come back. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 80)));

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;
/** The page is drawn as on a phone (`matchMedia` says so below): the line's phone form. */
let removeWidth: () => void = () => {};

function renderLibrary(view: LibraryView = DEFAULT_LIBRARY_VIEW) {
  setAddress(libraryHref(view));
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryNext />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const chatList = () => screen.getByRole("list", { name: "Chats" });
const rowTitles = () =>
  within(chatList())
    .queryAllByRole("button")
    .filter((button) => button.parentElement?.tagName === "LI")
    .map((button) => document.getElementById(button.getAttribute("aria-labelledby")!)!.textContent);
const rowButton = (title: string) => screen.getByRole("button", { name: title });
const chip = (name: string) => within(screen.getByRole("group", { name: "Filter" })).getByRole("button", { name });
const moreOf = (title: string) => screen.getByRole("button", { name: `More: ${title}` });
const menu = (title: string) => screen.getByRole("dialog", { name: title });
/** The menu's items, top to bottom (its rows, not its header's Close). */
const menuItems = (title: string) => Array.from(menu(title).querySelectorAll('[data-part="menu-row"] button')).map((button) => button.textContent);
const openMenu = (title: string) => {
  moreOf(title).focus();
  fireEvent.click(moreOf(title));
};
const sheet = () => screen.getByRole("dialog", { name: "Posted it?" });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false } } });
  page = () => [];
  onRefresh = () => [];
  onRemove = () => 204;
  onAdd = () => readingPiece();
  setAddress("/library");
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplaceState(data, unused, url);
    if (url != null) nav.set(new URL(String(url), "http://localhost").search);
  });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
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
  removeWidth = atWidth("phone");
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  useShellStore.setState({ threadOpen: false, threadBack: null, threadTitleHint: null, libraryScroll: null });
});

afterEach(() => {
  // Nothing here spends credits: no request to a paid route, in any test.
  const paid = calls().filter((call) => call.path.startsWith("/api/tools/") || call.path.startsWith("/api/analyze"));
  expect(paid).toEqual([]);
  cleanup();
  removeWidth();
  vi.useRealTimers();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── The chip and its address ────────────────────────────────────────────────

describe("LibraryNext — the Posted chip", () => {
  const ROWS = [
    simulatedChat("s1", "Gym hooks"),
    postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
    draftChat("d1", "Morning script"),
    postedChat("p2", "Lentils, three ways", readingPiece()),
    plainChat("c1", "Just talking"),
  ];

  it("Posted lists the posted chats only; Simulated no longer lists them; All lists every chat", async () => {
    page = () => ROWS;
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    expect(rowTitles()).toEqual(["Gym hooks", "Stop buying snacks, do this", "Morning script", "Lentils, three ways", "Just talking"]);
    // (The reading chat is owed a read: the visit's one read, and the list asked for again after it.)
    await settle();
    const asked = libraryCalls().length;

    fireEvent.click(chip("Posted"));
    expect(chip("Posted")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Stop buying snacks, do this", "Lentils, three ways"]);

    fireEvent.click(chip("Simulated"));
    expect(rowTitles()).toEqual(["Gym hooks"]);

    fireEvent.click(chip("Drafts"));
    expect(rowTitles()).toEqual(["Morning script"]);
    // Filtering is on what is loaded: no request of its own.
    await settle();
    expect(libraryCalls()).toHaveLength(asked);
  });

  it("a tap on Posted writes ?filter=posted with the History API; opened on that address (a reload), Posted is the chip", async () => {
    page = () => ROWS;
    const first = renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    fireEvent.click(chip("Posted"));
    expect(address()).toBe("/library?filter=posted");
    expect(router.replace).not.toHaveBeenCalled();
    first.unmount();
    client.clear();

    // A reload: the page opens on the address it was left at.
    renderLibrary({ filter: "posted", q: "" });
    await screen.findByRole("button", { name: "Lentils, three ways" });
    expect(chip("Posted")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Stop buying snacks, do this", "Lentils, three ways"]);
  });

  it("Posted with nothing posted says how to post one", async () => {
    page = () => [simulatedChat("s1", "Gym hooks")];
    renderLibrary({ filter: "posted", q: "" });
    expect(await screen.findByText("Nothing posted yet. Add a posted video's link to a piece you simulated.")).toBeInTheDocument();
  });
});

// ─── The rows ────────────────────────────────────────────────────────────────

describe("LibraryNext — a posted chat's row", () => {
  it("each state's line; the stage word Posted; the gauge is still what Maven said", async () => {
    page = () => [
      postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
      postedChat("p2", "Dorm kitchen tour", postedPiece(ago(6 * 24), { numbers: { views: 3_100, likes: 1, comments: 1, shares: 1, saves: 1 }, usual: { ratio: 0.4, tone: "below" } })),
      postedChat("p3", "Five-minute breakfast", postedPiece(ago(4 * 24), { usual: null })),
      postedChat("p4", "What I eat in a day for $5", soFarPiece(ago(26))),
      postedChat("p5", "Lentils, three ways", readingPiece()),
      postedChat("p6", "Night shift snacks", unreadPiece()),
    ];
    renderLibrary();
    await screen.findByRole("button", { name: "Stop buying snacks, do this" });

    expect(rowButton("Stop buying snacks, do this")).toHaveAccessibleDescription("Posted 4d ago · 31K views 1.8× your usual");
    expect(rowButton("Dorm kitchen tour")).toHaveAccessibleDescription("Posted 6d ago · 3.1K views 0.4× your usual");
    expect(rowButton("Five-minute breakfast")).toHaveAccessibleDescription("Posted 4d ago · 31K views");
    expect(rowButton("What I eat in a day for $5")).toHaveAccessibleDescription("Posted 1d ago · 12.4K views so far");
    expect(rowButton("Lentils, three ways")).toHaveAccessibleDescription("Posted · reading the post");
    expect(rowButton("Night shift snacks")).toHaveAccessibleDescription("Posted · couldn't read the post");

    // The mark's colour: green above, coral below.
    const usualOf = (title: string) => rowButton(title).querySelector('[data-part="usual"]');
    expect(usualOf("Stop buying snacks, do this")).toHaveClass("text-above");
    expect(usualOf("Dorm kitchen tour")).toHaveClass("text-below-text");

    for (const title of ["Stop buying snacks, do this", "Lentils, three ways", "Night shift snacks"]) {
      expect(within(rowButton(title)).getByText("Posted")).toHaveClass("hidden", "md:block");
    }
    // The gauge: what Maven said, linked to the piece's result.
    expect(screen.getByRole("link", { name: "Open the result: Stop buying snacks, do this" })).toHaveAccessibleDescription("67% would stop to watch");
  });

  it("from 768 the line says what is inside and when it was posted; the column says the numbers (ruling 30)", async () => {
    removeWidth();
    removeWidth = atWidth("desk");
    const holding = (one: LibraryChat, counts: Partial<LibrarySummary["counts"]>, lead: LibrarySummary["lead"]): LibraryChat => ({
      ...one,
      summary: { ...one.summary, counts: { ...NONE, ...counts }, lead },
    });
    page = () => [
      postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
      holding(postedChat("p2", "Dorm kitchen tour", postedPiece(ago(11 * 24))), { videos: 1 }, "video"),
      holding(postedChat("p3", "Breakfast ideas", soFarPiece(ago(5))), { ideas: 4 }, "ideas"),
      postedChat("p5", "Lentils, three ways", readingPiece()),
    ];
    renderLibrary();
    await screen.findByRole("button", { name: "Stop buying snacks, do this" });
    expect(rowButton("Stop buying snacks, do this")).toHaveAccessibleDescription("5 hooks · posted 4d ago");
    // Past a week, the post's date, as every row writes one ("Nov 12").
    expect(rowButton("Dorm kitchen tour")).toHaveAccessibleDescription(`Video · posted ${whenLabel(ago(11 * 24))}`);
    expect(rowButton("Dorm kitchen tour")).toHaveAccessibleDescription(/^Video · posted [A-Z][a-z]{2} \d{1,2}$/);
    expect(rowButton("Breakfast ideas")).toHaveAccessibleDescription("4 ideas · posted 5h ago");
    // No post time yet: posted, with no day.
    expect(rowButton("Lentils, three ways")).toHaveAccessibleDescription("5 hooks · posted");
    // The numbers are the column's, said there once.
    const cell = rowButton("Stop buying snacks, do this").closest("li")!.querySelector('[data-part="after"]')!;
    expect(cell).not.toHaveAttribute("aria-hidden");
    expect(cell.textContent).toBe("31K views1.8× your usual");
  });

  it("the desktop column: the views over the usual, or so far, Reading, Not read; empty for a chat with nothing posted", async () => {
    page = () => [
      postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
      postedChat("p4", "What I eat in a day for $5", soFarPiece(ago(26))),
      postedChat("p5", "Lentils, three ways", readingPiece()),
      postedChat("p6", "Night shift snacks", unreadPiece()),
      simulatedChat("s1", "Gym hooks"),
    ];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    const cellOf = (title: string) => rowButton(title).closest("li")!.querySelector('[data-part="after"]')!;
    expect(Array.from(cellOf("Stop buying snacks, do this").children).map((line) => line.textContent)).toEqual(["31K views", "1.8× your usual"]);
    expect(Array.from(cellOf("What I eat in a day for $5").children).map((line) => line.textContent)).toEqual(["12.4K views", "so far"]);
    expect(cellOf("Lentils, three ways").textContent).toBe("Reading");
    expect(cellOf("Night shift snacks").textContent).toBe("Not read");
    expect(cellOf("Gym hooks")).toBeEmptyDOMElement();
    expect(screen.getByText("After posting")).toBeInTheDocument();
  });
});

// ─── The menu ────────────────────────────────────────────────────────────────

describe("LibraryNext — the row menu's posted item", () => {
  it("Add posted link for a simulated chat, Remove posted link for a posted one, nothing for a draft or a plain chat; always third", async () => {
    page = () => [
      simulatedChat("s1", "Gym hooks"),
      postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
      draftChat("d1", "Morning script"),
      plainChat("c1", "Just talking"),
    ];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    const itemsOf = async (title: string) => {
      openMenu(title);
      const items = menuItems(title);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await settle();
      return items;
    };
    expect(await itemsOf("Gym hooks")).toEqual(["Rename", "Pin", "Add posted link", "Delete"]);
    expect(await itemsOf("Stop buying snacks, do this")).toEqual(["Rename", "Pin", "Remove posted link", "Delete"]);
    expect(await itemsOf("Morning script")).toEqual(["Rename", "Pin", "Delete"]);
    expect(await itemsOf("Just talking")).toEqual(["Rename", "Pin", "Delete"]);
  });

  it("Add posted link opens the sheet for the row's piece (a text: its chat and key); added, the sheet closes with the focus on that row's More, one read of the post starts, and the row reads the post", async () => {
    let posted = false;
    page = () => [
      posted ? postedChat("s1", "Gym hooks", readingPiece()) : simulatedChat("s1", "Gym hooks"),
      simulatedChat("s2", "Meal prep"),
    ];
    onAdd = () => {
      posted = true;
      return readingPiece({ id: "post-s1", threadId: "s1" });
    };
    const read = deferred<Posted[]>();
    onRefresh = () => read.promise;
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });

    openMenu("Gym hooks");
    fireEvent.click(within(menu("Gym hooks")).getByRole("button", { name: "Add posted link" }));
    await settle();
    // The menu is gone; the sheet is its own layer, the field focused.
    expect(screen.queryByRole("dialog", { name: "Gym hooks" })).toBeNull();
    const field = within(sheet()).getByRole("textbox", { name: "TikTok link" });
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: "  https://www.tiktok.com/@nia.cooks/video/7301444403323456789  " } });
    fireEvent.submit(field.closest("form")!);
    await settle();

    expect(postedWrites()).toEqual([
      { method: "POST", path: "/api/posted", body: { kind: "text", threadId: "s1", key: "key-s1", url: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789" } },
    ]);
    expect(screen.queryByRole("dialog", { name: "Posted it?" })).toBeNull();
    expect(moreOf("Gym hooks")).toHaveFocus();
    // The add's own read of that post (the hook's); the visit starts no second one while it is out.
    expect(refreshCalls()).toEqual([{ method: "POST", path: "/api/posted/refresh", body: { id: "post-s1" } }]);
    await waitFor(() => expect(rowButton("Gym hooks")).toHaveAccessibleDescription("Posted · reading the post"));

    // The read comes back with numbers: the list is asked for again, and the row says them.
    page = () => [postedChat("s1", "Gym hooks", soFarPiece(ago(2))), simulatedChat("s2", "Meal prep")];
    const before = libraryCalls().length;
    await act(async () => read.resolve([soFarPiece(ago(2), { id: "post-s1", threadId: "s1" })]));
    await waitFor(() => expect(rowButton("Gym hooks")).toHaveAccessibleDescription("Posted 2h ago · 12.4K views so far"));
    expect(libraryCalls().length).toBeGreaterThan(before);
    await settle();
    expect(refreshCalls()).toHaveLength(1);
  });

  it("a video's row adds the link to its video", async () => {
    page = () => [videoChat("v1", "Dorm kitchen tour")];
    renderLibrary();
    await screen.findByRole("button", { name: "Dorm kitchen tour" });
    openMenu("Dorm kitchen tour");
    fireEvent.click(within(menu("Dorm kitchen tour")).getByRole("button", { name: "Add posted link" }));
    await settle();
    const field = within(sheet()).getByRole("textbox", { name: "TikTok link" });
    fireEvent.change(field, { target: { value: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789" } });
    fireEvent.submit(field.closest("form")!);
    await settle();
    expect(postedWrites()[0]).toEqual({
      method: "POST",
      path: "/api/posted",
      body: { kind: "video", analysisId: "run-v1", url: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789" },
    });
  });

  it("the sheet closed without a link (Escape): nothing sent, the focus back on the row's More", async () => {
    page = () => [simulatedChat("s1", "Gym hooks")];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    openMenu("Gym hooks");
    fireEvent.click(within(menu("Gym hooks")).getByRole("button", { name: "Add posted link" }));
    await settle();
    fireEvent.keyDown(within(sheet()).getByRole("textbox", { name: "TikTok link" }), { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog", { name: "Posted it?" })).toBeNull();
    expect(moreOf("Gym hooks")).toHaveFocus();
    expect(postedWrites()).toEqual([]);
  });

  it("a link that is not TikTok's is refused in the sheet; nothing is sent", async () => {
    page = () => [simulatedChat("s1", "Gym hooks")];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    openMenu("Gym hooks");
    fireEvent.click(within(menu("Gym hooks")).getByRole("button", { name: "Add posted link" }));
    await settle();
    const field = within(sheet()).getByRole("textbox", { name: "TikTok link" });
    fireEvent.change(field, { target: { value: "https://videos.example/nia/1" } });
    fireEvent.submit(field.closest("form")!);
    expect(within(sheet()).getByText("That's not a TikTok link.")).toBeInTheDocument();
    expect(postedWrites()).toEqual([]);
  });

  it("added under Simulated: the chat is Posted now and leaves the list; the focus goes to the row in its place", async () => {
    let posted = false;
    page = () => [
      posted ? postedChat("s1", "Gym hooks", readingPiece()) : simulatedChat("s1", "Gym hooks"),
      simulatedChat("s2", "Meal prep"),
    ];
    onAdd = () => {
      posted = true;
      return readingPiece({ id: "post-s1", threadId: "s1" });
    };
    onRefresh = () => new Promise(() => {}); // the add's read stays out
    renderLibrary({ filter: "simulated", q: "" });
    await screen.findByRole("button", { name: "Gym hooks" });
    openMenu("Gym hooks");
    fireEvent.click(within(menu("Gym hooks")).getByRole("button", { name: "Add posted link" }));
    await settle();
    const field = within(sheet()).getByRole("textbox", { name: "TikTok link" });
    fireEvent.change(field, { target: { value: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789" } });
    fireEvent.submit(field.closest("form")!);
    await settle();
    await waitFor(() => expect(rowTitles()).toEqual(["Meal prep"]));
    await settle();
    expect(rowButton("Meal prep")).toHaveFocus();
  });

  it("Remove posted link asks once more; Remove sends DELETE /api/posted/{id} with the focus on More; the list is read again and the row is back to what Maven said", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    let removed = false;
    page = () => [removed ? simulatedChat("p1", "Stop buying snacks, do this") : postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96)))];
    onRemove = () => {
      removed = true;
      return 204;
    };
    renderLibrary();
    await screen.findByRole("button", { name: "Stop buying snacks, do this" });
    openMenu("Stop buying snacks, do this");
    fireEvent.click(within(menu("Stop buying snacks, do this")).getByRole("button", { name: "Remove posted link" }));
    expect(within(menu("Stop buying snacks, do this")).getByText("Remove the posted link?")).toBeInTheDocument();
    expect(within(menu("Stop buying snacks, do this")).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(postedWrites()).toEqual([]);

    vi.advanceTimersByTime(500);
    const before = libraryCalls().length;
    fireEvent.click(within(menu("Stop buying snacks, do this")).getByRole("button", { name: "Remove" }));
    expect(moreOf("Stop buying snacks, do this")).toHaveFocus();
    await settle();
    expect(postedWrites()).toEqual([{ method: "DELETE", path: "/api/posted/post-p1", body: undefined }]);
    await waitFor(() => expect(rowButton("Stop buying snacks, do this")).toHaveAccessibleDescription("5 hooks · simulated 1d ago"));
    expect(libraryCalls().length).toBeGreaterThan(before);
    expect(moreOf("Stop buying snacks, do this")).toHaveFocus();
  });

  it("removed under Posted: the row leaves, and the focus goes to the row in its place; the only one, to the chip", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const removed = new Set<string>();
    page = () =>
      [
        postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
        postedChat("p2", "Lentils, three ways", postedPiece(ago(80))),
      ].map((one) => (removed.has(one.id) ? simulatedChat(one.id, one.title!) : one));
    onRemove = (id) => {
      removed.add(id.replace("post-", ""));
      return 204;
    };
    renderLibrary({ filter: "posted", q: "" });
    await screen.findByRole("button", { name: "Stop buying snacks, do this" });
    const remove = async (title: string) => {
      openMenu(title);
      fireEvent.click(within(menu(title)).getByRole("button", { name: "Remove posted link" }));
      vi.advanceTimersByTime(500);
      fireEvent.click(within(menu(title)).getByRole("button", { name: "Remove" }));
      await settle();
    };
    await remove("Stop buying snacks, do this");
    await waitFor(() => expect(rowTitles()).toEqual(["Lentils, three ways"]));
    await settle();
    expect(rowButton("Lentils, three ways")).toHaveFocus();

    await remove("Lentils, three ways");
    expect(await screen.findByText("Nothing posted yet. Add a posted video's link to a piece you simulated.")).toBeInTheDocument();
    await settle();
    expect(chip("Posted")).toHaveFocus();
  });

  it("a refused remove says \"Couldn't remove the link.\" and the row keeps its link", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    page = () => [postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96)))];
    onRemove = () => 500;
    renderLibrary();
    await screen.findByRole("button", { name: "Stop buying snacks, do this" });
    openMenu("Stop buying snacks, do this");
    fireEvent.click(within(menu("Stop buying snacks, do this")).getByRole("button", { name: "Remove posted link" }));
    vi.advanceTimersByTime(500);
    fireEvent.click(within(menu("Stop buying snacks, do this")).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Couldn't remove the link.")).toBeInTheDocument();
    // One message: the hook's, not a second one of Library's.
    expect(screen.getAllByText("Couldn't remove the link.")).toHaveLength(1);
    await settle();
    expect(rowButton("Stop buying snacks, do this")).toHaveAccessibleDescription("Posted 4d ago · 31K views 1.8× your usual");
  });
});

// ─── One read per visit ──────────────────────────────────────────────────────

describe("LibraryNext — one read of the posts' numbers per visit", () => {
  it("a loaded chat owed a read: one read of everything owed ({}), then the list is asked for again and the rows say what came back", async () => {
    let read = false;
    page = () => [
      postedChat("p1", "What I eat in a day for $5", read ? soFarPiece(ago(26)) : soFarPiece(ago(26), { numbers: { views: 900, likes: 1, comments: 1, shares: 1, saves: 1 }, due: true })),
      simulatedChat("s1", "Gym hooks"),
    ];
    const answer = deferred<Posted[]>();
    onRefresh = () => answer.promise;
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    await settle();
    expect(refreshCalls()).toEqual([{ method: "POST", path: "/api/posted/refresh", body: {} }]);
    expect(rowButton("What I eat in a day for $5")).toHaveAccessibleDescription("Posted 1d ago · 900 views so far");

    read = true;
    const before = libraryCalls().length;
    await act(async () => answer.resolve([soFarPiece(ago(26), { id: "post-p1", threadId: "p1" })]));
    await waitFor(() => expect(rowButton("What I eat in a day for $5")).toHaveAccessibleDescription("Posted 1d ago · 12.4K views so far"));
    expect(libraryCalls().length).toBe(before + 1);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("never in a loop: a read that comes back with rows still owed starts no other in the same visit", async () => {
    page = () => [postedChat("p1", "Lentils, three ways", readingPiece())];
    onRefresh = () => [];
    renderLibrary();
    await screen.findByRole("button", { name: "Lentils, three ways" });
    await settle();
    await settle();
    expect(refreshCalls()).toHaveLength(1);
    // A chip, a search cleared: still the same visit.
    fireEvent.click(chip("Posted"));
    fireEvent.click(chip("All"));
    await settle();
    expect(refreshCalls()).toHaveLength(1);
  });

  it("a failed read is not tried again in the same visit", async () => {
    page = () => [postedChat("p1", "Lentils, three ways", readingPiece())];
    onRefresh = () => 500;
    renderLibrary();
    await screen.findByRole("button", { name: "Lentils, three ways" });
    await settle();
    await settle();
    expect(refreshCalls()).toHaveLength(1);
  });

  it("a new visit (Library mounted again) asks once more", async () => {
    page = () => [postedChat("p1", "Lentils, three ways", readingPiece())];
    onRefresh = () => [];
    const first = renderLibrary();
    await screen.findByRole("button", { name: "Lentils, three ways" });
    await settle();
    expect(refreshCalls()).toHaveLength(1);
    first.unmount();
    renderLibrary();
    await screen.findByRole("button", { name: "Lentils, three ways" });
    await settle();
    expect(refreshCalls()).toHaveLength(2);
  });

  it("nothing owed (final, unread, not due, nothing posted): no read", async () => {
    page = () => [
      postedChat("p1", "Stop buying snacks, do this", postedPiece(ago(96))),
      postedChat("p2", "Night shift snacks", unreadPiece()),
      postedChat("p3", "What I eat in a day for $5", soFarPiece(ago(26))),
      simulatedChat("s1", "Gym hooks"),
    ];
    renderLibrary();
    await screen.findByRole("button", { name: "Gym hooks" });
    await settle();
    expect(refreshCalls()).toEqual([]);
  });

  it("a chat owed a read under another chip still counts (any loaded chat); it is asked for once the list is in", async () => {
    const list = deferred<void>();
    page = () => [simulatedChat("s1", "Gym hooks"), postedChat("p1", "Lentils, three ways", readingPiece())];
    // The page's first request, the list, is held until the test lets it go.
    const answer = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(async (input, init) => {
      await list.promise;
      return answer(input, init);
    });
    renderLibrary({ filter: "drafts", q: "" });
    await settle();
    expect(refreshCalls()).toEqual([]);
    await act(async () => list.resolve());
    await settle();
    expect(screen.getByText("No drafts.")).toBeInTheDocument();
    expect(refreshCalls()).toEqual([{ method: "POST", path: "/api/posted/refresh", body: {} }]);
  });
});
