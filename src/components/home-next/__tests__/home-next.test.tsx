/** @vitest-environment happy-dom */

/**
 * HomeNext — Home with its real data: the profile, the chat list and Library's summary of the
 * chats through react-query, the real thread actions (the active-thread cookie, the board store,
 * the shell's back marker) and the real sidebar stores. Stand-ins only at the edges: `fetch`, the
 * router, `matchMedia`, the build's flag, and the clock for `recentRows`.
 */

import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { ThreadSummary } from "@/hooks/queries";
import { earnKeys, useEarn } from "@/hooks/queries/use-earn";
import { useArchiveThread } from "@/hooks/queries/use-threads";
import { EARN_RATE_PCT, type EarnPage } from "@/lib/earn/earn";
import { headline } from "@/lib/earn/earn-words";
import type { LibraryChat, LibraryPage, LibrarySummary } from "@/lib/library/library-page";
import { queryKeys } from "@/lib/queries/query-keys";
import { clearActiveThreadCookie, getActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { THREAD_TITLE_MAX } from "@/lib/threads/title";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";

vi.setConfig({ testTimeout: 20_000 });

// Home is the new look's: a video's result is at /simulation/{id}.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

// One object, as the real App Router returns.
const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => router,
}));

import { HOME_RECENT_LIMIT, HomeNext, moneyOf, recentRows, summaryAgrees } from "../home-next";

const NOW = new Date("2026-11-23T10:00:00Z").getTime();
const HOUR = 3_600_000;

const thread = (id: string, title: string | null, hoursAgo = 2): ThreadSummary => ({
  id,
  title,
  updated_at: new Date(NOW - hoursAgo * HOUR).toISOString(),
  created_at: new Date(NOW - 48 * HOUR).toISOString(),
  pinned_at: null,
});

const NONE: LibrarySummary["counts"] = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

/** A chat as Library's endpoint lists it (a plain chat unless told otherwise). */
function libraryChat(id: string, title: string | null, updatedAt: string, summary: Partial<LibrarySummary> = {}): LibraryChat {
  return {
    id,
    title,
    updatedAt,
    pinned: false,
    summary: { counts: NONE, lead: "chat", stage: "chat", sim: null, frame: null, videoPath: null, posted: null, ...summary },
  };
}

/** A chat of Library's list as the sidebar's short list holds it. */
const listed = (chat: LibraryChat): ThreadSummary => ({
  id: chat.id,
  title: chat.title,
  updated_at: chat.updatedAt,
  created_at: chat.updatedAt,
  pinned_at: null,
});

/** The screen on a phone (no media query matches). */
function stubMatchMedia() {
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
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Every request Home made, by path and query. */
const requested = () => vi.mocked(fetch).mock.calls.map(([input]) => String(input));
const libraryRequests = () => requested().filter((url) => url.startsWith("/api/threads/library"));

/** The audience line's values as the composer hands them in. */
const AUDIENCE = { name: "@creator_one", general: false, open: false, onOpen: () => {} };

function renderHomeNext(
  over: Partial<ComponentProps<typeof HomeNext>> = {},
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const onPickSkill = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <HomeNext field={<div data-testid="slot" />} audience={AUDIENCE} credits={null} onPickSkill={onPickSkill} {...over} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onPickSkill, qc };
}

describe("recentRows", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves untitled chats out and takes the five last written to (spec 2026-11-25 §2.5)", () => {
    const rows = recentRows([
      thread("a", null),
      thread("b", "Meal prep for busy students"),
      thread("c", ""),
      thread("d", "Fake a $10M camera move", 24),
      thread("e", "  "),
      thread("f", "Morning routine, no cuts", 72),
      thread("g", "Ideas for next week", 96),
      thread("h", "Gym myths for beginners", 120),
      thread("i", "Lentils, three ways", 150),
      thread("j", "An old one", 200),
    ]);
    expect(HOME_RECENT_LIMIT).toBe(5);
    expect(rows.map((row) => row.id)).toEqual(["b", "d", "f", "g", "h"]);
  });

  it("is by last message, not the sidebar's order: an old pinned chat does not lead", () => {
    // The list arrives pinned first (the sidebar's order).
    const pinned = { ...thread("p", "Pinned in the summer", 118 * 24), pinned_at: new Date(NOW - 100 * 24 * HOUR).toISOString() };
    const rows = recentRows([pinned, thread("x", "Three days ago", 72), thread("y", "Today", 1), thread("z", "Yesterday", 26)]);
    // The pinned one is in its place by last message: last, not first.
    expect(rows.map((row) => row.id)).toEqual(["y", "z", "x", "p"]);
  });

  it("past a week a chat shows its date, with the year once it is not this one", () => {
    const rows = recentRows([thread("a", "Last month", 30 * 24), thread("b", "Last year", 400 * 24), thread("c", "Six days", 6 * 24)]);
    expect(rows.map((row) => row.when)).toEqual(["6d ago", "Oct 24", "Oct 19, 2025"]);
  });

  it("says when each was last written to", () => {
    const rows = recentRows([thread("b", "Meal prep", 2), thread("d", "Camera move", 24), thread("f", "Routine", 72)]);
    expect(rows.map((row) => row.when)).toEqual(["2h ago", "1d ago", "3d ago"]);
  });

  it("shows a title as the headers do: trimmed, and a cap-long one cut at a word", () => {
    const long = `${"word ".repeat(20)}`.slice(0, THREAD_TITLE_MAX);
    const rows = recentRows([thread("a", "  Meal prep  "), thread("b", long)]);
    expect(rows[0]!.title).toBe("Meal prep");
    expect(rows[1]!.title.endsWith("…")).toBe(true);
    expect(rows[1]!.title.length).toBeLessThanOrEqual(THREAD_TITLE_MAX);
  });

  it("is empty while the list is not loaded", () => {
    expect(recentRows(undefined)).toEqual([]);
  });
});

