/** @vitest-environment happy-dom */

/**
 * HomeNext — Home with its real data: the profile and the chat list through react-query, the
 * real thread actions (the active-thread cookie, the board store) and the real sidebar stores.
 * Stand-ins only at the edges: `fetch`, the router, `matchMedia`, and the clock for `recentRows`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { ThreadSummary } from "@/hooks/queries";
import { queryKeys } from "@/lib/queries/query-keys";
import { clearActiveThreadCookie, getActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { THREAD_TITLE_MAX } from "@/lib/threads/title";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";

vi.setConfig({ testTimeout: 20_000 });

// One object, as the real App Router returns.
const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => router,
}));

import { HOME_RECENT_LIMIT, HomeNext, recentRows } from "../home-next";

const NOW = new Date("2026-11-23T10:00:00Z").getTime();
const HOUR = 3_600_000;

const thread = (id: string, title: string | null, hoursAgo = 2): ThreadSummary => ({
  id,
  title,
  updated_at: new Date(NOW - hoursAgo * HOUR).toISOString(),
  created_at: new Date(NOW - 48 * HOUR).toISOString(),
  pinned_at: null,
});

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

describe("HomeNext", () => {
  const THREADS = [thread("t1", "Meal prep for busy students", 2), thread("t2", "Fake a $10M camera move", 24)];

  beforeEach(() => {
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

  function renderHome(over: Partial<React.ComponentProps<typeof HomeNext>> = {}, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const onPickSkill = vi.fn();
    const onMore = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <HomeNext field={<div data-testid="slot" />} credits={null} picked={false} onPickSkill={onPickSkill} onMore={onMore} {...over} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    return { onPickSkill, onMore };
  }

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

  it("holds the heading and the avatar until the profile has answered: no nameless greeting, no \"?\"", async () => {
    let answer!: (response: Response) => void;
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).endsWith("/api/profile") ? new Promise<Response>((resolve) => (answer = resolve)) : base(input, init),
    );
    renderHome();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("aria-busy", "true");
    expect(heading.textContent?.trim()).toBe("");
    expect(screen.getByRole("link", { name: "Account" })).not.toHaveTextContent("?");
    await waitFor(() => expect(answer).toBeTypeOf("function"));
    answer(new Response(JSON.stringify({ name: "Nia Long", avatar: null, email: "x" }), { status: 200 }));
    await waitFor(() => expect(heading).toHaveTextContent(/^Good (morning|afternoon|evening), Nia\.$/));
    expect(heading).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("link", { name: "Account" })).toHaveTextContent("NL");
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
