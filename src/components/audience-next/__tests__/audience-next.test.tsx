/** @vitest-environment happy-dom */
/**
 * AudienceNext — the page's container (spec 2026-11-25-audience, 3.2 to 3.3 and 3.8), rendered for real: the screen
 * and its parts, a group's sheet, More, the real hooks through TanStack Query, the real toasts, the real
 * shell store; the pages are the dev preview's (made-up audiences through the real model). Stand-ins only
 * at the edges: `fetch` (a request can be held and answered later), the router (`push`, `refresh`), the
 * build-time flag (on), `matchMedia` (a phone), and where More's confirming button is pressed the page's
 * clock (`performance.now`: it waits 500 ms).
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/audience" }));

import { DEV_NOW, DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import { settleClock } from "@/components/thread-next/answer-sheet";
import { ToastProvider } from "@/components/ui/toast";
import { audiencePageOf, type AudiencePage } from "@/lib/audience-next/audience-model";
import {
  AUDIENCE_STRINGS as S,
  deleteQuestion,
  disconnectFailed,
  disconnectItem,
  disconnectQuestion,
  fromVideos,
  moreLabel,
  newChatsUse,
  readAgainLine,
  stillReading,
  thinWhy,
} from "@/lib/audience-next/audience-words";
import { readAgainRequestOf } from "@/lib/audience-next/build-request";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

import { AudienceNext, SIMULATE_HREF, type AudienceNextRead } from "../audience-next";

// ─── The edges ───────────────────────────────────────────────────────────────

interface Call {
  method: string;
  url: string;
  body: unknown;
}
let calls: Call[];
/** Refused requests, by "METHOD url", with their status. */
let refuse: Map<string, number>;
/** Held requests, by "METHOD url": answered by `release`. */
let holding: Set<string>;
let waiting: Map<string, Array<() => void>>;

function answer(call: Call): Response {
  const status = refuse.get(`${call.method} ${call.url}`);
  if (status) return new Response(JSON.stringify({ error: "refused" }), { status });
  if (call.method === "DELETE") return new Response(null, { status: 204 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

const release = async (key: string) => {
  const next = waiting.get(key)?.shift();
  if (!next) throw new Error(`nothing held for ${key}`);
  await act(async () => next());
};

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

beforeEach(() => {
  calls = [];
  refuse = new Map();
  holding = new Set();
  waiting = new Map();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      };
      calls.push(call);
      const key = `${call.method} ${call.url}`;
      if (!holding.has(key)) return answer(call);
      return new Promise<Response>((resolve) => {
        const queue = waiting.get(key) ?? [];
        queue.push(() => resolve(answer(call)));
        waiting.set(key, queue);
      });
    }),
  );
  widthIs("phone");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  router.push.mockReset();
  router.refresh.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

// ─── The pages ───────────────────────────────────────────────────────────────

const OWN = DEV_PAGES.own.page;
const NOT_DEFAULT = DEV_PAGES["not-default"].page;
const DESCRIBED = DEV_PAGES.described.page;
const PUT_DEFAULT = "PUT /api/settings/last-audience";

const readOf = (page: AudiencePage, pushed = false): AudienceNextRead => ({ kind: "audience", pushed, page, choices: [] });

/** The described page as the server reads it once renamed (the real model, the stored name changed). */
function describedNamed(name: string): AudiencePage {
  const input = DEV_PAGES.described.input;
  return audiencePageOf({ ...input, audience: { ...input.audience, name } }, DEV_NOW);
}

function show(read: AudienceNextRead) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrap = (r: AudienceNextRead) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AudienceNext read={r} />
      </ToastProvider>
    </QueryClientProvider>
  );
  const view = render(wrap(read));
  /** A fresh read from the server, as `router.refresh()` brings it. */
  const refreshWith = (next: AudienceNextRead) => view.rerender(wrap(next));
  return { ...view, refreshWith };
}

// ─── Small readers ───────────────────────────────────────────────────────────

const block = (name: string) => document.querySelector<HTMLElement>(`[data-block="${name}"]`);
const groupRows = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[data-group-row]"));
const dimmed = () => Array.from(document.querySelectorAll("[data-ring] [data-dimmed]")).map((w) => w.getAttribute("data-wedge"));
const centre = () => Array.from(document.querySelectorAll("[data-ring-centre] text")).map((t) => t.textContent);
const simulate = () => screen.getByRole("button", { name: S.simulate });
const quiet = () => screen.queryByRole("button", { name: S.useForNewChats });
const more = (name: string) => screen.getByRole("button", { name: moreLabel(name) });
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));
/** A press as a pointer gives it: the control takes the focus first. */
const press = (el: HTMLElement) => {
  el.focus();
  fireEvent.click(el);
};
const openMore = (name: string) => press(more(name));
const menuItem = (name: string) => within(screen.getByRole("dialog")).getByRole("button", { name });
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

// ─── The drawer's opener ─────────────────────────────────────────────────────

describe("AudienceNext — the drawer's opener on the phone", () => {
  // The face the drawer's frame publishes (the shell mounts it; here it is set as it would be).
  beforeEach(() => useShellStore.setState({ drawerOpen: false, accountFace: { picture: null, initials: "NL" } }));
  afterEach(() => useShellStore.setState({ drawerOpen: false, accountFace: null }));

  it("/audience carries the opener; a pushed audience does not", async () => {
    show(readOf(OWN));
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    const slot = opener.closest<HTMLElement>('[data-part="opener"]')!;
    expect(slot.parentElement!.tagName).toBe("HEADER");
    expect(slot.parentElement!.firstElementChild).toBe(slot);
    expect(slot.nextElementSibling).toBe(screen.getByRole("heading", { level: 1, name: S.title }));
    fireEvent.click(opener);
    expect(useShellStore.getState().drawerOpen).toBe(true);
    await settle();
    // The opener reads the shell's store only: nothing sent, nowhere pushed.
    expect(calls).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
    cleanup();

    show(readOf(NOT_DEFAULT, true));
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(document.querySelector('[data-part="opener"]')).toBeNull();
  });
});