describe("summaryAgrees: does Library's summary still say what the sidebar's list says?", () => {
  const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString();
  const a = libraryChat("a", "Meal prep", iso(1));
  const b = libraryChat("b", null, iso(2), { lead: "video" });
  const c = libraryChat("c", "Camera move", iso(3));

  it("with no list to hold it to, it agrees", () => {
    expect(summaryAgrees([a, b, c], undefined)).toBe(true);
  });

  it("the same chats, times and titles agree, whatever order the list is in", () => {
    expect(summaryAgrees([a, b, c], [c, a, b].map(listed))).toBe(true);
  });

  it("a chat renamed since does not", () => {
    expect(summaryAgrees([a, b, c], [{ ...listed(a), title: "Meal prep, week 2" }, listed(b), listed(c)])).toBe(false);
  });

  it("an untitled chat the list has since named (its read-repair) still agrees: Library names it for what it holds", () => {
    expect(summaryAgrees([a, b, c], [listed(a), { ...listed(b), title: "What should I film first?" }, listed(c)])).toBe(true);
  });

  it("a chat written to since, or gone from the list, does not", () => {
    expect(summaryAgrees([a, b, c], [{ ...listed(a), updated_at: iso(0.1) }, listed(b), listed(c)])).toBe(false);
    expect(summaryAgrees([a, b, c], [listed(b), listed(c)])).toBe(false);
  });

  it("a titled chat newer than the oldest shown and not shown does not; an older one, or an untitled one, may be missing", () => {
    expect(summaryAgrees([a, b, c], [...[a, b, c].map(listed), thread("n", "New since", 0.5)])).toBe(false);
    expect(summaryAgrees([a, b, c], [...[a, b, c].map(listed), thread("o", "Older", 30)])).toBe(true);
    expect(summaryAgrees([a, b, c], [...[a, b, c].map(listed), thread("u", null, 0.5)])).toBe(true);
  });

  it("an empty first page agrees only with a list that has no titled chat", () => {
    expect(summaryAgrees([], [thread("u", null, 1)])).toBe(true);
    expect(summaryAgrees([], [thread("t", "Meal prep", 1)])).toBe(false);
  });
});

