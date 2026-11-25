/** @vitest-environment happy-dom */

/**
 * The phone's drawer, rendered for real: the Radix dialog, the stores, `useThreadActions`, a real
 * QueryClient reading the chat list and the profile, and `useSubscription` reading the balance.
 * Stand-ins only at the edges: `fetch`, `next/navigation`, the browser Supabase client, the flag, and
 * the window's width (`innerWidth` with a `resize` event).
 *
 * The harness draws what the shell will draw around it: an opener (any element marked
 * `data-drawer-opener`) and the message field, which takes the cursor when `fieldFocusSignal`
 * moves, as the composer does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";

const { router, signOut, nav } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
  signOut: vi.fn(async () => ({ error: null })),
  nav: { pathname: "/home" },
}));

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import { ToastProvider } from "@/components/ui/toast";
import { queryKeys } from "@/lib/queries/query-keys";
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  getActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { Drawer } from "../drawer";
import { useThreadActions } from "../use-thread-actions";

// ── The network ──────────────────────────────────────────────────────────────────────────────

interface Chat {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
  pinned_at: string | null;
}
const chat = (id: string, title: string | null): Chat => ({
  id,
  title,
  updated_at: "2026-11-24T10:00:00Z",
  created_at: "2026-11-24T09:00:00Z",
  pinned_at: null,
});
const HEADSET = chat("c-headset", "Hooks for the dream headset video");
const GHOSTS = chat("c-ghosts", "Remix: ghost factories");
const IDEAS = chat("c-ideas", "Ideas for next week");

const PRO = {
  tier: "pro",
  isTrial: false,
  usage: { used: 470, limit: 500, remaining: 30, enforced: false, inTrial: false, renewsAt: null, periodStart: null },
};
const NIA = { name: "Nia Long", email: "nia.tests@example.com", avatar: null as string | null };

/** What an endpoint answers: a body (200), a status with a body, or a promise the test resolves. */
type Answer = { status?: number; body: unknown } | { held: Promise<{ status?: number; body: unknown }> };
const answers: Record<"threads" | "profile" | "subscription", Answer> = {
  threads: { body: { threads: [] } },
  profile: { body: NIA },
  subscription: { body: PRO },
};

const toResponse = ({ status = 200, body }: { status?: number; body: unknown }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const path = new URL(String(input), "http://localhost").pathname;
  const key = path === "/api/threads/list" ? "threads" : path === "/api/profile" ? "profile" : path === "/api/subscription" ? "subscription" : null;
  if (!key) throw new Error(`unexpected request: ${path}`);
  const answer = answers[key];
  return "held" in answer ? toResponse(await answer.held) : toResponse(answer);
});
const requests = (path: string) =>
  fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === path).length;

/** A promise the test resolves when it wants the answer to arrive. */
function deferred() {
  let resolve!: (value: { status?: number; body: unknown }) => void;
  const held = new Promise<{ status?: number; body: unknown }>((r) => {
    resolve = r;
  });
  return { held, resolve };
}

// ── The harness ──────────────────────────────────────────────────────────────────────────────

function Harness() {
  const actions = useThreadActions();
  return (
    <>
      <button type="button" data-drawer-opener="" onClick={() => useShellStore.getState().openDrawer()}>
        open
      </button>
      <textarea aria-label="Message" />
      <Drawer actions={actions} />
    </>
  );
}

let client: QueryClient;
const tree = () => (
  <QueryClientProvider client={client}>
    <ToastProvider>
      <Harness />
    </ToastProvider>
  </QueryClientProvider>
);
const renderDrawer = () => render(tree());

// `hidden`: while the drawer is open the page behind it is hidden from a screen reader.
const opener = () => screen.getByRole("button", { name: "open", hidden: true });
const field = () => screen.getByRole("textbox", { name: "Message", hidden: true });
const dialog = () => screen.getByRole("dialog", { name: "Menu" });
const inDialog = () => within(dialog());