// ─── A group ─────────────────────────────────────────────────────────────────

describe("AudienceNext — a group's sheet", () => {
  it("a row opens the group's sheet and dims the other nine wedges; closing lights the ring again and gives the focus back to the row", async () => {
    show(readOf(OWN));
    const third = OWN.groups[2]!;
    const row = groupRows()[2]!;
    press(row);
    const sheet = await screen.findByRole("dialog", { name: third.name });
    expect(dimmed()).toHaveLength(9);
    expect(dimmed()).not.toContain(third.group);
    expect(centre()).toEqual([String(third.count), third.name]);
    expect(within(sheet).getByText(`“${third.line}”`)).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(dimmed()).toEqual([]);
    expect(centre()).toEqual([S.ringTotal, S.ringUnit]);
    await waitFor(() => expect(row).toHaveFocus());
  });

  it("a wedge opens it too; the focus then goes back to that group's row", async () => {
    show(readOf(OWN));
    const second = OWN.groups[1]!;
    fireEvent.click(document.querySelector(`[data-wedge-area="${second.group}"]`)!);
    await screen.findByRole("dialog", { name: second.name });
    expect(dimmed()).toHaveLength(9);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(groupRows()[1]).toHaveFocus());
  });

  it("a wedge whose row is not on screen (after the first four) opens the sheet; closing puts the focus on All 10, the way to that row (not on the page's top)", async () => {
    show(readOf(OWN));
    const ninth = OWN.groups[8]!;
    expect(groupRows()).toHaveLength(4);
    fireEvent.click(document.querySelector(`[data-wedge-area="${ninth.group}"]`)!);
    await screen.findByRole("dialog", { name: ninth.name });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: `All ${OWN.groups.length}` }));
  });

  it("the sheet keeps its group while it leaves (its content does not empty in the exit)", async () => {
    const style = document.createElement("style");
    style.textContent = '[data-sheet][data-state="open"] { animation-name: enter; } [data-sheet][data-state="closed"] { animation-name: exit; }';
    document.head.append(style);
    onTestFinished(() => style.remove());
    show(readOf(OWN));
    const first = OWN.groups[0]!;
    press(groupRows()[0]!);
    await screen.findByRole("dialog", { name: first.name });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    const closing = document.querySelector<HTMLElement>('[data-sheet="sheet"]');
    expect(closing).toHaveAttribute("data-state", "closed");
    expect(closing!.textContent).toContain(first.name);
    // The ring is lit again at once.
    expect(dimmed()).toEqual([]);
  });

  it("has no axe violations with the sheet open", async () => {
    show(readOf(OWN));
    press(groupRows()[0]!);
    const sheet = await screen.findByRole("dialog");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(sheet)).toHaveNoViolations();
  });
});

// ─── The main button and "Use for new chats" ─────────────────────────────────