describe("HomeNext", () => {
  const THREADS = [thread("t1", "Meal prep for busy students", 2), thread("t2", "Fake a $10M camera move", 24)];
  // Library's summary of the same two chats (plain chats).
  const LIBRARY: LibraryPage = { chats: THREADS.map((t) => libraryChat(t.id, t.title, t.updated_at)), next: null };

  beforeEach(() => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/profile")) {
          return new Response(JSON.stringify({ name: "Nia Long", avatar: null, email: "x" }), { status: 200 });
        }
        if (url.endsWith("/api/threads/list")) {
          return new Response(JSON.stringify({ threads: THREADS }), { status: 200 });
        }
        if (url.endsWith("/api/threads/library")) return json(LIBRARY);
        return new Response("{}", { status: 404 });
      }),
    );
    router.push.mockReset();
    clearActiveThreadCookie();
    useBoardStore.setState({ activeThreadId: null });
    // The sidebar open, as on a wide window where the creator never chose.
    useSidebarStore.setState({ isCollapsed: false });
    useShellStore.setState({ autoRail: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderHome = renderHomeNext;

  it("draws the audience line the composer hands in, under the greeting; a press reaches the composer", async () => {
    const onOpen = vi.fn();
    const anchorRef = { current: null as HTMLButtonElement | null };
    renderHome({ audience: { name: "@creator_two", general: false, open: false, onOpen }, audienceRef: anchorRef });
    const line = screen.getByRole("button", { name: "For @creator_two, change audience" });
    expect(line).toHaveTextContent(/^For @creator_two$/);
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toBe(line);
    expect(anchorRef.current).toBe(line);
    fireEvent.click(line);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await screen.findByRole("button", { name: "Meal prep for busy students" });
  });

  it("a failing profile request shows the nameless greeting after the first attempt, not after every retry (B6)", async () => {
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).endsWith("/api/profile") ? new Response("{}", { status: 500 }) : base(input, init),
    );
    // Retries on, a minute apart: the query stays pending for minutes, as in the app.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 60_000 } } });
    renderHome({}, qc);
    const heading = screen.getByRole("heading", { level: 1 });
    await waitFor(() => expect(heading).toHaveTextContent(/^Good (morning|afternoon|evening)\.$/));
    expect(heading).not.toHaveAttribute("aria-busy");
    // Still retrying: the greeting did not wait for the query to give up.
    expect(qc.getQueryState(queryKeys.profile.current())?.status).toBe("pending");
  });

  const recentSection = () => screen.getByRole("heading", { name: "Recent" }).closest("section");

  it("holds the heading until the profile has answered: no nameless greeting", async () => {
    let answer!: (response: Response) => void;
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).endsWith("/api/profile") ? new Promise<Response>((resolve) => (answer = resolve)) : base(input, init),
    );
    renderHome();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("aria-busy", "true");
    expect(heading.textContent?.trim()).toBe("");
    await waitFor(() => expect(answer).toBeTypeOf("function"));
    answer(new Response(JSON.stringify({ name: "Nia Long", avatar: null, email: "x" }), { status: 200 }));
    await waitFor(() => expect(heading).toHaveTextContent(/^Good (morning|afternoon|evening), Nia\.$/));
    expect(heading).not.toHaveAttribute("aria-busy");
  });

  it("Home's top row carries the shell's opener", async () => {
    // The face the drawer's frame publishes (the shell mounts it; here it is set as it would be).
    useShellStore.setState({ drawerOpen: false, accountFace: { picture: null, initials: "NL" } });
    onTestFinished(() => useShellStore.setState({ drawerOpen: false, accountFace: null }));
    renderHome();
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    expect(opener).toHaveAttribute("aria-expanded", "false");
    // First in the phone's top row; no link to You is left on Home.
    const slot = opener.closest('[data-part="opener"]')!;
    expect(slot.parentElement!.firstElementChild).toBe(slot);
    expect(screen.queryByRole("link", { name: "You" })).toBeNull();
    fireEvent.click(opener);
    expect(useShellStore.getState().drawerOpen).toBe(true);
    expect(opener).toHaveAttribute("aria-expanded", "true");
    await screen.findByRole("button", { name: "Meal prep for busy students" });
  });

  it("greets the creator by first name and lists their chats", async () => {
    renderHome();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Good (morning|afternoon|evening), Nia\.$/),
    );
    expect(await screen.findByRole("button", { name: "Meal prep for busy students" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fake a $10M camera move" })).toBeInTheDocument();
  });

  it("a chat row opens that chat (the real openThread: the cookie points at it)", async () => {
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Fake a $10M camera move" }));
    expect(getActiveThreadCookie()).toBe("t2");
    expect(useBoardStore.getState().activeThreadId).toBe("t2");
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("shows the balance it is given", async () => {
    renderHome({ credits: 12 });
    expect(screen.getByText("12 credits")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Meal prep for busy students" });
  });

  it.each([
    ["open", () => useSidebarStore.setState({ isCollapsed: false })],
    ["the rail", () => useSidebarStore.setState({ isCollapsed: true })],
    ["the narrow window's rail", () => useShellStore.setState({ autoRail: true })],
  ] as const)("with the sidebar %s, Recent shows on desktop too (spec 2026-11-25 §2.5)", async (_state, set) => {
    set();
    renderHome();
    await screen.findByRole("button", { name: "Meal prep for busy students" });
    expect(recentSection()!.className).not.toMatch(/(^|\s)md:hidden(\s|$)/);
  });
});

describe("HomeNext — what goes under the field (spec 2026-11-25 §2.5)", () => {
  /** What `/api/threads/list` answers: a list, a status, or an answer on its way. */
  let listAnswer: ThreadSummary[] | number | Promise<ThreadSummary[] | number>;
  /** What `/api/threads/library` answers (the summary): a page or a status. */
  let libraryAnswer: LibraryPage | number;

  beforeEach(() => {
    listAnswer = [];
    libraryAnswer = { chats: [], next: null };
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/profile")) return json({ name: "Nia Long", avatar: null, email: "x" });
        // The sidebar's delete.
        if (init?.method === "DELETE" && url.startsWith("/api/threads/")) return json({ success: true });
        if (url.endsWith("/api/threads/list")) {
          const answer = await listAnswer;
          return typeof answer === "number" ? json({ error: "x" }, answer) : json({ threads: answer });
        }
        if (url.startsWith("/api/threads/library")) {
          return typeof libraryAnswer === "number" ? json({}, libraryAnswer) : json(libraryAnswer);
        }
        return json({}, 404);
      }),
    );
    clearActiveThreadCookie();
    useBoardStore.setState({ activeThreadId: null });
    useSidebarStore.setState({ isCollapsed: false });
    useShellStore.setState({ autoRail: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const CARDS = ["Simulate", "Hooks", "Script", "Remix"];
  const settle = (ms = 50) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
  const cardsShown = () => CARDS.filter((name) => screen.queryByRole("button", { name }));
  const recentShown = () => screen.queryByRole("heading", { name: "Recent" }) !== null;

  it("while the chat list is out: nothing under the field, not a card, not Recent; then what it says", async () => {
    let answer!: (threads: ThreadSummary[]) => void;
    listAnswer = new Promise<ThreadSummary[]>((resolve) => (answer = resolve));
    // The summary is in first, with a chat: still nothing until the list has answered.
    libraryAnswer = { chats: [libraryChat("t1", "Meal prep for busy students", new Date().toISOString())], next: null };
    renderHomeNext();
    await settle();
    expect(cardsShown()).toEqual([]);
    expect(recentShown()).toBe(false);
    expect(screen.getByTestId("slot").parentElement!.nextElementSibling).toBeNull();

    await act(async () => answer([thread("t1", "Meal prep for busy students")]));
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(cardsShown()).toEqual([]);
  });

  it("one titled chat: Recent, and no cards", async () => {
    listAnswer = [thread("t1", "Meal prep for busy students")];
    renderHomeNext();
    expect(await screen.findByRole("button", { name: "Meal prep for busy students" })).toBeInTheDocument();
    expect(cardsShown()).toEqual([]);
  });

  it.each<[string, () => void]>([
    ["no chats at all", () => (listAnswer = [])],
    ["only untitled chats (nothing to resume)", () => (listAnswer = [thread("a", null), thread("b", "  ")])],
    ["the list failed (and the summary too)", () => ((listAnswer = 500), (libraryAnswer = 500))],
  ])("%s: the four cards, and no Recent", async (_name, set) => {
    set();
    renderHomeNext();
    await waitFor(() => expect(cardsShown()).toEqual(CARDS));
    expect(recentShown()).toBe(false);
  });

  // Review minor 2 (a).
  it("the last chat deleted while on Home: Recent goes and the cards come, though the summary still holds the chat", async () => {
    const at = new Date().toISOString();
    listAnswer = [thread("t1", "Meal prep for busy students")];
    // The summary is not told of the delete: it keeps the chat on every read.
    libraryAnswer = { chats: [libraryChat("t1", "Meal prep for busy students", at)], next: null };
    const { qc } = renderHomeNext();
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();

    // The sidebar's own delete (its real hook), on the same cache.
    function Sidebar() {
      const archive = useArchiveThread();
      return (
        <button type="button" onClick={() => archive.mutate("t1")}>
          Delete chat
        </button>
      );
    }
    render(
      <QueryClientProvider client={qc}>
        <Sidebar />
      </QueryClientProvider>,
    );
    listAnswer = [];
    fireEvent.click(screen.getByRole("button", { name: "Delete chat" }));

    await waitFor(() => expect(cardsShown()).toEqual(CARDS));
    expect(recentShown()).toBe(false);
    expect(screen.queryByRole("button", { name: "Meal prep for busy students" })).toBeNull();
  });

  // Review minor 2 (b).
  it.each([
    ["Recent", [thread("t1", "Meal prep for busy students")]],
    ["the cards", []],
  ] as const)("a refetch of the list does not go back to not known yet (%s): it stays while the list is out, and after", async (what, threads) => {
    listAnswer = [...threads];
    libraryAnswer = { chats: threads.map((t) => libraryChat(t.id, t.title, t.updated_at)), next: null };
    const { qc } = renderHomeNext();
    const shown = () => (what === "Recent" ? recentShown() && cardsShown().length === 0 : cardsShown().length === 4 && !recentShown());
    await waitFor(() => expect(shown()).toBe(true));

    let answer!: (threads: ThreadSummary[]) => void;
    listAnswer = new Promise<ThreadSummary[]>((resolve) => (answer = resolve));
    const refetch = act(async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.threads.list() });
    });
    await settle();
    // The list is out again: what was under the field is still there.
    expect(qc.getQueryState(queryKeys.threads.list())?.fetchStatus).toBe("fetching");
    expect(shown()).toBe(true);
    answer([...threads]);
    await refetch;
    await settle();
    expect(shown()).toBe(true);
  });

  it("with the cards, a tap picks its skill and the cards stay", async () => {
    const { onPickSkill } = renderHomeNext();
    fireEvent.click(await screen.findByRole("button", { name: "Hooks" }));
    expect(onPickSkill).toHaveBeenCalledWith("hooks");
    expect(cardsShown()).toEqual(CARDS);
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
  });
});

