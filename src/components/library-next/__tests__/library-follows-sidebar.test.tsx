/** @vitest-environment happy-dom */

/**
 * On a desk the sidebar sits beside Library. A rename, pin or delete made in the sidebar reaches the
 * Library on screen: once it went through, Library's lists are marked old and the one on screen is
 * read again.
 *
 * The real sidebar (`SideNav` with the shell's real thread actions and the app's real thread
 * hooks), the real Library and TanStack Query. Stand-ins only at the edges: `fetch` (a small server
 * that keeps the chats' titles, pins and deletions), the router and the address, the storage
 * client, `matchMedia`, and the build-time flag (on).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { LibraryChat } from "@/lib/library/library-page";
import { clearActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));

import { SideNav } from "@/components/shell/side-nav";
import { useThreadActions } from "@/components/shell/use-thread-actions";
import { LibraryNext } from "../library-next";

// ─── The server ──────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const NONE = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

interface Stored {
  id: string;
  title: string | null;
  updatedAt: string;
  pinnedAt: string | null;
  deleted: boolean;
}
let chats: Stored[] = [];
/** How the server answers a rename, a pin or a delete: a status. */
let answer = 200;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const libraryChat = (chat: Stored): LibraryChat => ({
  id: chat.id,
  title: chat.title,
  updatedAt: chat.updatedAt,
  pinned: chat.pinnedAt !== null,
  summary: { counts: NONE, lead: "chat", stage: "chat", sim: null, frame: null, videoPath: null, posted: null },
});

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  const open = chats.filter((chat) => !chat.deleted);
  if (url.pathname === "/api/threads/library") return json({ chats: open.map(libraryChat), next: null });
  if (url.pathname === "/api/threads/list") {
    return json({
      threads: open.map((chat) => ({ id: chat.id, title: chat.title, updated_at: chat.updatedAt, created_at: chat.updatedAt, pinned_at: chat.pinnedAt })),
    });
  }
  const one = /^\/api\/threads\/([^/]+)$/.exec(url.pathname);
  if (one && (method === "PATCH" || method === "DELETE")) {
    if (answer !== 200) return json({ error: "refused" }, answer);
    const chat = chats.find((c) => c.id === one[1]);
    if (!chat) return json({ error: "Thread not found" }, 404);
    if (method === "DELETE") chat.deleted = true;
    else {
      const body = JSON.parse(String(init?.body)) as { title?: string; pinned?: boolean };
      if (body.title !== undefined) chat.title = body.title.trim() || null;
      if (body.pinned !== undefined) chat.pinnedAt = body.pinned ? new Date().toISOString() : null;
    }
    return json(method === "DELETE" ? { threadId: chat.id } : { ok: true });
  }
  return json({}, 404);
});
const libraryCalls = () => fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === "/api/threads/library");

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;

function Beside() {
  const actions = useThreadActions();
  return (
    <>
      <SideNav actions={actions} />
      <LibraryNext />
    </>
  );
}

function renderBoth() {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TooltipProvider>
          <Beside />
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const sidebar = () => screen.getByRole("navigation", { name: "App navigation" });
const library = () => screen.getByRole("list", { name: "Chats" });
/** The Library's rows' titles, top to bottom. */
const libraryTitles = () =>
  within(library())
    .queryAllByRole("button")
    .filter((button) => button.parentElement?.tagName === "LI")
    .map((button) => document.getElementById(button.getAttribute("aria-labelledby")!.split(" ")[0]!)!.textContent);
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 80)));

beforeEach(() => {
  // The app's QueryClient: a minute fresh, no refetch on focus; no retries, so a refusal is at once.
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false }, mutations: { retry: false } } });
  chats = [
    { id: "c1", title: "Gym hooks", updatedAt: ago(1), pinnedAt: null, deleted: false },
    { id: "c2", title: "Morning routine", updatedAt: ago(2), pinnedAt: null, deleted: false },
    { id: "c3", title: "Meal ideas", updatedAt: ago(3), pinnedAt: null, deleted: false },
  ];
  answer = 200;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("min-width"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false });
  useShellStore.setState({ autoRail: false, threadOpen: false, threadBack: null, threadTitleHint: null, libraryScroll: null });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function ready() {
  renderBoth();
  await waitFor(() => expect(libraryTitles()).toEqual(["Gym hooks", "Morning routine", "Meal ideas"]));
  await within(sidebar()).findByRole("button", { name: "Meal ideas" });
  await settle();
  return libraryCalls().length;
}

describe("Library beside the sidebar follows the sidebar's actions", () => {
  it("a rename in the sidebar: Library's list is read again and its row shows the new title", async () => {
    const before = await ready();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Rename Morning routine" }));
    const field = within(sidebar()).getByRole("textbox", { name: "Rename Morning routine" });
    fireEvent.change(field, { target: { value: "Morning routine, no cuts" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(libraryTitles()).toEqual(["Gym hooks", "Morning routine, no cuts", "Meal ideas"]));
    expect(libraryCalls()).toHaveLength(before + 1);
  });

  it("a pin in the sidebar: Library's list is read again and its row is drawn pinned", async () => {
    const before = await ready();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Pin Meal ideas" }));
    await waitFor(() => expect(within(library()).getByRole("button", { name: "Meal ideas" })).toHaveAccessibleDescription(/^Pinned,/));
    expect(libraryCalls()).toHaveLength(before + 1);
  });

  it("a delete in the sidebar: Library's list is read again and the row leaves", async () => {
    const before = await ready();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Delete thread: Gym hooks" }));
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Delete Gym hooks" }));
    await waitFor(() => expect(libraryTitles()).toEqual(["Morning routine", "Meal ideas"]));
    expect(libraryCalls()).toHaveLength(before + 1);
  });

  it("a refused rename changes nothing on the server: Library is not read again", async () => {
    const before = await ready();
    answer = 500;
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Rename Morning routine" }));
    const field = within(sidebar()).getByRole("textbox", { name: "Rename Morning routine" });
    fireEvent.change(field, { target: { value: "Something else" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await settle();
    await settle();
    expect(libraryCalls()).toHaveLength(before);
    expect(libraryTitles()).toEqual(["Gym hooks", "Morning routine", "Meal ideas"]);
  });
});