describe("AudienceNext — Simulate a video for them", () => {
  it("with a chat open, the main button starts a new chat at the simulate address: the pointer is the new-chat sentinel, no chat is active", async () => {
    setActiveThreadCookie("t-open");
    useBoardStore.setState({ activeThreadId: "t-open" });
    onTestFinished(() => {
      clearActiveThreadCookie();
      useBoardStore.setState({ activeThreadId: null });
    });
    show(readOf(OWN));
    press(simulate());
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith(SIMULATE_HREF);
    cleanup();

    // Not the default yet: the same, once its write is answered.
    setActiveThreadCookie("t-open");
    useBoardStore.setState({ activeThreadId: "t-open" });
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith(SIMULATE_HREF));
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
  });

  it("SIMULATE_HREF is Home with Simulate picked: no seed, no run, no audience", () => {
    expect(SIMULATE_HREF).toBe("/home?v=Test");
    const params = new URL(SIMULATE_HREF, "https://maven.test").searchParams;
    expect([...params.keys()]).toEqual(["v"]);
  });

  it("the audience new chats use: straight to Home, nothing sent", () => {
    show(readOf(OWN));
    press(simulate());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/home?v=Test");
    expect(calls).toEqual([]);
  });

  it("another audience: it is made the one new chats use first; Home only once the server said yes", async () => {
    holding.add(PUT_DEFAULT);
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    await waitFor(() => expect(calls).toEqual([{ method: "PUT", url: "/api/settings/last-audience", body: { audienceId: NOT_DEFAULT.id } }]));
    expect(router.push).not.toHaveBeenCalled();
    expect(simulate()).toHaveAttribute("aria-busy", "true");
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home?v=Test"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("a second press while it waits sends nothing more, nor a press on Use for new chats", async () => {
    holding.add(PUT_DEFAULT);
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    press(simulate());
    fireEvent.click(simulate());
    press(quiet()!);
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(calls).toHaveLength(1);
  });

  it("two presses before the page draws again (a double tap) send one request", async () => {
    holding.add(PUT_DEFAULT);
    show(readOf(NOT_DEFAULT, true));
    const button = simulate();
    act(() => {
      button.click();
      button.click();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it("refused: Couldn't switch the audience., and the page stays (nothing pushed, the button free again)", async () => {
    refuse.set(PUT_DEFAULT, 500);
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(simulate()).not.toHaveAttribute("aria-busy");
  });
});

describe("AudienceNext — Use for new chats", () => {
  it("PUTs the audience, says New chats use @handle, reads the page again; the quiet button leaves at once and the focus goes to the main button", async () => {
    show(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    expect(calls).toEqual([{ method: "PUT", url: "/api/settings/last-audience", body: { audienceId: NOT_DEFAULT.id } }]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(quiet()).toBeNull();
    expect(simulate()).toHaveFocus();
    // Now the default, the main button goes straight to Home.
    press(simulate());
    expect(router.push).toHaveBeenCalledWith("/home?v=Test");
    expect(calls).toHaveLength(1);
  });

  it("the page shown as the default lasts until a new read: one that still says otherwise brings the quiet button back", async () => {
    const { refreshWith } = show(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    expect(quiet()).toBeNull();
    // The default was changed elsewhere meanwhile: the read again says this one is not it.
    refreshWith(readOf(NOT_DEFAULT, true));
    expect(quiet()).toBeInTheDocument();
  });

  it("busy while it waits: a second press sends nothing", async () => {
    holding.add(PUT_DEFAULT);
    show(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    expect(quiet()).toHaveAttribute("aria-busy", "true");
    press(quiet()!);
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("two presses before the page draws again (a double tap) send one request", async () => {
    holding.add(PUT_DEFAULT);
    show(readOf(NOT_DEFAULT, true));
    const button = quiet()!;
    act(() => {
      button.click();
      button.click();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("refused: Couldn't switch the audience.; nothing read again; the quiet button stays", async () => {
    refuse.set(PUT_DEFAULT, 500);
    show(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(quiet()).not.toHaveAttribute("aria-busy");
  });
});

// ─── More ────────────────────────────────────────────────────────────────────

describe("AudienceNext — More", () => {
  it("an audience has More in the header; none yet and a failed read have none", () => {
    show(readOf(OWN));
    expect(within(document.querySelector("header")!).getByRole("button", { name: moreLabel(OWN.name) })).toBeInTheDocument();
    cleanup();
    show({ kind: "none", pushed: false });
    expect(screen.queryByRole("button", { name: new RegExp(`^${S.more}:`) })).toBeNull();
    cleanup();
    show({ kind: "failed", pushed: false });
    expect(screen.queryByRole("button", { name: new RegExp(`^${S.more}:`) })).toBeNull();
  });

  it("has Read again for an account's audience (own or another creator's), none for a described one", () => {
    for (const page of [OWN, DEV_PAGES.other.page]) {
      show(readOf(page));
      openMore(page.name);
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: S.readAgain })).toBeInTheDocument();
      cleanup();
    }
    show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: S.readAgain })).toBeNull();
  });

  it("rename: the new name shows at once, the PATCH goes out, the page is read again, and the name stays once the page carries it", async () => {
    holding.add(`PATCH /api/audiences/${DESCRIBED.id}`);
    const { refreshWith } = show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    await settle();
    const title = () => within(block("source")!).getByRole("heading", { level: 2 });
    expect(title()).toHaveTextContent("Night owls");
    expect(more("Night owls")).toBeInTheDocument();
    expect(calls).toEqual([{ method: "PATCH", url: `/api/audiences/${DESCRIBED.id}`, body: { name: "Night owls" } }]);
    expect(router.refresh).not.toHaveBeenCalled();

    await release(`PATCH /api/audiences/${DESCRIBED.id}`);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(title()).toHaveTextContent("Night owls");
    // The refresh brings the page with the stored name: it stays.
    refreshWith(readOf(describedNamed("Night owls")));
    expect(title()).toHaveTextContent("Night owls");
    // And a later read with another name is shown as it is: the page's name is the server's again.
    refreshWith(readOf(describedNamed("Early birds")));
    expect(title()).toHaveTextContent("Early birds");
  });

  it("a pushed page's title follows the rename", async () => {
    show(readOf(NOT_DEFAULT, true));
    expect(useShellStore.getState().pushedTitle).toBe(NOT_DEFAULT.name);
    openMore(NOT_DEFAULT.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "My kitchen crowd" } });
    fireEvent.click(menuItem(S.save));
    await settle();
    expect(useShellStore.getState().pushedTitle).toBe("My kitchen crowd");
  });

  it("a refused rename puts the old name back and says Couldn't rename that audience.", async () => {
    refuse.set(`PATCH /api/audiences/${DESCRIBED.id}`, 500);
    show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    expect(await screen.findByText(S.renameFailed)).toBeInTheDocument();
    expect(within(block("source")!).getByRole("heading", { level: 2 })).toHaveTextContent(DESCRIBED.name);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("delete: DELETE the audience, then to /audience, read again", async () => {
    clock();
    show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.deleteAudience));
    expect(within(screen.getByRole("dialog")).getByText(deleteQuestion(DESCRIBED.name))).toBeInTheDocument();
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.delete));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ method: "DELETE", url: `/api/audiences/${DESCRIBED.id}`, body: null }]);
  });

  it("disconnect: the audience, then the account behind it; then to /audience, read again", async () => {
    clock();
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    expect(within(screen.getByRole("dialog")).getByText(disconnectQuestion("nia.tests"))).toBeInTheDocument();
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    const removal = OWN.removal as Extract<AudiencePage["removal"], { kind: "disconnect" }>;
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${OWN.id}`, `DELETE /api/connected-accounts/${removal.accountId}`]);
  });

  it("a refused delete says Couldn't delete that audience., stays, and reads the page again", async () => {
    clock();
    refuse.set(`DELETE /api/audiences/${DESCRIBED.id}`, 500);
    show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.deleteAudience));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.delete));
    expect(await screen.findByText(S.deleteFailed)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a refused disconnect says Couldn't disconnect @handle., stays, and reads the page again", async () => {
    clock();
    const removal = OWN.removal as Extract<AudiencePage["removal"], { kind: "disconnect" }>;
    refuse.set(`DELETE /api/connected-accounts/${removal.accountId}`, 500);
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    expect(await screen.findByText(disconnectFailed("nia.tests"))).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    // The order stays the old screen's: the audience is deleted first, so a refused account leaves the
    // audience gone and the account connected (its disconnect is on You).
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${OWN.id}`, `DELETE /api/connected-accounts/${removal.accountId}`]);
  });

  it("after a remove, another audience shown on the same screen can be removed too", async () => {
    clock();
    const { refreshWith } = show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.deleteAudience));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.delete));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    await settle();
    // `/audience` again, now showing the next audience on the same mounted screen.
    refreshWith(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
    const removal = OWN.removal as Extract<AudiencePage["removal"], { kind: "disconnect" }>;
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `DELETE /api/audiences/${DESCRIBED.id}`,
      `DELETE /api/audiences/${OWN.id}`,
      `DELETE /api/connected-accounts/${removal.accountId}`,
    ]);
  });

  it("while a remove is out, the two main buttons send nothing and open nothing", async () => {
    clock();
    holding.add(`DELETE /api/audiences/${NOT_DEFAULT.id}`);
    show(readOf(NOT_DEFAULT, true));
    openMore(NOT_DEFAULT.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    press(simulate());
    press(quiet()!);
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${NOT_DEFAULT.id}`]);
    expect(router.push).not.toHaveBeenCalled();
    await release(`DELETE /api/audiences/${NOT_DEFAULT.id}`);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations with More open", async () => {
    show(readOf(OWN));
    openMore(OWN.name);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

// ─── An expired session ──────────────────────────────────────────────────────

describe("AudienceNext — an expired session (a 401): the session dialog is the whole answer", () => {
  let raised: number;
  const count = () => {
    raised += 1;
  };
  beforeEach(() => {
    raised = 0;
    window.addEventListener(SESSION_EXPIRED_EVENT, count);
  });
  afterEach(() => window.removeEventListener(SESSION_EXPIRED_EVENT, count));

  const noToast = () => {
    for (const words of [S.renameFailed, S.switchFailed, S.deleteFailed, disconnectFailed("nia.tests")]) {
      expect(screen.queryByText(words)).toBeNull();
    }
  };

  it("rename: the old name comes back, and no refusal toast", async () => {
    refuse.set(`PATCH /api/audiences/${DESCRIBED.id}`, 401);
    show(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    await waitFor(() => expect(raised).toBe(1));
    await waitFor(() => expect(within(block("source")!).getByRole("heading", { level: 2 })).toHaveTextContent(DESCRIBED.name));
    await settle();
    noToast();
  });

  it("Use for new chats: no refusal toast; the quiet button stays", async () => {
    refuse.set(PUT_DEFAULT, 401);
    show(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    await waitFor(() => expect(raised).toBe(1));
    await settle();
    noToast();
    expect(quiet()).not.toHaveAttribute("aria-busy");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("the main button: no refusal toast, Home does not open", async () => {
    refuse.set(PUT_DEFAULT, 401);
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    await waitFor(() => expect(raised).toBe(1));
    await settle();
    noToast();
    expect(router.push).not.toHaveBeenCalled();
    expect(simulate()).not.toHaveAttribute("aria-busy");
  });

  it("remove: no refusal toast; the page is read again", async () => {
    clock();
    refuse.set(`DELETE /api/audiences/${OWN.id}`, 401);
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    await waitFor(() => expect(raised).toBe(1));
    await settle();
    noToast();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});

// ─── The other states ────────────────────────────────────────────────────────

describe("AudienceNext — none yet and a failed read", () => {
  it("failed: Try again reads the page again", () => {
    show({ kind: "failed", pushed: false });
    expect(screen.getByRole("alert")).toHaveTextContent(S.loadFailed);
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it("none yet: the invitation, with nothing sent", () => {
    show({ kind: "none", pushed: false });
    expect(screen.getByRole("heading", { name: S.noneTitle })).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("pushed: the shell's title names the audience", () => {
    show(readOf(NOT_DEFAULT, true));
    expect(useShellStore.getState().pushedTitle).toBe(NOT_DEFAULT.name);
  });
});

// ─── The switcher ────────────────────────────────────────────────────────────

describe("AudienceNext — the switcher", () => {
  /** A page as the server reads it, with the switcher's rows the model made for it. */
  const readWith = (name: keyof typeof DEV_PAGES, pushed = DEV_PAGES[name].pushed): Extract<AudienceNextRead, { kind: "audience" }> => ({
    kind: "audience",
    pushed,
    page: DEV_PAGES[name].page,
    choices: DEV_PAGES[name].choices,
  });
  const choiceOf = (name: keyof typeof DEV_PAGES, id: string) => DEV_PAGES[name].choices.find((c) => c.id === id)!;
  const LEO = DEV_PAGES.other.page;
  /** The pill, named for the audience on the page (found also while a layer hides the page). */
  const pill = (name: string) => screen.getByRole("button", { name: `${S.switcherTitle}: ${name}`, hidden: true });
  const switcher = () => screen.getByRole("dialog", { name: S.switcherTitle });
  const openSwitcher = (name: string) => press(pill(name));
  const pick = (name: string) => fireEvent.click(within(switcher()).getByRole("button", { name }));

  it("an audience has the pill in the header beside More; none yet and a failed read have none", () => {
    show(readWith("own"));
    const header = document.querySelector("header")!;
    const buttons = within(header).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Open menu", `${S.switcherTitle}: ${OWN.name}`, `${S.more}: ${OWN.name}`]);
    cleanup();
    show({ kind: "none", pushed: false });
    expect(screen.queryByRole("button", { name: new RegExp(`^${S.switcherTitle}:`) })).toBeNull();
    cleanup();
    show({ kind: "failed", pushed: false });
    expect(screen.queryByRole("button", { name: new RegExp(`^${S.switcherTitle}:`) })).toBeNull();
  });

  it("lists the model's rows, the one new chats use checked", () => {
    show(readWith("own"));
    openSwitcher(OWN.name);
    for (const choice of DEV_PAGES.own.choices) {
      expect(within(switcher()).getByRole("button", { name: choice.name })).toHaveAttribute("aria-pressed", String(choice.selected));
    }
  });

  it("another audience: the layer closes first, then the PUT; then to /audience, read again, and New chats use @leo.makes", async () => {
    holding.add(PUT_DEFAULT);
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(calls).toEqual([{ method: "PUT", url: "/api/settings/last-audience", body: { audienceId: LEO.id } }]));
    await settle();
    expect(pill(OWN.name)).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();

    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
    expect(await screen.findByText(newChatsUse("@leo.makes"))).toBeInTheDocument();
  });

  it("from a pushed page, another audience: the same PUT, then to /audience", async () => {
    show(readWith("not-default"));
    openSwitcher(NOT_DEFAULT.name);
    // On this page @leo.makes is the one new chats use; the page's own audience is not.
    pick(choiceOf("not-default", NOT_DEFAULT.id).name);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(calls).toEqual([{ method: "PUT", url: "/api/settings/last-audience", body: { audienceId: NOT_DEFAULT.id } }]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
  });

  it("the checked one on /audience: nothing sent, nothing pushed; the layer closes", async () => {
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", OWN.id).name);
    expect(screen.queryByRole("dialog")).toBeNull();
    await settle();
    expect(calls).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("the checked one on a pushed page: to /audience, without a PUT", async () => {
    show(readWith("not-default"));
    openSwitcher(NOT_DEFAULT.name);
    pick(choiceOf("not-default", LEO.id).name);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/audience");
    await settle();
    expect(calls).toEqual([]);
  });

  it("refused: Couldn't switch the audience.; nothing pushed, nothing read again", async () => {
    refuse.set(PUT_DEFAULT, 500);
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("New audience: the layer closes and /audience/new opens; nothing sent", async () => {
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(S.newAudience);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/audience/new");
    await settle();
    expect(calls).toEqual([]);
  });

  it("while a switch is out, another pick sends nothing, nor does Simulate", async () => {
    holding.add(PUT_DEFAULT);
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await waitFor(() => expect(calls).toHaveLength(1));
    openSwitcher(OWN.name);
    pick(choiceOf("own", DESCRIBED.id).name);
    press(simulate());
    await settle();
    expect(calls).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("while Use for new chats is out, a pick sends nothing", async () => {
    holding.add(PUT_DEFAULT);
    show(readWith("not-default"));
    press(quiet()!);
    await waitFor(() => expect(calls).toHaveLength(1));
    openSwitcher(NOT_DEFAULT.name);
    pick(choiceOf("not-default", DESCRIBED.id).name);
    await settle();
    expect(calls).toHaveLength(1);
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("after Use for new chats the check moves to this audience at once; picking it then goes to /audience without a PUT", async () => {
    show(readWith("not-default"));
    press(quiet()!);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    openSwitcher(NOT_DEFAULT.name);
    expect(within(switcher()).getByRole("button", { name: choiceOf("not-default", NOT_DEFAULT.id).name })).toHaveAttribute("aria-pressed", "true");
    expect(within(switcher()).getByRole("button", { name: choiceOf("not-default", LEO.id).name })).toHaveAttribute("aria-pressed", "false");
    pick(choiceOf("not-default", NOT_DEFAULT.id).name);
    expect(router.push).toHaveBeenCalledWith("/audience");
    expect(calls).toHaveLength(1);
  });

  it("a rename shows in the pill and in the audience's row at once", async () => {
    show(readWith("described"));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    await settle();
    expect(pill("Night owls")).toBeInTheDocument();
    openSwitcher("Night owls");
    const row = within(switcher()).getByRole("button", { name: "Night owls" });
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(within(switcher()).queryByRole("button", { name: DESCRIBED.name })).toBeNull();
  });

  it("a renamed row's initial follows the new name, as the page's face does", async () => {
    show(readWith("described"));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    await settle();
    expect(block("source")!.querySelector("[data-face]")).toHaveTextContent("N");
    openSwitcher("Night owls");
    expect(within(switcher()).getByRole("button", { name: "Night owls" }).querySelector("[data-face]")).toHaveTextContent("N");
  });

  it("while a switch is out the pill says so (busy, its name dimmed); a refusal frees it", async () => {
    holding.add(PUT_DEFAULT);
    refuse.set(PUT_DEFAULT, 500);
    show(readWith("own"));
    expect(pill(OWN.name)).not.toHaveAttribute("aria-busy");
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(pill(OWN.name)).toHaveAttribute("aria-busy", "true");
    await release(PUT_DEFAULT);
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
    expect(pill(OWN.name)).not.toHaveAttribute("aria-busy");
  });

  it("once answered, the old page holds until the next read arrives: nothing more is sent from it, the pill stays busy", async () => {
    holding.add(PUT_DEFAULT);
    const { refreshWith } = show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await waitFor(() => expect(calls).toHaveLength(1));
    await release(PUT_DEFAULT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    // The navigation has not landed: the stale page sends nothing.
    expect(pill(OWN.name)).toHaveAttribute("aria-busy", "true");
    openSwitcher(OWN.name);
    pick(choiceOf("own", DESCRIBED.id).name);
    press(simulate());
    await settle();
    expect(calls).toHaveLength(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    // A read lands on this same screen (the server showed the same audience): free again.
    refreshWith(readWith("own"));
    expect(pill(OWN.name)).not.toHaveAttribute("aria-busy");
    press(simulate());
    expect(router.push).toHaveBeenLastCalledWith(SIMULATE_HREF);
  });

  /** As the routes render it: keyed by the audience shown, so a switch lands on a fresh screen; `leave`
   *  puts another screen in its place (the providers stay, as the app's do). */
  function showRouted(first: AudienceNextRead) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrap = (r: AudienceNextRead | null) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{r ? <AudienceNext key={r.kind === "audience" ? r.page.id : r.kind} read={r} /> : <p>Elsewhere</p>}</ToastProvider>
      </QueryClientProvider>
    );
    const view = render(wrap(first));
    return { ...view, land: (r: AudienceNextRead) => view.rerender(wrap(r)), leave: () => view.rerender(wrap(null)) };
  }

  it("an answer that comes after the creator has left: no push, no refresh (they are not pulled back); the toast still says it", async () => {
    holding.add(PUT_DEFAULT);
    const { leave } = showRouted(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await waitFor(() => expect(calls).toHaveLength(1));
    leave();
    await release(PUT_DEFAULT);
    expect(await screen.findByText(newChatsUse("@leo.makes"))).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each(["phone", "desk"] as const)("on a %s, after a switch the new screen's pill has the focus", async (view) => {
    widthIs(view);
    const { land } = showRouted(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
    land({ ...readWith("other"), choices: DEV_PAGES.own.choices.map((c) => ({ ...c, selected: c.id === LEO.id })) });
    await settle();
    expect(pill(LEO.name)).toHaveFocus();
  });

  it("a screen that is not a switch's landing does not take the focus", async () => {
    showRouted(readWith("own"));
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it("on /audience, the checked one when it is not the audience shown: its own page, without a PUT", async () => {
    // The stored default (@leo.makes) is not the audience shown here (as when it has no groups).
    show({ ...readWith("own"), choices: DEV_PAGES["not-default"].choices });
    openSwitcher(OWN.name);
    pick(choiceOf("not-default", LEO.id).name);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/audience/${LEO.id}`);
    await settle();
    expect(calls).toEqual([]);
  });

  it("while a remove is out for the audience shown, a pick sends nothing and goes nowhere", async () => {
    clock();
    holding.add(`DELETE /api/audiences/${DESCRIBED.id}`);
    show(readWith("described"));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.deleteAudience));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.delete));
    await waitFor(() => expect(calls).toHaveLength(1));
    openSwitcher(DESCRIBED.name);
    pick(choiceOf("described", LEO.id).name);
    openSwitcher(DESCRIBED.name);
    pick(choiceOf("described", DESCRIBED.id).name);
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${DESCRIBED.id}`]);
    expect(router.push).not.toHaveBeenCalled();
    await release(`DELETE /api/audiences/${DESCRIBED.id}`);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/audience"));
  });

  it("when the read after a switch never comes, the hold lets go after 8 seconds and the page is asked for once more (a dropped refresh is retried)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("after the release, a read that comes late frees nothing twice: one press sends one request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { refreshWith } = show(readWith("not-default"));
    openSwitcher(NOT_DEFAULT.name);
    pick(choiceOf("not-default", DESCRIBED.id).name);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_010);
    });
    expect(calls).toHaveLength(1);
    refreshWith(readWith("not-default"));
    expect(pill(NOT_DEFAULT.name)).not.toHaveAttribute("aria-busy");
    press(quiet()!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(calls.map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body)}`)).toEqual([
      `${PUT_DEFAULT} ${JSON.stringify({ audienceId: DESCRIBED.id })}`,
      `${PUT_DEFAULT} ${JSON.stringify({ audienceId: NOT_DEFAULT.id })}`,
    ]);
  });

  it("when the read after a switch never comes (the refresh failed), the hold lets go after 8 seconds: the pill is free, the page answers again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    show(readWith("own"));
    openSwitcher(OWN.name);
    pick(choiceOf("own", LEO.id).name);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(router.push).toHaveBeenCalledWith("/audience");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(pill(OWN.name)).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(pill(OWN.name)).toHaveAttribute("aria-busy", "true");
    press(simulate());
    expect(router.push).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(pill(OWN.name)).not.toHaveAttribute("aria-busy");
    press(simulate());
    expect(router.push).toHaveBeenLastCalledWith(SIMULATE_HREF);
    expect(calls).toHaveLength(1);
  });
});