/** Let Radix's timers (its outside-pointer listener, its focus on close) and the queries settle. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

/** The creator taps the opener; the drawer opens and its first reads land. */
async function open() {
  opener().focus();
  fireEvent.click(opener());
  await settle();
  return dialog();
}

const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });
const realWidth = window.innerWidth;

/** next/link must not navigate here: the row's own click runs, the link's default is dropped. */
const keepLinksHere = (event: MouseEvent) => {
  if ((event.target as Element | null)?.closest?.("a")) event.preventDefault();
};

let stopFieldFocus: () => void = () => {};

beforeEach(() => {
  setWidth(390);
  nav.pathname = "/home";
  answers.threads = { body: { threads: [HEADSET, GHOSTS, IDEAS] } };
  answers.profile = { body: NIA };
  answers.subscription = { body: PRO };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  router.push.mockReset();
  router.back.mockReset();
  signOut.mockClear();
  clearActiveThreadCookie();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  useShellStore.setState({ drawerOpen: false, accountFace: null, threadOpen: false });
  useShellStore.getState().setThreadBack(null);
  useBoardStore.setState({ activeThreadId: null });
  window.addEventListener("click", keepLinksHere, true);
  // The composer's rule: a bump of the signal puts the cursor in the field.
  stopFieldFocus = useShellStore.subscribe((state, prev) => {
    if (state.fieldFocusSignal !== prev.fieldFocusSignal) document.querySelector<HTMLElement>("textarea")?.focus();
  });
});

afterEach(() => {
  cleanup();
  stopFieldFocus();
  window.removeEventListener("click", keepLinksHere, true);
  vi.unstubAllGlobals();
  setWidth(realWidth);
});

// ── Opening and what it holds ────────────────────────────────────────────────────────────────

