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

import { HOME_RECENT_LIMIT, HomeNext, recentRows, summaryAgrees } from "../home-next";

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

function renderHomeNext(
  over: Partial<ComponentProps<typeof HomeNext>> = {},
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const onPickSkill = vi.fn();
  const onMore = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <HomeNext field={<div data-testid="slot" />} credits={null} picked={false} onPickSkill={onPickSkill} onMore={onMore} {...over} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onPickSkill, onMore, qc };
}

describe("recentRows", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves untitled chats out and takes the three last written to", () => {
    const rows = recentRows([
      thread("a", null),
      thread("b", "Meal prep for busy students"),
      thread("c", ""),
      thread("d", "Fake a $10M camera move", 24),
      thread("e", "  "),
      thread("f", "Morning routine, no cuts", 72),
      thread("g", "Ideas for next week", 96),
    ]);
    expect(HOME_RECENT_LIMIT).toBe(3);
    expect(rows.map((row) => row.id)).toEqual(["b", "d", "f"]);
  });

  it("is by last message, not the sidebar's order: an old pinned chat does not lead", () => {
    // The list arrives pinned first (the sidebar's order).
    const pinned = { ...thread("p", "Pinned in the summer", 118 * 24), pinned_at: new Date(NOW - 100 * 24 * HOUR).toISOString() };
    const rows = recentRows([pinned, thread("x", "Three days ago", 72), thread("y", "Today", 1), thread("z", "Yesterday", 26)]);
    expect(rows.map((row) => row.id)).toEqual(["y", "z", "x"]);
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

  it("More skills reaches the composer's onMore (final fix A1)", async () => {
    const { onMore } = renderHome();
    fireEvent.click(screen.getByRole("button", { name: "More skills" }));
    expect(onMore).toHaveBeenCalledTimes(1);
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

  it("shows the balance it is given, and a card picks its skill", async () => {
    const { onPickSkill } = renderHome({ credits: 12 });
    expect(screen.getByText("12 credits")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));
    expect(onPickSkill).toHaveBeenCalledWith("hooks");
    await screen.findByRole("button", { name: "Meal prep for busy students" });
  });

  it("with the sidebar open, Recent is the phone's only (the sidebar lists the same chats)", async () => {
    renderHome();
    await screen.findByRole("button", { name: "Meal prep for busy students" });
    expect(recentSection()).toHaveClass("md:hidden");
  });

  it("with the sidebar as the rail, Recent shows on desktop too", async () => {
    useSidebarStore.setState({ isCollapsed: true });
    renderHome();
    await screen.findByRole("button", { name: "Meal prep for busy students" });
    expect(recentSection()).not.toHaveClass("md:hidden");
  });

  it("the narrow-window rail counts as the rail", async () => {
    useShellStore.setState({ autoRail: true });
    renderHome();
    await screen.findByRole("button", { name: "Meal prep for busy students" });
    expect(recentSection()).not.toHaveClass("md:hidden");
  });
});

describe("HomeNext — Money made (Earn, step C; rulings 18 and 24)", () => {
  /** What `GET /api/earn` answers, in turn (the last one again once the others are used): a page, a status, or an answer on its way. */
  let earnAnswers: Array<EarnPage | number | Promise<EarnPage | number>>;
  const PAGE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 2, whop: null };
  const withWhop = (earnedCents: number | null): EarnPage => ({
    ...PAGE,
    whop: { canEnrol: true, knownAccount: false, username: "nia.example", earnedCents },
  });

  beforeEach(() => {
    earnAnswers = [PAGE];
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

  it("holds the row's space while Earn has not answered, then the row lands in it: Money made, $0, Earn 50%, a link to Earn", async () => {
    let answer!: (page: EarnPage) => void;
    earnAnswers = [new Promise<EarnPage>((resolve) => (answer = resolve))];
    renderHomeNext();
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    const holding = moneyPart()!;
    expect(holding).toHaveAttribute("aria-hidden", "true");
    expect(holding.firstElementChild).toHaveClass("h-12");
    expect(moneyLink()).toBeNull();

    await act(async () => answer(PAGE));
    const link = await screen.findByRole("link", { name: "Money made: $0. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*\$0\s*Earn 50%$/);
    // In the place that was held: the same element, no jump.
    expect(moneyPart()).toBe(holding);
    expect(holding).not.toHaveAttribute("aria-hidden");
    expect(link).toHaveClass("h-12");
  });

  it("Earn 50% is built from the rate's constant", async () => {
    renderHomeNext();
    expect(await screen.findByRole("link", { name: `Money made: $0. ${headline()}` })).toBeInTheDocument();
    expect(headline()).toBe(`Earn ${EARN_RATE_PCT}%`);
  });

  it.each([
    [2450, "$24.50"],
    [124_000, "$1,240"],
    [124_050, "$1,240.50"],
    [0, "$0"],
  ])("with Whop's number (%i cents) the amount is %s", async (cents, words) => {
    earnAnswers = [withWhop(cents)];
    renderHomeNext();
    const link = await screen.findByRole("link", { name: `Money made: ${words}. Earn 50%` });
    expect(within(link).getByText(words)).toBeInTheDocument();
  });

  // Ruling 24c: "could not be read" is not "nothing earned".
  it("an enrolled creator whose number could not be read is not told $0: Money made and Earn 50%, no amount", async () => {
    earnAnswers = [withWhop(null)];
    renderHomeNext();
    const link = await screen.findByRole("link", { name: "Money made. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*Earn 50%$/);
    expect(link.textContent).not.toContain("$");
    expect(screen.queryByRole("link", { name: /^Money made:/ })).toBeNull();
    // In the row's own place, as tall as any other.
    expect(moneyPart()!.contains(link)).toBe(true);
    expect(link).toHaveClass("h-12");
  });

  it.each<[string, EarnPage["whop"]]>([
    ["the payment side was not read (whop null)", null],
    ["not enrolled, the number null", { canEnrol: true, knownAccount: false, username: null, earnedCents: null }],
    ["not enrolled, a paying customer who has not set up payouts", { canEnrol: true, knownAccount: true, username: null, earnedCents: null }],
    ["not enrolled, payouts not available here", { canEnrol: false, knownAccount: false, username: null, earnedCents: null }],
    ["enrolled, nothing earned yet (Whop says 0)", { canEnrol: true, knownAccount: true, username: "nia.example", earnedCents: 0 }],
  ])("%s: the amount is zero dollars, which is true", async (_name, whop) => {
    earnAnswers = [{ ...PAGE, whop }];
    renderHomeNext();
    const link = await screen.findByRole("link", { name: "Money made: $0. Earn 50%" });
    expect(within(link).getByText("$0")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Money made. Earn 50%" })).toBeNull();
  });

  it("the number read later (the next read answers it) takes its place in the same row", async () => {
    earnAnswers = [withWhop(null), withWhop(2450)];
    const { qc } = renderHomeNext();
    await screen.findByRole("link", { name: "Money made. Earn 50%" });
    const part = moneyPart();
    await act(async () => {
      await qc.invalidateQueries({ queryKey: earnKeys.page });
    });
    const link = await screen.findByRole("link", { name: "Money made: $24.50. Earn 50%" });
    expect(moneyPart()).toBe(part);
    expect(part!.contains(link)).toBe(true);
  });

  it.each([
    [404, "a funnel visitor (or the flag off on the server)"],
    [401, "signed out"],
    [500, "a server error"],
  ])("a %i (%s): one request, the space collapses, nothing is shown, no error", async (status) => {
    earnAnswers = [status];
    // As the app's client: queries retry three times by default (here a millisecond apart).
    renderHomeNext({}, new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } }));
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await waitFor(() => expect(moneyPart()).toBeNull());
    await settle(100);
    expect(earnRequests()).toHaveLength(1);
    expect(moneyLink()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    expect(screen.queryByText(/couldn't/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // The field back where it is without the row.
    expect(screen.getByTestId("slot").parentElement).toHaveClass("mt-3", "md:mt-7");
  });

  // Review M3: Home unmounts and mounts with every chat opened and left.
  it("a refused answer is not asked again when Home mounts again: no request, and no space kept even for a moment", async () => {
    earnAnswers = [404];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
    renderHomeNext({}, qc);
    await waitFor(() => expect(earnRequests()).toHaveLength(1));
    await waitFor(() => expect(moneyPart()).toBeNull());
    cleanup();

    renderHomeNext({}, qc);
    // From its first render: Home as it is without the row.
    expect(moneyPart()).toBeNull();
    expect(screen.getByTestId("slot").parentElement).toHaveClass("mt-3", "md:mt-7");
    await settle(100);
    expect(earnRequests()).toHaveLength(1);
    expect(moneyPart()).toBeNull();
    expect(moneyLink()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a request that fails before any answer (fetch throws, as with no connection): nothing, no error", async () => {
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === "/api/earn") throw new TypeError("Failed to fetch");
      return base(input, init);
    });
    renderHomeNext();
    await waitFor(() => expect(moneyPart()).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts one GET /api/earn and nothing else of Earn's", async () => {
    renderHomeNext();
    await screen.findByRole("link", { name: "Money made: $0. Earn 50%" });
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
    await screen.findByRole("link", { name: "Money made: $0. Earn 50%" });
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

  it("Recent is the first page's first three chats, in its order, each as Library draws it", async () => {
    // The sidebar's list puts a pinned chat first; Recent follows the endpoint (last written to).
    threadList = [{ ...listed(D), pinned_at: at(100) }, ...[A, B, C].map(listed)];
    renderHomeNext();
    await waitFor(() => expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts"]));
    expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago"]);

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

  it("Recent is the three chats written to last, not the page's first three: old pinned chats heading the page do not show", async () => {
    // The endpoint lists pinned chats first, most recently pinned first.
    const summer = { ...libraryChat("c-p1", "Pinned in the summer", at(24 * 120)), pinned: true };
    const month = { ...libraryChat("c-p2", "Pinned last month", at(24 * 30)), pinned: true };
    libraryAnswers = [{ chats: [summer, month, A, B, C, D], next: "cursor-1" }];
    threadList = [summer, month, A, B, C, D].map((chat) => ({ ...listed(chat), pinned_at: chat.pinned ? at(1) : null }));
    renderHomeNext();
    await waitFor(() => expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago"]));
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts"]);
    await settle();
    expect(libraryRequests()).toEqual(["/api/threads/library"]);
  });

  it("a pinned chat written to lately is among them, in its place by last message", async () => {
    const lately = { ...C2, pinned: true };
    const summer = { ...libraryChat("c-p1", "Pinned in the summer", at(24 * 120)), pinned: true };
    libraryAnswers = [{ chats: [summer, lately, A, B, D], next: null }];
    threadList = [summer, lately, A, B, D].map(listed);
    renderHomeNext();
    await waitFor(() => expect(lines()).toEqual(["3 hooks · 12m ago", "3 hooks · simulated 2h ago", "Video · simulated 5h ago"]));
    expect(names()).toEqual(["Morning routine, no cuts", "Hook formats, the $400 test", "Video simulation"]);
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
    await waitFor(() => expect(lines()).toEqual(["3 hooks · simulated 2h ago", "Video · simulated 5h ago", "Script · 1d ago"]));
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts"]);
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
          <HomeNext field={<div data-testid="slot" />} credits={null} picked={false} onPickSkill={vi.fn()} onMore={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(libraryRequests()).toHaveLength(before + 1));
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts"]);
    await act(async () => fresh({ chats: [A, B, C, D], next: null }));
    expect(names()).toEqual(["Hook formats, the $400 test", "Video simulation", "Morning routine, no cuts"]);
  });

  it("a first page with fewer than three chats: those, and no other page is asked for", async () => {
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
    await waitFor(() => expect(lines()).toEqual(["3 hooks · 12m ago", "3 hooks · simulated 2h ago", "Video · simulated 5h ago"]));
    expect(names()).toEqual(["Morning routine, no cuts", "Hook formats, the $400 test", "Video simulation"]);
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