describe("moneyOf: only above zero (spec 2026-11-25 §2.6)", () => {
  const PAGE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 2, whop: null };
  const whop = (over: Partial<NonNullable<EarnPage["whop"]>>): EarnPage => ({
    ...PAGE,
    whop: { canEnrol: true, knownAccount: false, username: "nia.example", earnedCents: null, ...over },
  });

  it.each([
    [1, "$0.01"],
    [2450, "$24.50"],
    [124_000, "$1,240"],
    [124_050, "$1,240.50"],
  ])("%i cents earned: the row, %s, with Earn's rate", (cents, words) => {
    expect(moneyOf(whop({ earnedCents: cents }))).toEqual({ amount: words, hint: headline() });
  });

  it.each<[string, EarnPage | undefined]>([
    ["not answered yet", undefined],
    ["the payment side not read (whop null)", PAGE],
    ["not enrolled, the number null", whop({ username: null, earnedCents: null })],
    ["enrolled, the number could not be read", whop({ earnedCents: null })],
    ["enrolled, nothing earned yet (Whop says 0)", whop({ earnedCents: 0 })],
    ["a number below zero (a refund, say)", whop({ earnedCents: -500 })],
  ])("%s: no row", (_name, page) => {
    expect(moneyOf(page)).toBeNull();
  });
});