describe("Drawer: opening and what it holds", () => {
  it("opens from the store: a dialog named Menu, the focus on its title", async () => {
    renderDrawer();
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => useShellStore.getState().openDrawer());
    expect(dialog()).toBeInTheDocument();
    expect(document.activeElement).toBe(inDialog().getByRole("heading", { name: "Menu" }));
  });

  it("holds the rows in the sidebar's order", async () => {
    renderDrawer();
    const panel = await open();
    const rows = within(panel);
    await rows.findByRole("list", { name: "Recent" });
    await rows.findByText("30 credits");
    const hairlines = panel.querySelectorAll('[data-part="hairline"]');
    expect(hairlines).toHaveLength(2);

    const order = [
      rows.getByText("Maven"),
      rows.getByRole("button", { name: "New chat" }),
      rows.getByRole("link", { name: "Home" }),
      rows.getByRole("link", { name: "Discover" }),
      rows.getByRole("link", { name: "Audience" }),
      rows.getByRole("link", { name: "Library" }),
      hairlines[0]!,
      rows.getByRole("link", { name: "You" }),
      rows.getByRole("link", { name: "Earn" }),
      rows.getByText("Recent"),
      rows.getByRole("link", { name: "All chats" }),
      rows.getByRole("button", { name: HEADSET.title! }),
      rows.getByRole("button", { name: IDEAS.title! }),
      hairlines[1]!,
      rows.getByText("Nia Long"),
      rows.getByRole("link", { name: "Settings" }),
      rows.getByRole("button", { name: "Log out" }),
      rows.getByRole("button", { name: "Close" }),
    ];
    order.slice(1).forEach((element, i) => {
      expect(order[i]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    // Maven is the brand, not a way anywhere.
    expect(rows.getByText("Maven").closest("a, button")).toBeNull();
    expect(rows.queryByRole("heading", { name: "Maven" })).toBeNull();
    // The dialog is the container: no second navigation landmark beside the sidebar's.
    expect(rows.queryByRole("navigation")).toBeNull();
  });

  it.each([
    ["/home", "Home"],
    ["/feed/video/v1", "Discover"],
    ["/library", "Library"],
    ["/audience/new", "Audience"],
    ["/you", "You"],
    ["/earn", "Earn"],
    ["/settings", null],
  ] as const)("lights the place the creator is on: %s", async (path, lit) => {
    nav.pathname = path;
    renderDrawer();
    const panel = await open();
    await within(panel).findByRole("list", { name: "Recent" });
    const current = panel.querySelectorAll('[aria-current="page"]');
    expect(Array.from(current, (element) => element.textContent)).toEqual(lit ? [lit] : []);
    expect(within(panel).getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("inside a chat whose row is listed, that row is lit and Home is not; a chat Recent does not list leaves Home lit", async () => {
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: GHOSTS.id });
    const view = renderDrawer();
    let panel = await open();
    await within(panel).findByRole("list", { name: "Recent" });
    expect(within(panel).getByRole("button", { name: GHOSTS.title! })).toHaveAttribute("aria-current", "page");
    expect(within(panel).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(panel.querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    view.unmount();
    useBoardStore.setState({ activeThreadId: "c-not-listed" });
    renderDrawer();
    panel = await open();
    await within(panel).findByRole("list", { name: "Recent" });
    expect(within(panel).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(panel.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("Recent: the newest always, then only named ones, six at most, in the list's order", async () => {
    answers.threads = {
      body: {
        threads: [
          chat("c1", null),
          HEADSET,
          chat("c3", null),
          GHOSTS,
          IDEAS,
          chat("c6", "   "),
          chat("c7", "Reacting to my first video"),
          chat("c8", "Ranking five ways to spend a bonus"),
          chat("c9", "Three openers for a cooking clip"),
        ],
      },
    };
    renderDrawer();
    const panel = await open();
    const list = await within(panel).findByRole("list", { name: "Recent" });
    expect(within(list).getAllByRole("button").map((row) => row.textContent)).toEqual([
      "New chat",
      HEADSET.title,
      GHOSTS.title,
      IDEAS.title,
      "Reacting to my first video",
      "Ranking five ways to spend a bonus",
    ]);
  });

  it.each([
    ["loads", () => ({ held: new Promise<never>(() => {}) })],
    ["is empty", () => ({ body: { threads: [] } })],
    ["failed", () => ({ status: 500, body: { error: "down" } })],
  ] as const)("no Recent label, rows or All chats while the list %s", async (state, answer) => {
    answers.threads = answer();
    renderDrawer();
    const panel = await open();
    await within(panel).findByText("Nia Long");
    if (state !== "loads") {
      await waitFor(() => expect(client.getQueryState(queryKeys.threads.list())?.status).toBe(state === "failed" ? "error" : "success"));
    } else {
      expect(client.getQueryState(queryKeys.threads.list())?.status).toBe("pending");
    }
    expect(within(panel).queryByText("Recent")).toBeNull();
    expect(within(panel).queryByRole("list")).toBeNull();
    expect(within(panel).queryByRole("link", { name: "All chats" })).toBeNull();
  });
});

// ── The account ──────────────────────────────────────────────────────────────────────────────

describe("Drawer: the account", () => {
  const account = () => dialog().querySelector<HTMLElement>('[data-part="account"]')!;

  it("the account: the initials, the name, the balance in the sidebar's words", async () => {
    renderDrawer();
    await open();
    await within(account()).findByText("30 credits");
    expect(within(account()).getByText("NL")).toBeInTheDocument();
    expect(within(account()).getByText("Nia Long")).toBeInTheDocument();
    // Not a control: the rows under it are.
    expect(account().closest("a, button")).toBeNull();
    expect(within(account()).queryByRole("button")).toBeNull();
  });

  it("no name: the email and its letter", async () => {
    answers.profile = { body: { ...NIA, name: "  " } };
    renderDrawer();
    await open();
    await within(account()).findByText("nia.tests@example.com");
    expect(within(account()).getByText("N")).toBeInTheDocument();
  });

  it("neither: Account and ?", async () => {
    answers.profile = { body: { ...NIA, name: "", email: "" } };
    renderDrawer();
    await open();
    await within(account()).findByText("Account");
    expect(within(account()).getByText("?")).toBeInTheDocument();
  });

  it("a free tier: no balance line", async () => {
    answers.subscription = { body: { ...PRO, tier: "free" } };
    renderDrawer();
    await open();
    await within(account()).findByText("Nia Long");
    await waitFor(() => expect(requests("/api/subscription")).toBe(1));
    await settle();
    expect(account()).not.toHaveTextContent(/credit/);
  });

  it("the balance is asked for when the drawer opens, not before", async () => {
    const view = renderDrawer();
    await settle();
    expect(requests("/api/subscription")).toBe(0);

    await open();
    await within(account()).findByText("30 credits");
    expect(requests("/api/subscription")).toBe(1);

    view.rerender(tree());
    await settle();
    expect(requests("/api/subscription")).toBe(1);
  });

  it("while the balance is on its way the block holds the picture and the name alone: no placeholder", async () => {
    const subscription = deferred();
    answers.subscription = { held: subscription.held };
    renderDrawer();
    await open();
    await within(account()).findByText("Nia Long");
    expect(account().textContent).toBe("NLNia Long");

    await act(async () => subscription.resolve({ body: PRO }));
    await within(account()).findByText("30 credits");
  });

  it("from the second opening the balance shown last is there at once, while the new read is out", async () => {
    renderDrawer();
    await open();
    await within(account()).findByText("30 credits");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();

    const next = deferred();
    answers.subscription = { held: next.held };
    await act(async () => useShellStore.getState().openDrawer());
    // Asked for again, and drawn before it answers: the name does not move.
    expect(requests("/api/subscription")).toBe(2);
    expect(within(account()).getByText("30 credits")).toBeInTheDocument();

    // The fresh value once it is in.
    await act(async () => next.resolve({ body: { ...PRO, usage: { ...PRO.usage, remaining: 12 } } }));
    await within(account()).findByText("12 credits");
    expect(within(account()).queryByText("30 credits")).toBeNull();
  });

  it("a failed profile read: Account and ?", async () => {
    answers.profile = { status: 500, body: { error: "down" } };
    renderDrawer();
    await open();
    // Empty while the read is out, then the fallback once it has failed.
    await within(account()).findByText("?");
    expect(within(account()).getByText("Account")).toBeInTheDocument();
    expect(useShellStore.getState().accountFace).toEqual({ picture: null, initials: "?" });
  });

  it("publishes the face for the openers: empty while the first read is out, then NL", async () => {
    const profile = deferred();
    answers.profile = { held: profile.held };
    renderDrawer();
    await settle();
    expect(useShellStore.getState().accountFace).toEqual({ picture: null, initials: "" });

    await act(async () => profile.resolve({ body: { ...NIA, avatar: "/avatars/nia.png" } }));
    await waitFor(() => expect(useShellStore.getState().accountFace).toEqual({ picture: "/avatars/nia.png", initials: "NL" }));
    // Published from the frame: the drawer itself was never opened.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── Each row ─────────────────────────────────────────────────────────────────────────────────

describe("Drawer: what each row does", () => {
  it.each([
    ["Home", "/home"],
    ["Discover", "/feed"],
    ["Library", "/library"],
    ["You", "/you"],
    ["Earn", "/earn"],
    ["Settings", "/settings"],
    ["All chats", "/library"],
  ] as const)(
    "a row that leads elsewhere closes it and leaves the focus where the new screen puts it: %s",
    async (name, href) => {
      nav.pathname = "/audience";
      renderDrawer();
      const panel = await open();
      const link = await within(panel).findByRole("link", { name });
      expect(link).toHaveAttribute("href", href);

      fireEvent.click(link);
      expect(useShellStore.getState().drawerOpen).toBe(false);
      await settle();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).not.toBe(opener());
    },
  );

  it("a row that leads where the creator is closes it and the focus goes back to the opener", async () => {
    nav.pathname = "/audience";
    renderDrawer();
    const panel = await open();
    fireEvent.click(within(panel).getByRole("link", { name: "Audience" }));
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("New chat inside a chat starts the new chat in the tap and closes the drawer; the focus is not sent to the opener", async () => {
    setActiveThreadCookie(HEADSET.id);
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: HEADSET.id });
    renderDrawer();
    const panel = await open();
    const signal = useShellStore.getState().fieldFocusSignal;

    fireEvent.click(within(panel).getByRole("button", { name: "New chat" }));
    // In the tap, not after the slide.
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(useShellStore.getState().drawerOpen).toBe(false);

    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(opener());
    expect(document.activeElement).not.toBe(field());
    expect(useShellStore.getState().fieldFocusSignal).toBe(signal);
  });

  it("New chat on another place goes Home in the tap; the focus is not sent to the opener", async () => {
    nav.pathname = "/library";
    renderDrawer();
    const panel = await open();
    const signal = useShellStore.getState().fieldFocusSignal;

    fireEvent.click(within(panel).getByRole("button", { name: "New chat" }));
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(document.activeElement).not.toBe(opener());
    expect(useShellStore.getState().fieldFocusSignal).toBe(signal);
  });

  it("New chat on a blank Home: the cursor is in the field when the tap returns", async () => {
    renderDrawer();
    const panel = await open();
    const signal = useShellStore.getState().fieldFocusSignal;

    fireEvent.click(within(panel).getByRole("button", { name: "New chat" }));
    // In the tap: the drawer closed first, so its focus trap was off when the field took the cursor
    // (a phone raises its keyboard only for a focus inside the tap). Nothing is pushed.
    expect(document.activeElement).toBe(field());
    expect(useShellStore.getState().fieldFocusSignal).toBe(signal + 1);
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(router.push).not.toHaveBeenCalled();

    // Once the panel has gone the cursor is still there, and nothing sent it twice.
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(field());
    expect(useShellStore.getState().fieldFocusSignal).toBe(signal + 1);
  });

  it("Home inside a chat leaves the chat for the blank Home", async () => {
    setActiveThreadCookie(HEADSET.id);
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: HEADSET.id });
    renderDrawer();
    const panel = await open();
    const signal = useShellStore.getState().fieldFocusSignal;
    const home = within(panel).getByRole("link", { name: "Home" });
    // Still the link to Home.
    expect(home).toHaveAttribute("href", "/home");

    fireEvent.click(home);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useShellStore.getState().drawerOpen).toBe(false);

    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(opener());
    // No cursor sent to the field, as the band's New chat does from a chat.
    expect(useShellStore.getState().fieldFocusSignal).toBe(signal);
  });

  it("a recent chat opens on Home with no way back to Library", async () => {
    nav.pathname = "/library";
    useShellStore.getState().setThreadBack("/library");
    renderDrawer();
    const panel = await open();
    fireEvent.click(await within(panel).findByRole("button", { name: IDEAS.title! }));

    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useBoardStore.getState().activeThreadId).toBe(IDEAS.id);
    expect(getActiveThreadCookie()).toBe(IDEAS.id);
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(document.activeElement).not.toBe(opener());
  });

  it("the open chat's own row only closes: nothing is opened again, the focus goes back to the opener", async () => {
    setActiveThreadCookie(HEADSET.id);
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: HEADSET.id });
    renderDrawer();
    const panel = await open();
    const signal = useBoardStore.getState().activeThreadSignal;

    fireEvent.click(await within(panel).findByRole("button", { name: HEADSET.title! }));
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(useBoardStore.getState().activeThreadSignal).toBe(signal);
    expect(router.push).not.toHaveBeenCalled();
    await settle();
    expect(document.activeElement).toBe(opener());
  });

  it("Log out signs out once and closes; nothing is pushed", async () => {
    renderDrawer();
    const panel = await open();
    fireEvent.click(within(panel).getByRole("button", { name: "Log out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── Closing ──────────────────────────────────────────────────────────────────────────────────

describe("Drawer: closing", () => {
  it("Escape closes it; the focus goes back to the opener", async () => {
    renderDrawer();
    await open();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("a tap on the scrim closes it; the focus goes back to the opener", async () => {
    renderDrawer();
    await open();
    const scrim = document.querySelector<HTMLElement>('[data-part="scrim"]')!;
    expect(scrim).not.toBeNull();
    fireEvent.pointerDown(scrim);
    await settle();
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("Close is out of sight until focused, and closes it", async () => {
    renderDrawer();
    const panel = await open();
    const close = within(panel).getByRole("button", { name: "Close" });
    expect(close.className.split(/\s+/)).toEqual(expect.arrayContaining(["sr-only", "focus-visible:not-sr-only"]));
    fireEvent.click(close);
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("another route closes it, and the focus is not moved to an opener", async () => {
    nav.pathname = "/library";
    const view = renderDrawer();
    await open();
    nav.pathname = "/feed";
    view.rerender(tree());
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(opener());
  });

  it("the window reaching 768 closes it", async () => {
    renderDrawer();
    await open();
    await act(async () => {
      setWidth(1024);
      window.dispatchEvent(new Event("resize"));
    });
    expect(useShellStore.getState().drawerOpen).toBe(false);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["/audience", "link", "Library"],
    ["/home", "button", "New chat"],
  ] as const)(
    "after a row led elsewhere (%s, %s), the next opening closed with Escape gives the focus back to the opener",
    async (path, role, name) => {
      nav.pathname = path;
      renderDrawer();
      let panel = await open();
      fireEvent.click(within(panel).getByRole(role, { name }));
      await settle();
      expect(screen.queryByRole("dialog")).toBeNull();

      panel = await open();
      expect(panel).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await settle();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener());
    },
  );

  it("the shell leaving with it open leaves nothing behind: closed, no face; mounted again, no dialog", async () => {
    const view = renderDrawer();
    await open();
    await waitFor(() => expect(useShellStore.getState().accountFace).toEqual({ picture: null, initials: "NL" }));

    view.unmount();
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(useShellStore.getState().accountFace).toBeNull();

    renderDrawer();
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("it does not open on a wide window", async () => {
    setWidth(1024);
    renderDrawer();
    await settle();
    await act(async () => useShellStore.getState().openDrawer());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useShellStore.getState().drawerOpen).toBe(false);
  });
});

// ── While it is open ─────────────────────────────────────────────────────────────────────────

describe("Drawer: while it is open", () => {
  it("while it is open the page behind is hidden from a screen reader and does not scroll", async () => {
    renderDrawer();
    expect(opener().closest('[aria-hidden="true"]')).toBeNull();
    await open();
    expect(opener().closest('[aria-hidden="true"]')).not.toBeNull();
    expect(document.body).toHaveAttribute("data-scroll-locked");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    expect(opener().closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("slides only when motion is allowed", async () => {
    renderDrawer();
    const panel = await open();
    const scrim = document.querySelector<HTMLElement>('[data-part="scrim"]')!;
    const moving = (element: HTMLElement) =>
      element.className.split(/\s+/).filter((name) => /animate-|slide-|fade-|duration-/.test(name));
    expect(moving(panel)).toEqual(
      expect.arrayContaining([
        "motion-safe:data-[state=open]:slide-in-from-left",
        "motion-safe:data-[state=closed]:slide-out-to-left",
      ]),
    );
    for (const name of [...moving(panel), ...moving(scrim)]) expect(name.startsWith("motion-safe:")).toBe(true);
  });

  it("axe finds nothing with it open", async () => {
    renderDrawer();
    const panel = await open();
    await within(panel).findByRole("list", { name: "Recent" });
    await within(panel).findByText("30 credits");
    // The drawer on its own, every rule.
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(panel)).toHaveNoViolations();
    // And the whole page under it, but for one rule. A modal Radix layer hides the page behind it from
    // a screen reader (`aria-hidden`) and keeps two tabbable focus guards beside it, while its focus
    // trap keeps the focus inside: `aria-hidden-focus` cannot see the trap.
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body, { rules: { "aria-hidden-focus": { enabled: false } } })).toHaveNoViolations();
  });
});