// ─── Read again ──────────────────────────────────────────────────────────────

describe("AudienceNext — Read again", () => {
  const CALIBRATE = "POST /api/audiences/calibrate";
  const OTHER = DEV_PAGES.other.page;
  const enc = new TextEncoder();

  /** The read's stream, written to as the route writes it. */
  function madeUpStream() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    return {
      body,
      send: (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
      close: () => controller.close(),
    };
  }
  let stream: ReturnType<typeof madeUpStream>;
  /** The read's refusal, when a test wants one (a 401: the session is gone). */
  let calibrateStatus: number | null;
  let tick = 0;

  beforeEach(() => {
    stream = madeUpStream();
    calibrateStatus = null;
    // The read answers a stream; every other request goes to the edge above.
    const edge = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (`${init?.method ?? "GET"} ${String(input)}` !== CALIBRATE) return edge(input, init);
        calls.push({ method: "POST", url: String(input), body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
        if (calibrateStatus !== null) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: calibrateStatus });
        return { ok: true, status: 200, body: stream.body } as unknown as Response;
      }),
    );
    // The question's first moment takes no press; a test here is not about that moment.
    settleClock.now = () => (tick += 1000);
  });
  afterEach(async () => {
    settleClock.now = () => performance.now();
    // A read left open would stay on its way for the next test (the record outlives a page): end it.
    vi.useRealTimers();
    try {
      stream.close();
    } catch {
      // Already ended.
    }
    await settle();
  });

  const sourceAgain = () => within(block("source")!).getByRole("button", { name: S.readAgain });
  const question = () => screen.getByRole("dialog", { name: S.readAgain });
  const confirm = () => fireEvent.click(within(question()).getByRole("button", { name: S.readAgain }));
  const header = () => document.querySelector("header")!;
  const building = () => document.querySelector<HTMLElement>("[data-building]");
  /** A beforeunload as the browser fires it: true when the page asked to stay. */
  function leaving(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }
  async function readAgain(page: AudiencePage = OWN) {
    const view = show(readOf(page));
    press(sourceAgain());
    confirm();
    await settle();
    return view;
  }

  it("the source card's round button asks first; Cancel closes it with the focus back on that button, nothing sent", async () => {
    show(readOf(OWN));
    const again = sourceAgain();
    press(again);
    expect(within(question()).getByText(readAgainLine("nia.tests"))).toBeInTheDocument();
    fireEvent.click(within(question()).getByRole("button", { name: S.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(again).toHaveFocus());
    await settle();
    expect(calls).toEqual([]);
  });

  it("More's Read again asks the same; closing gives the focus back to More", async () => {
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(S.readAgain));
    expect(within(question()).getByText(readAgainLine("nia.tests"))).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(more(OWN.name)).toHaveFocus());
    expect(calls).toEqual([]);
  });

  it("another creator's audience is read again too; a described one has no round button", () => {
    show(readOf(OTHER));
    press(sourceAgain());
    expect(within(question()).getByText(readAgainLine("leo.makes"))).toBeInTheDocument();
    cleanup();
    show(readOf(DESCRIBED));
    expect(within(block("source")!).queryByRole("button", { name: S.readAgain })).toBeNull();
  });

  it("confirming reads the same audience again: the request carries its id, and nothing else is sent (no PUT)", async () => {
    await readAgain();
    expect(calls).toEqual([{ method: "POST", url: "/api/audiences/calibrate", body: readAgainRequestOf(OWN.readAgain!) }]);
    expect(calls[0]!.body).toMatchObject({ audienceId: OWN.id, handle: "nia.tests", type: "personal", platform: "tiktok" });
  });

  it("while it runs the building view stands in for the page: the title stays, no pill and no More; the view has the focus", async () => {
    await readAgain();
    expect(building()).toHaveAttribute("data-building", "running");
    expect(document.querySelector("[data-audience-body]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: S.title })).toBeInTheDocument();
    expect(within(header()).queryAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Open menu"]);
    expect(screen.getByRole("heading", { level: 2, name: S.building })).toHaveFocus();
    // The audience's own face, and whose videos the evidence names.
    expect(building()!.querySelector("[data-face]")).toHaveTextContent(OWN.face.initial);
    stream.send("evidence", { handle: "nia.tests", avatarUrl: "", videos: [{ coverUrl: null, views: 1 }] });
    await settle();
    expect(building()!.querySelector("[data-evidence]")).toHaveTextContent(fromVideos("your"));
  });

  it("another creator's: the evidence is from their videos", async () => {
    await readAgain(OTHER);
    stream.send("evidence", { handle: "leo.makes", avatarUrl: "", videos: [{ coverUrl: null, views: 1 }] });
    await settle();
    expect(building()!.querySelector("[data-evidence]")).toHaveTextContent(fromVideos("their"));
  });

  it("asks to keep the page open while it runs; not once it is over", async () => {
    show(readOf(OWN));
    expect(leaving()).toBe(false);
    press(sourceAgain());
    confirm();
    await settle();
    expect(leaving()).toBe(true);
    stream.send("fallback", { reason: "thin" });
    await settle();
    expect(leaving()).toBe(false);
  });

  it("done (once the stream closes): the page is read again; the view stays until the new read arrives (no old groups, no second Read again), then leaves with the focus on Read again; no PUT, no navigation", async () => {
    const { refreshWith } = await readAgain();
    stream.send("done", { audience: { id: OWN.id } });
    await settle();
    // Settling: the route still stores the figures and posts before it closes the stream.
    expect(router.refresh).not.toHaveBeenCalled();
    expect(building()).not.toBeNull();
    stream.close();
    await settle();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    // Waiting for the page read again: still the view, nothing to press.
    expect(building()).not.toBeNull();
    expect(document.querySelector("[data-audience-body]")).toBeNull();
    expect(screen.queryByRole("button", { name: S.readAgain })).toBeNull();
    expect(within(header()).queryAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Open menu"]);
    expect(leaving()).toBe(false);

    refreshWith(readOf(OWN));
    await settle();
    expect(building()).toBeNull();
    expect(document.querySelector("[data-audience-body]")).not.toBeNull();
    expect(sourceAgain()).toHaveFocus();
    expect(within(header()).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Open menu", `${S.switcherTitle}: ${OWN.name}`, `${S.more}: ${OWN.name}`]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([CALIBRATE]);
  });

  it("done, and no new read within 8 seconds (the refresh was dropped): the page is asked for once more and the view gives way to it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    show(readOf(OWN));
    press(sourceAgain());
    confirm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    stream.send("done", { audience: { id: OWN.id } });
    stream.close();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(building()).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(building()).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(building()).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(2);
    expect(sourceAgain()).toHaveFocus();
  });

  it("an expired session (a 401): the app's session dialog is the whole answer; no sentence about the account, the page as it was, the focus on Read again; no PUT", async () => {
    let raised = 0;
    const count = () => {
      raised += 1;
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, count);
    onTestFinished(() => window.removeEventListener(SESSION_EXPIRED_EVENT, count));
    calibrateStatus = 401;
    await readAgain();
    expect(raised).toBe(1);
    expect(building()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(S.accountNotFound)).toBeNull();
    expect(document.querySelector("[data-audience-body]")).not.toBeNull();
    expect(sourceAgain()).toHaveFocus();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([CALIBRATE]);
    expect(leaving()).toBe(false);
  });

  it("leaving while it runs: nothing more is done from here (no refresh), and the page no longer asks to stay", async () => {
    const { unmount } = await readAgain();
    expect(leaving()).toBe(true);
    unmount();
    expect(leaving()).toBe(false);
    stream.send("done", { audience: { id: OWN.id } });
    stream.close();
    await settle();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("too little to read: the title, why, the groups stay as they were, and Close: back to the page with the focus on Read again", async () => {
    await readAgain();
    stream.send("fallback", { reason: "thin" });
    await settle();
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText(thinWhy("nia.tests"))).toBeInTheDocument();
    expect(screen.getByText(S.keptAsWas)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: S.useGeneral })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(building()).toBeNull();
    await settle();
    expect(sourceAgain()).toHaveFocus();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([CALIBRATE]);
  });

  it("failed: the sentence; Try again sends the same request again; Close goes back to the page", async () => {
    await readAgain();
    stream.send("error", { message: null });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
    stream = madeUpStream();
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    await settle();
    expect(calls.map((c) => c.body)).toEqual([readAgainRequestOf(OWN.readAgain!), readAgainRequestOf(OWN.readAgain!)]);
    expect(building()).toHaveAttribute("data-building", "running");
    stream.send("error", { message: null });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(building()).toBeNull();
    await settle();
    expect(sourceAgain()).toHaveFocus();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("while a remove is out for this audience, Read again does not open", async () => {
    clock();
    holding.add(`DELETE /api/audiences/${OWN.id}`);
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(disconnectItem("nia.tests")));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.disconnect));
    await waitFor(() => expect(calls).toHaveLength(1));
    press(sourceAgain());
    expect(screen.queryByRole("dialog", { name: S.readAgain })).toBeNull();
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/audiences/${OWN.id}`]);
  });

  it("while a switch is out, Read again does not open", async () => {
    holding.add(PUT_DEFAULT);
    show({ kind: "audience", pushed: false, page: OWN, choices: DEV_PAGES.own.choices });
    press(screen.getByRole("button", { name: `${S.switcherTitle}: ${OWN.name}` }));
    const leo = DEV_PAGES.own.choices.find((c) => c.id === OTHER.id)!;
    fireEvent.click(within(screen.getByRole("dialog", { name: S.switcherTitle })).getByRole("button", { name: leo.name }));
    await waitFor(() => expect(calls).toHaveLength(1));
    press(sourceAgain());
    expect(screen.queryByRole("dialog", { name: S.readAgain })).toBeNull();
    await release(PUT_DEFAULT);
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([PUT_DEFAULT]);
  });

  it("a read again of this audience still on its way from a visit the creator left: the question does not open, a toast says so, nothing is sent; when it ends, the page reads itself again", async () => {
    const first = await readAgain();
    first.unmount();
    show(readOf(OWN));
    press(sourceAgain());
    expect(screen.queryByRole("dialog", { name: S.readAgain })).toBeNull();
    expect(await screen.findByText(stillReading("nia.tests"))).toBeInTheDocument();
    openMore(OWN.name);
    fireEvent.click(menuItem(S.readAgain));
    expect(screen.queryByRole("dialog", { name: S.readAgain })).toBeNull();
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([CALIBRATE]);
    expect(router.refresh).not.toHaveBeenCalled();
    stream.send("done", { audience: { id: OWN.id } });
    stream.close();
    await settle();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a rename, then Read again before the page is read again: the read carries the new name (it writes it back)", async () => {
    holding.add(`PATCH /api/audiences/${OWN.id}`);
    show(readOf(OWN));
    openMore(OWN.name);
    fireEvent.click(menuItem(S.rename));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(menuItem(S.save));
    await settle();
    press(sourceAgain());
    confirm();
    await settle();
    const read = calls.find((c) => `${c.method} ${c.url}` === CALIBRATE)!;
    expect(read.body).toMatchObject({ name: "Night owls", audienceId: OWN.id });
    await release(`PATCH /api/audiences/${OWN.id}`);
  });

  it("has no axe violations with the question open, nor while it runs", async () => {
    show(readOf(OWN));
    press(sourceAgain());
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(question())).toHaveNoViolations();
    confirm();
    await settle();
    stream.send("stage", { name: "Reading your followers", status: "active" });
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

// ─── Answers that come late ──────────────────────────────────────────────────

describe("AudienceNext — answers that come late", () => {
  /** As the routes render it, inside providers that outlive the screen; `leave()` takes the screen away. */
  function showLeavable(read: AudienceNextRead) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = (r: AudienceNextRead | null) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{r ? <AudienceNext key={r.kind === "audience" ? r.page.id : r.kind} read={r} /> : <p>Elsewhere</p>}</ToastProvider>
      </QueryClientProvider>
    );
    const view = render(tree(read));
    return { ...view, land: (r: AudienceNextRead) => view.rerender(tree(r)), leave: () => view.rerender(tree(null)) };
  }
  const readWith = (name: keyof typeof DEV_PAGES): Extract<AudienceNextRead, { kind: "audience" }> => ({
    kind: "audience",
    pushed: DEV_PAGES[name].pushed,
    page: DEV_PAGES[name].page,
    choices: DEV_PAGES[name].choices,
  });
  const pill = (name: string) => screen.getByRole("button", { name: `${S.switcherTitle}: ${name}`, hidden: true });

  it("Simulate on an audience not yet the default: once the PUT is answered the page counts it as the default; if Home never opens, a press opens it again with no second PUT, and the page answers", async () => {
    show(readOf(NOT_DEFAULT, true));
    press(simulate());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(SIMULATE_HREF));
    await settle();
    expect(simulate()).not.toHaveAttribute("aria-busy");
    expect(quiet()).toBeNull();
    press(simulate());
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith(SIMULATE_HREF);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
  });

  it("Simulate answered after the creator left: Home does not open", async () => {
    holding.add(PUT_DEFAULT);
    const { leave } = showLeavable(readOf(NOT_DEFAULT, true));
    press(simulate());
    await waitFor(() => expect(calls).toHaveLength(1));
    leave();
    await release(PUT_DEFAULT);
    await settle();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Use for new chats answered after the creator left: nothing is read again or focused; the toast still says it", async () => {
    holding.add(PUT_DEFAULT);
    const { leave } = showLeavable(readOf(NOT_DEFAULT, true));
    press(quiet()!);
    await waitFor(() => expect(calls).toHaveLength(1));
    leave();
    await release(PUT_DEFAULT);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a remove answered after the creator left: they are not pulled back to /audience", async () => {
    clock();
    holding.add(`DELETE /api/audiences/${DESCRIBED.id}`);
    const { leave } = showLeavable(readOf(DESCRIBED));
    openMore(DESCRIBED.name);
    fireEvent.click(menuItem(S.deleteAudience));
    vi.advanceTimersByTime(600);
    fireEvent.click(menuItem(S.delete));
    await waitFor(() => expect(calls).toHaveLength(1));
    leave();
    await release(`DELETE /api/audiences/${DESCRIBED.id}`);
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a switch that lands on this same screen, with no press after it: the 8-second wait asks for nothing more", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { land } = showLeavable(readWith("own"));
    press(pill(OWN.name));
    fireEvent.click(within(screen.getByRole("dialog", { name: S.switcherTitle })).getByRole("button", { name: DEV_PAGES.own.choices.find((c) => c.id === DEV_PAGES.other.page.id)!.name }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    // The server showed the same audience again: the same screen, a new read.
    land(readWith("own"));
    expect(pill(OWN.name)).not.toHaveAttribute("aria-busy");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