describe("HomeNext — Money made, last (spec 2026-11-25 §2.6; Earn rulings 18 and 24)", () => {
  /** What `GET /api/earn` answers, in turn (the last one again once the others are used): a page, a status, or an answer on its way. */
  let earnAnswers: Array<EarnPage | number | Promise<EarnPage | number>>;
  const PAGE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 2, whop: null };
  const withWhop = (earnedCents: number | null): EarnPage => ({
    ...PAGE,
    whop: { canEnrol: true, knownAccount: false, username: "nia.example", earnedCents },
  });

  beforeEach(() => {
    earnAnswers = [withWhop(5880)];
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/profile")) return json({ name: "Nia Long", avatar: null, email: "x" });
        if (url.endsWith("/api/threads/list")) return json({ threads: [] });
        if (url.startsWith("/api/threads/library")) return json({ chats: [], next: null });
        if (url === "/api/earn") {
          const answer = await (earnAnswers.length > 1 ? earnAnswers.shift()! : earnAnswers[0]!);
          return typeof answer === "number" ? json({ error: "x" }, answer) : json(answer);
        }
        return json({}, 404);
      }),
    );
    useSidebarStore.setState({ isCollapsed: false });
    useShellStore.setState({ autoRail: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const moneyPart = () => document.querySelector<HTMLElement>('[data-part="money"]');
  const moneyLink = () => screen.queryByRole("link", { name: /^Money made/ });
  const earnRequests = () => requested().filter((url) => url.startsWith("/api/earn"));
  const settle = (ms = 50) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

  it("something earned: the row, last on the page, after the cards: Money made, $58.80, Earn 50%, a link to Earn", async () => {
    renderHomeNext();
    const link = await screen.findByRole("link", { name: "Money made: $58.80. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*\$58\.80\s*Earn 50%$/);
    await screen.findByRole("button", { name: "Hooks" });
    const column = screen.getByRole("heading", { level: 1 }).parentElement!;
    expect(column.lastElementChild).toBe(moneyPart());
  });

  it("Earn 50% is built from the rate's constant", async () => {
    renderHomeNext();
    expect(await screen.findByRole("link", { name: `Money made: $58.80. ${headline()}` })).toBeInTheDocument();
    expect(headline()).toBe(`Earn ${EARN_RATE_PCT}%`);
  });

  it("while Earn has not answered: no row and no space held; it lands at the end when it answers", async () => {
    let answer!: (page: EarnPage) => void;
    earnAnswers = [new Promise<EarnPage>((resolve) => (answer = resolve))];
    renderHomeNext();
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await settle();
    expect(moneyPart()).toBeNull();
    const field = screen.getByTestId("slot");
    await act(async () => answer(withWhop(2450)));
    expect(await screen.findByRole("link", { name: "Money made: $24.50. Earn 50%" })).toBeInTheDocument();
    // Nothing above it moved: the field is the element it was.
    expect(screen.getByTestId("slot")).toBe(field);
  });

  it.each<[string, EarnPage["whop"] | "page"]>([
    ["the payment side was not read (whop null)", null],
    ["not enrolled, the number null", { canEnrol: true, knownAccount: false, username: null, earnedCents: null }],
    ["enrolled, nothing earned yet (Whop says 0)", { canEnrol: true, knownAccount: true, username: "nia.example", earnedCents: 0 }],
    ["enrolled, the number could not be read", { canEnrol: true, knownAccount: true, username: "nia.example", earnedCents: null }],
  ])("%s: no row, no space", async (_name, whop) => {
    earnAnswers = [{ ...PAGE, whop: whop as EarnPage["whop"] }];
    renderHomeNext();
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await settle(100);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
  });

  it("the number read later (the next read answers it) brings the row", async () => {
    earnAnswers = [withWhop(null), withWhop(2450)];
    const { qc } = renderHomeNext();
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await settle();
    expect(moneyPart()).toBeNull();
    await act(async () => {
      await qc.invalidateQueries({ queryKey: earnKeys.page });
    });
    expect(await screen.findByRole("link", { name: "Money made: $24.50. Earn 50%" })).toBeInTheDocument();
  });

  it.each([
    [404, "a funnel visitor (or the flag off on the server)"],
    [401, "signed out"],
    [500, "a server error"],
  ])("a %i (%s): one request, nothing shown, no error", async (status) => {
    earnAnswers = [status];
    // As the app's client: queries retry three times by default (here a millisecond apart).
    renderHomeNext({}, new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } }));
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await settle(100);
    expect(earnRequests()).toHaveLength(1);
    expect(moneyPart()).toBeNull();
    expect(moneyLink()).toBeNull();
    expect(screen.queryByText(/couldn't/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Review M3: Home unmounts and mounts with every chat opened and left.
  it("a refused answer is not asked again when Home mounts again", async () => {
    earnAnswers = [404];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
    renderHomeNext({}, qc);
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await settle();
    cleanup();

    renderHomeNext({}, qc);
    expect(moneyPart()).toBeNull();
    await settle(100);
    expect(earnRequests()).toHaveLength(1);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a request that fails before any answer (fetch throws, as with no connection): nothing, no error", async () => {
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === "/api/earn") throw new TypeError("Failed to fetch");
      return base(input, init);
    });
    renderHomeNext();
    await settle(100);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts one GET /api/earn and nothing else of Earn's", async () => {
    renderHomeNext();
    await screen.findByRole("link", { name: "Money made: $58.80. Earn 50%" });
    await settle(100);
    expect(earnRequests()).toEqual(["/api/earn"]);
    const init = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === "/api/earn")![1];
    expect(init?.method ?? "GET").toBe("GET");
    // Every other request is one Home made before the row.
    expect(requested().filter((url) => url !== "/api/earn").every((url) => ["/api/profile", "/api/threads/list"].includes(url) || url.startsWith("/api/threads/library"))).toBe(true);
  });

  it("shares the one GET with every other reader of useEarn (the sidebar's, Earn's): the same key", async () => {
    function OtherReader() {
      const earn = useEarn();
      return <p>{earn.data ? "other reader has it" : "other reader waits"}</p>;
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <OtherReader />
      </QueryClientProvider>,
    );
    renderHomeNext({}, qc);
    await screen.findByRole("link", { name: "Money made: $58.80. Earn 50%" });
    await screen.findByText("other reader has it");
    await settle();
    expect(earnRequests()).toHaveLength(1);
  });

  it("an answer already in the cache (read by the sidebar or Earn moments ago) is shown at once, with no request", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(earnKeys.page, withWhop(5880));
    renderHomeNext({}, qc);
    expect(screen.getByRole("link", { name: "Money made: $58.80. Earn 50%" })).toBeInTheDocument();
    await settle(100);
    expect(earnRequests()).toEqual([]);
  });

  it("once it has answered, a later failed read keeps the row as it was (Home never shows an error for it)", async () => {
    earnAnswers = [withWhop(2450), 500];
    const { qc } = renderHomeNext();
    await screen.findByRole("link", { name: "Money made: $24.50. Earn 50%" });
    await act(async () => {
      await qc.invalidateQueries({ queryKey: earnKeys.page });
    });
    await waitFor(() => expect(earnRequests()).toHaveLength(2));
    await settle();
    expect(screen.getByRole("link", { name: "Money made: $24.50. Earn 50%" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("HomeNext — Recent from Library's summary (Library plan, Task 7)", () => {
  // Times from the real clock, so the lines read "2h ago".
  const at = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

  let A: LibraryChat;
  let B: LibraryChat;
  let C: LibraryChat;
  let D: LibraryChat;
  /** A fifth chat, the oldest of the five: with it Recent is full. */
  let E: LibraryChat;
  /** C again, written to 12 minutes ago (three hooks since its script). */
  let C2: LibraryChat;
  /** The sidebar's short list (`/api/threads/list`). */
  let threadList: ThreadSummary[];
  /**
   * What `/api/threads/library` answers, in turn; the last one again once the others are used. A
   * number is a status; a promise is an answer still on its way.
   */
  let libraryAnswers: Array<LibraryPage | number | Promise<LibraryPage | number>>;
  /** How long each answer of `/api/threads/library` takes, as over a network (ms). */
  let libraryDelay: number;

  beforeEach(() => {
    A = libraryChat("c-a", "Hook formats, the $400 test", at(2), {
      counts: { ...NONE, hooks: 3 },
      lead: "hooks",
      stage: "simulated",
      sim: { number: 66, measure: "stop", at: at(2), kind: "hooks", link: { type: "text", key: "k-a", as: "hook" } },
    });
    // Untitled: a video brought in and simulated.
    B = libraryChat("c-b", null, at(5), {
      counts: { ...NONE, videos: 1 },
      lead: "video",
      stage: "simulated",
      sim: { number: 38, measure: "end", at: at(5), kind: "video", link: { type: "video", analysisId: "a1" } },
      frame: "/frames/b.jpg",
    });
    C = libraryChat("c-c", "Morning routine, no cuts", at(24), { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "draft" });
    D = libraryChat("c-d", "Ideas for next week", at(72));
    E = libraryChat("c-e", "Gym myths for beginners", at(96));
    C2 = { ...C, updatedAt: at(0.2), summary: { ...C.summary, counts: { ...NONE, scripts: 1, hooks: 3 }, lead: "hooks" } };
    threadList = [A, B, C, D].map(listed);
    libraryAnswers = [{ chats: [A, B, C, D], next: "cursor-1" }];
    libraryDelay = 0;

    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/profile")) return json({ name: "Nia Long", avatar: null, email: "x" });
        if (url.endsWith("/api/threads/list")) return json({ threads: threadList });
        if (url.startsWith("/api/threads/library")) {
          if (libraryDelay > 0) await new Promise((resolve) => setTimeout(resolve, libraryDelay));
          const answer = await (libraryAnswers.length > 1 ? libraryAnswers.shift()! : libraryAnswers[0]!);
          return typeof answer === "number" ? json({}, answer) : json(answer);
        }
        if (init?.method === "DELETE" && url.startsWith("/api/threads/")) return json({ success: true });
        return json({}, 404);
      }),
    );
    router.push.mockReset();
    clearActiveThreadCookie();
    useBoardStore.setState({ activeThreadId: null });
    useSidebarStore.setState({ isCollapsed: false });
    useShellStore.setState({ autoRail: false, threadBack: null, threadTitleHint: null, libraryScroll: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const section = () => screen.getByRole("heading", { name: "Recent" }).closest("section")!;
  const textOf = (ids: string | null) =>
    (ids ?? "")
      .split(" ")
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
  /** Recent's rows as a reader hears them: each row's name and description, in order. */
  const rows = () =>
    within(section())
      .getAllByRole("button")
      .map((button) => ({ name: textOf(button.getAttribute("aria-labelledby")), description: textOf(button.getAttribute("aria-describedby")) }));
  const names = () => rows().map((row) => row.name);
  const lines = () => rows().map((row) => row.description);
  const itemOf = (name: string) => screen.getByRole("button", { name }).closest("li")!;
  const settle = (ms = 50) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

  it("Recent is the first page's chats, five at most, in its order, each as Library draws it", async () => {
    // The sidebar's list puts a pinned chat first; Recent follows the endpoint (last written to).
    threadList = [{ ...listed(D), pinned_at: at(100) }, ...[A, B, C].map(listed)];
    renderHomeNext();
    await waitFor(() =>
      expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts", "Ideas for next week"]),
    );
    expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago", "Chat · 3d ago"]);

    // Each tile: the mark of what the chat holds, or the video's picture.
    expect(itemOf("Hook formats, the $400 test").querySelector('[data-part="mark"]')).toHaveAttribute("data-kind", "hooks");
    expect(itemOf("Video simulation").querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "/frames/b.jpg");
    expect(itemOf("Morning routine, no cuts").querySelector('[data-part="mark"]')).toHaveAttribute("data-kind", "script");

    // A gauge for each simulated chat, a link to its result; none for the draft.
    expect(screen.getByRole("link", { name: "Open the result: Hook formats, the $400 test" })).toHaveAttribute(
      "href",
      "/simulation/hook/c-a/k-a",
    );
    expect(screen.getByRole("link", { name: "Open the result: Video simulation" })).toHaveAttribute("href", "/simulation/a1");
    expect(within(itemOf("Morning routine, no cuts")).queryByRole("link")).toBeNull();

    // One page, asked once: Home never pages further.
    await settle();
    expect(libraryRequests()).toEqual(["/api/threads/library"]);
  });

  // After posting (plan 2026-11-24-after-posting, Task 4): the same line as Library's row, through
  // the same row data; the gauge stays what Maven said; Home starts no read of a post.
  it("a posted chat's row says what the post did (Library's phone line), its mark on its own line in its tone's colour; the gauge is what Maven said; Home reads no post", async () => {
    const P = libraryChat("c-p", "Stop buying snacks, do this", at(1), {
      counts: { ...NONE, hooks: 5 },
      lead: "hooks",
      stage: "posted",
      sim: { number: 67, measure: "stop", at: at(100), kind: "hooks", link: { type: "text", key: "k-p", as: "hook" } },
      posted: {
        id: "post-c-p",
        threadId: "c-p",
        pieceKey: "k-p",
        said: { number: 67, measure: "stop" },
        state: "final",
        linkedAt: at(95),
        postedAt: at(96),
        finalAt: at(24),
        numbers: { views: 31_000, likes: 2_100, comments: 84, shares: 310, saves: 420 },
        usual: { ratio: 1.8, tone: "above" },
        handle: "nia.cooks",
        href: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789",
        // Owed a read: Library would ask for one; Home never does.
        due: true,
      },
    });
    const R = libraryChat("c-r", "Lentils, three ways", at(1.5), {
      counts: { ...NONE, hooks: 2 },
      lead: "hooks",
      stage: "posted",
      sim: { number: 61, measure: "stop", at: at(100), kind: "hooks", link: { type: "text", key: "k-r", as: "hook" } },
      posted: { ...P.summary.posted!, id: "post-c-r", threadId: "c-r", state: "reading", postedAt: null, finalAt: null, numbers: null, usual: null, handle: null, href: null },
    });
    libraryAnswers = [{ chats: [P, R, A], next: null }];
    threadList = [P, R, A].map(listed);
    renderHomeNext();
    await waitFor(() => expect(names()).toEqual(["Stop buying snacks, do this", "Lentils, three ways", "Hook formats, the $400 test"]));
    // Library's phone line at every width (Home has no column), heard once (ruling 30).
    expect(screen.getByRole("button", { name: "Stop buying snacks, do this" })).toHaveAccessibleDescription("Posted 4d ago · 31K views 1.8× your usual");
    expect(screen.getByRole("button", { name: "Lentils, three ways" })).toHaveAccessibleDescription("Posted · reading the post");
    expect(screen.getByRole("button", { name: "Hook formats, the $400 test" })).toHaveAccessibleDescription("3 hooks · simulated 2h ago");

    const item = itemOf("Stop buying snacks, do this");
    // No form that switches at 768: the phone's line is the only one.
    expect(item.querySelector('[data-part="phone-line"]')).not.toHaveClass("md:hidden");
    expect(item.querySelector('[data-part="desk-line"]')).toBeNull();
    // The numbers one unbroken piece; the mark on its own line, no separator before it, in its colour.
    const pieces = Array.from(item.querySelectorAll('[data-part="piece"]'));
    expect(pieces.map((piece) => piece.textContent?.replace(/·/g, "").trim())).toEqual(["Posted 4d ago", "31K views"]);
    for (const piece of pieces) expect(piece).toHaveClass("whitespace-nowrap");
    const usual = item.querySelector('[data-part="usual"]')!;
    expect(usual.textContent).toBe("1.8× your usual");
    expect(usual).toHaveClass("block", "whitespace-nowrap", "text-above");
    // The posted line may wrap; the others stay one line, cut.
    const lineOf = (name: string) => document.getElementById(screen.getByRole("button", { name }).getAttribute("aria-describedby")!)!;
    expect(lineOf("Stop buying snacks, do this")).not.toHaveClass("truncate");
    expect(lineOf("Hook formats, the $400 test")).toHaveClass("truncate");

    expect(screen.getByRole("link", { name: "Open the result: Stop buying snacks, do this" })).toHaveAccessibleDescription("67% would stop to watch");
    // Nothing else coloured, no menu.
    expect(section().querySelectorAll(".text-above, .text-below-text")).toHaveLength(1);
    expect(within(section()).queryByRole("button", { name: /^More/ })).toBeNull();
    await settle();
    expect(requested().filter((url) => url.startsWith("/api/posted"))).toEqual([]);
  });

  it("Recent is the five chats written to last, not the page's first five: old pinned chats heading the page do not show", async () => {
    // The endpoint lists pinned chats first, most recently pinned first.
    const summer = { ...libraryChat("c-p1", "Pinned in the summer", at(24 * 120)), pinned: true };
    const month = { ...libraryChat("c-p2", "Pinned last month", at(24 * 30)), pinned: true };
    libraryAnswers = [{ chats: [summer, month, A, B, C, D, E], next: "cursor-1" }];
    threadList = [summer, month, A, B, C, D, E].map((chat) => ({ ...listed(chat), pinned_at: chat.pinned ? at(1) : null }));
    renderHomeNext();
    await waitFor(() =>
      expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago", "Chat · 3d ago", "Chat · 4d ago"]),
    );
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts", "Ideas for next week", "Gym myths for beginners"]);
    await settle();
    expect(libraryRequests()).toEqual(["/api/threads/library"]);
  });

  it("a pinned chat written to lately is among them, in its place by last message", async () => {
    const lately = { ...C2, pinned: true };
    const summer = { ...libraryChat("c-p1", "Pinned in the summer", at(24 * 120)), pinned: true };
    libraryAnswers = [{ chats: [summer, lately, A, B, D, E], next: null }];
    threadList = [summer, lately, A, B, D, E].map(listed);
    renderHomeNext();
    await waitFor(() =>
      expect(lines()).toEqual(["3 hooks · 12m ago", "3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Chat · 3d ago", "Chat · 4d ago"]),
    );
    expect(names()).toEqual(["Morning routine, no cuts", "Hook formats, the $400 test", "Video simulation", "Ideas for next week", "Gym myths for beginners"]);
  });

  it("while the summary is out, Recent is the list's titles and times; then each row grows its tile, line and gauge", async () => {
    let answer!: (page: LibraryPage) => void;
    libraryAnswers = [new Promise<LibraryPage>((resolve) => (answer = resolve))];
    renderHomeNext();
    await waitFor(() => expect(names()).toEqual(["Hook formats, the $400 test", "Morning routine, no cuts", "Ideas for next week"]));
    expect(lines()).toEqual(["2h ago", "1d ago", "3d ago"]);
    // Each row already in the summary row's shape: the plain chat mark, no picture.
    expect([...section().querySelectorAll('[data-part="mark"]')].map((mark) => mark.getAttribute("data-kind"))).toEqual(["chat", "chat", "chat"]);
    expect(section().querySelector('[data-part="thumb"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
    expect(libraryRequests()).toHaveLength(1);

    await act(async () => answer({ chats: [A, B, C, D], next: null }));
    await waitFor(() => expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago", "Chat · 3d ago"]));
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts", "Ideas for next week"]);
  });

  it("the summary landing on the same three chats keeps the rows: same order, same ids, same elements, same height (fix round 1)", async () => {
    let answer!: (page: LibraryPage) => void;
    libraryAnswers = [new Promise<LibraryPage>((resolve) => (answer = resolve))];
    threadList = [A, C, D].map(listed);
    renderHomeNext();
    await waitFor(() => expect(lines()).toEqual(["2h ago", "1d ago", "3d ago"]));
    const before = within(section()).getAllByRole("button");
    const ids = () => within(section()).getAllByRole("listitem").map((item) => item.getAttribute("data-chat"));
    const idsBefore = ids();
    expect(idsBefore).toEqual(["c-a", "c-c", "c-d"]);

    await act(async () => answer({ chats: [A, C, D], next: null }));
    await waitFor(() => expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Script · 1d ago", "Chat · 3d ago"]));
    const after = within(section()).getAllByRole("button");
    expect(ids()).toEqual(idsBefore);
    expect(after).toHaveLength(3);
    after.forEach((button, i) => {
      // The same element, not a new row drawn in its place, and the same height.
      expect(button).toBe(before[i]);
      expect(button).toHaveClass("min-h-[72px]");
    });
  });

  it("a Home load with the Library's pages in the cache asks for one page, never theirs (fix round 1)", async () => {
    // The Library was open before: its own entry holds three pages.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["library", "chats", ""], {
      pages: [{ chats: [A, B, C], next: "cursor-1" }, { chats: [D], next: "cursor-2" }, { chats: [], next: null }],
      pageParams: [null, "cursor-1", "cursor-2"],
    });
    // Behind the list, so Home also asks once more.
    threadList = [listed(C2), ...[A, B, D].map(listed)];
    libraryAnswers = [{ chats: [A, B, C, D], next: "cursor-1" }];
    renderHomeNext({}, qc);
    await waitFor(() => expect(libraryRequests()).toHaveLength(2));
    await settle(100);
    expect(libraryRequests()).toEqual(["/api/threads/library", "/api/threads/library"]);
  });

  it.each([404, 500])("a %i from the summary is one request, no retry, and Home keeps the list's rows (fix round 1)", async (status) => {
    libraryAnswers = [status];
    // As the app's client: queries retry three times by default (here a millisecond apart).
    renderHomeNext({}, new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } }));
    await waitFor(() => expect(libraryRequests()).toHaveLength(1));
    await settle(100);
    expect(libraryRequests()).toHaveLength(1);
    expect(lines()).toEqual(["2h ago", "1d ago", "3d ago"]);
  });

  it("if the summary fails, Recent stays the list's titles and times, and Home says nothing of it", async () => {
    libraryAnswers = [500];
    renderHomeNext();
    await waitFor(() => expect(libraryRequests()).toHaveLength(1));
    await settle();
    expect(names()).toEqual(["Hook formats, the $400 test", "Morning routine, no cuts", "Ideas for next week"]);
    expect(lines()).toEqual(["2h ago", "1d ago", "3d ago"]);
    expect(screen.queryByText(/couldn't/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a tap opens the chat as Home always has: no way back to Library is left set", async () => {
    // Left over from a chat opened from Library earlier.
    useShellStore.setState({ threadBack: "/library" });
    renderHomeNext();
    fireEvent.click(await screen.findByRole("button", { name: "Video simulation" }));
    expect(getActiveThreadCookie()).toBe("c-b");
    expect(useBoardStore.getState().activeThreadId).toBe("c-b");
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("an untitled chat opened from its row keeps the row's name for its header; a titled one is handed none", async () => {
    renderHomeNext();
    fireEvent.click(await screen.findByRole("button", { name: "Video simulation" }));
    expect(useShellStore.getState().threadTitleHint).toEqual({ id: "c-b", title: "Video simulation" });
    fireEvent.click(screen.getByRole("button", { name: "Hook formats, the $400 test" }));
    expect(useShellStore.getState().threadTitleHint).toBeNull();
  });

  it("a tap marks Library's lists old (Recent's page and Library's) and reads nothing; Home shown again reads its page", async () => {
    const { qc } = renderHomeNext();
    await screen.findByRole("button", { name: "Video simulation" });
    await settle();
    // Library's pages, left in the cache by an earlier visit.
    qc.setQueryData(["library", "chats", ""], { pages: [{ chats: [A], next: null }], pageParams: [null] });
    const before = libraryRequests().length;
    fireEvent.click(screen.getByRole("button", { name: "Video simulation" }));
    const entries = qc.getQueryCache().findAll({ queryKey: ["library"] });
    expect(entries).toHaveLength(2);
    expect(entries.every((query) => query.isStale())).toBe(true);
    await settle();
    expect(libraryRequests()).toHaveLength(before);

    // Back on Home: its page is read again, the rows it had stay meanwhile.
    cleanup();
    let fresh!: (page: LibraryPage) => void;
    libraryAnswers = [new Promise<LibraryPage>((resolve) => (fresh = resolve))];
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <HomeNext field={<div data-testid="slot" />} audience={AUDIENCE} credits={null} onPickSkill={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(libraryRequests()).toHaveLength(before + 1));
    const four = ["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts", "Ideas for next week"];
    expect(names()).toEqual(four);
    await act(async () => fresh({ chats: [A, B, C, D], next: null }));
    expect(names()).toEqual(four);
  });

  it("a first page with fewer than five chats: those, and no other page is asked for", async () => {
    libraryAnswers = [{ chats: [A], next: "cursor-1" }];
    threadList = [A, C, D].map(listed);
    renderHomeNext();
    await waitFor(() => expect(lines()).toEqual(["3 hooks · simulated 2h ago"]));
    await settle();
    expect(names()).toEqual(["Hook formats, the $400 test"]);
    expect(libraryRequests()).toEqual(["/api/threads/library"]);
  });

  it("behind the sidebar's list (a chat written to since), Recent is the list's own until the summary, asked again, agrees", async () => {
    let fresh!: (page: LibraryPage) => void;
    threadList = [listed(C2), ...[A, B, D].map(listed)];
    libraryAnswers = [{ chats: [A, B, C, D], next: null }, new Promise<LibraryPage>((resolve) => (fresh = resolve))];
    renderHomeNext();
    // Not the summary's old order and old line: the list's chats and times.
    await waitFor(() => expect(lines()).toEqual(["12m ago", "2h ago", "3d ago"]));
    expect(names()).toEqual(["Morning routine, no cuts", "Hook formats, the $400 test", "Ideas for next week"]);
    await waitFor(() => expect(libraryRequests()).toHaveLength(2));

    await act(async () => fresh({ chats: [C2, A, B, D], next: null }));
    await waitFor(() => expect(lines()).toEqual(["3 hooks · 12m ago", "3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Chat · 3d ago"]));
    expect(names()).toEqual(["Morning routine, no cuts", "Hook formats, the $400 test", "Video simulation", "Ideas for next week"]);
  });

  it("a summary that stays behind is asked again once, not over and over; the list's rows stay", async () => {
    threadList = [listed(C2), ...[A, B, D].map(listed)];
    libraryAnswers = [{ chats: [A, B, C, D], next: null }];
    // Slow enough that each request is seen going out and coming back.
    libraryDelay = 15;
    renderHomeNext();
    await waitFor(() => expect(libraryRequests()).toHaveLength(2));
    await settle(250);
    expect(libraryRequests()).toHaveLength(2);
    expect(lines()).toEqual(["12m ago", "2h ago", "3d ago"]);
  });

  it("a chat deleted from the sidebar leaves Recent at once, and the summary is asked again", async () => {
    const { qc } = renderHomeNext();
    await screen.findByRole("button", { name: "Video simulation" });

    // The sidebar's own delete (its real hook), on the same cache.
    function Sidebar() {
      const archive = useArchiveThread();
      return (
        <button type="button" onClick={() => archive.mutate("c-a")}>
          Delete chat
        </button>
      );
    }
    render(
      <QueryClientProvider client={qc}>
        <Sidebar />
      </QueryClientProvider>,
    );
    threadList = [B, C, D].map(listed);
    libraryAnswers = [{ chats: [B, C, D], next: null }];
    fireEvent.click(screen.getByRole("button", { name: "Delete chat" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Hook formats, the $400 test" })).toBeNull());
    await waitFor(() => expect(names()).toEqual(["Video simulation", "Morning routine, no cuts", "Ideas for next week"]));
    expect(lines()).toEqual(["Video · simulated 5h ago", "Script · 1d ago", "Chat · 3d ago"]);
    expect(libraryRequests().length).toBeGreaterThanOrEqual(2);
  });
});
