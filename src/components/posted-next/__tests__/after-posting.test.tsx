/** @vitest-environment happy-dom */
/**
 * AfterPosting — what a result page shows under its first block (plan 2026-11-24-after-posting, Task 3):
 * the quiet "Posted it?" row when the piece has no posted link, the card when it has one, the sheet,
 * the reads. Real: the container, the card, the ask row, the sheet, the hooks, TanStack Query. Stand-ins:
 * `fetch` (a small in-memory stand-in for the four routes), `matchMedia`, the clock (`Date`, fixed to
 * Tue 24 Nov 2026 12:00 local) and the build-time flag. Every handle, id and link is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { ToastProvider } from "@/components/ui/toast";
import { postedKeys, type PostedPiece } from "@/hooks/queries/use-posted";
import type { Posted } from "@/lib/posted/posted";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { AfterPosting } from "../after-posting";
import { CAPTION, KEY, NOW, PASTED, POSTED_ID, THREAD, deferred, json, posted, reading, sentOf, soFar, unread } from "./posted-fixtures";

const PIECE: PostedPiece = { kind: "text", threadId: THREAD, key: KEY };

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

/** The routes, in memory: the stored link (or none) and what a read of it turns it into. */
const server = {
  stored: null as Posted | null,
  getStatus: 200,
  deleteStatus: 204,
  /** What a read does to the stored link; the answer can be held. */
  read: (_body: { id?: string; retry?: boolean }) => soFar() as Posted,
  hold: null as Promise<void> | null,
};

let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  widthIs("phone");
  server.stored = null;
  server.getStatus = 200;
  server.deleteStatus = 204;
  server.read = () => soFar();
  server.hold = null;
  client = new QueryClient();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = String(input).split("?")[0];
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (method === "GET" && path === "/api/posted") {
      if (server.getStatus !== 200) return json({ error: "Not found" }, server.getStatus);
      // An answer carrying text from outside the app: it must never be shown.
      return json({ posted: server.stored ? { ...server.stored, caption: CAPTION, url: PASTED } : null });
    }
    if (method === "POST" && path === "/api/posted") {
      server.stored = reading();
      return json({ posted: server.stored }, 201);
    }
    if (method === "POST" && path === "/api/posted/refresh") {
      if (server.hold) await server.hold;
      server.stored = server.read(body);
      return json({ posted: [server.stored] });
    }
    if (method === "DELETE" && path === `/api/posted/${POSTED_ID}`) {
      if (server.deleteStatus !== 204) return json({ error: "boom" }, server.deleteStatus);
      server.stored = null;
      return new Response(null, { status: 204 });
    }
    return json({ error: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderAfter(piece: PostedPiece = PIECE) {
  // The toast's provider as the (app) layout has it.
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <main>
          <AfterPosting piece={piece} />
        </main>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const refreshes = () => sentOf(fetchMock).filter((s) => s.url === "/api/posted/refresh");
const ask = () => screen.getByRole("button", { name: `${POSTED_STRINGS.askTitle} ${POSTED_STRINGS.askText}` });
const card = () => document.querySelector<HTMLElement>("[data-after-posting]");
/** Radix hands the focus back on a timer once a layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe("AfterPosting — no posted link", () => {
  it("nothing while the piece's link is read; then the quiet row, Posted it? / Add the link and see what it did.", async () => {
    const view = renderAfter();
    expect(view.container.querySelector("main")!.childElementCount).toBe(0);
    expect(await screen.findByRole("button", { name: /Posted it\?/ })).toBeInTheDocument();
    expect(ask().textContent).toContain(POSTED_STRINGS.askTitle);
    expect(ask().textContent).toContain(POSTED_STRINGS.askText);
    expect(card()).toBeNull();
    expect(refreshes()).toEqual([]);
  });

  it("the read refused (a funnel visitor, not the caller's piece): nothing at all", async () => {
    server.getStatus = 404;
    const view = renderAfter();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(view.container.querySelector("main")!.childElementCount).toBe(0);
  });

  it("the row is a button 44 or more tall, and opens the sheet with the field focused", async () => {
    renderAfter();
    const row = await screen.findByRole("button", { name: /Posted it\?/ });
    expect(row.className).toMatch(/\bmin-h-(1[1-9]|[2-9]\d)\b|\bmin-h-16\b/);
    fireEvent.click(row);
    expect(screen.getByRole("dialog", { name: POSTED_STRINGS.sheetTitle })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: POSTED_STRINGS.field })).toHaveFocus();
  });
});

describe("AfterPosting — adding a link", () => {
  it("added: the sheet closes, the card reads the post (focus on its title), ONE read starts, then the numbers", async () => {
    const out = deferred<void>();
    server.hold = out.promise;
    renderAfter();
    fireEvent.click(await screen.findByRole("button", { name: /Posted it\?/ }));
    fireEvent.change(screen.getByRole("textbox", { name: POSTED_STRINGS.field }), { target: { value: PASTED } });
    fireEvent.submit(screen.getByRole("textbox", { name: POSTED_STRINGS.field }).closest("form")!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(card()).not.toBeNull();
    expect(within(card()!).getByRole("status").textContent).toBe(`${POSTED_STRINGS.reading}${POSTED_STRINGS.readingText}`);
    expect(screen.queryByRole("button", { name: /Posted it\?/ })).toBeNull();
    await settle();
    expect(within(card()!).getByRole("heading", { name: POSTED_STRINGS.cardTitle })).toHaveFocus();
    expect(refreshes()).toEqual([{ method: "POST", url: "/api/posted/refresh", body: { id: POSTED_ID } }]);

    await act(async () => out.resolve());
    await waitFor(() => expect(within(card()!).queryByRole("status")).toBeNull());
    expect(card()!.textContent).toContain("12.4K");
    expect(card()!.textContent).toContain("views so far");
    expect(card()!.textContent).toContain("Posted Mon 23 Nov on TikTok, @nia.cooks · final numbers Thursday");
    // One read in all: the add's own, not another from the page for the same link.
    await act(async () => {});
    expect(refreshes()).toHaveLength(1);
  });

  it("neither the pasted link nor a caption is ever shown, nor linked", async () => {
    server.stored = posted();
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(document.body.textContent).not.toContain(CAPTION);
    expect(document.body.innerHTML).not.toContain("is_from_webapp");
    expect(Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
      "https://www.tiktok.com/@nia.cooks/video/7301444403323456789",
    ]);
  });
});

describe("AfterPosting — reads on a visit", () => {
  it("a link owed a read: ONE read for this mount; it comes back still owed one, and no other starts", async () => {
    server.stored = soFar({ due: true });
    server.read = () => soFar({ due: true });
    renderAfter();
    await waitFor(() => expect(refreshes()).toHaveLength(1));
    expect(refreshes()[0]!.body).toEqual({ id: POSTED_ID });
    // The read's end marks the entries old: the page reads the link again, and it is still owed a read.
    await waitFor(() => expect(sentOf(fetchMock).filter((s) => s.method === "GET").length).toBeGreaterThanOrEqual(2));
    await act(async () => {});
    expect(refreshes()).toHaveLength(1);
  });

  it("a link owed nothing (final): no read", async () => {
    server.stored = posted();
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    await act(async () => {});
    expect(refreshes()).toEqual([]);
    expect(card()!.textContent).toContain("Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers");
  });
});

describe("AfterPosting — removing", () => {
  it("from the card's More, asked once more: the link goes, the quiet row is back with the focus on it", async () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    vi.setSystemTime(NOW);
    server.stored = posted();
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    const more = screen.getByRole("button", { name: "More: posted link" });
    more.focus();
    fireEvent.click(more);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: POSTED_STRINGS.removeItem }));
    vi.advanceTimersByTime(600);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: POSTED_STRINGS.remove }));

    await waitFor(() => expect(card()).toBeNull());
    expect(sentOf(fetchMock).filter((s) => s.method === "DELETE")).toEqual([{ method: "DELETE", url: `/api/posted/${POSTED_ID}`, body: undefined }]);
    await settle();
    expect(ask()).toHaveFocus();
  });

  it("could not be read: Remove, asked once more on the card; the quiet row is back with the focus on it", async () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    vi.setSystemTime(NOW);
    server.stored = unread();
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    fireEvent.click(within(card()!).getByRole("button", { name: POSTED_STRINGS.remove }));
    vi.advanceTimersByTime(600);
    fireEvent.click(within(card()!).getByRole("button", { name: POSTED_STRINGS.remove }));
    await waitFor(() => expect(card()).toBeNull());
    expect(sentOf(fetchMock).filter((s) => s.method === "DELETE")).toHaveLength(1);
    expect(ask()).toHaveFocus();
  });
});

describe("AfterPosting — Try again", () => {
  it("reads the post again with retry; the card reads meanwhile (focus on its title); then the numbers", async () => {
    server.stored = unread();
    const out = deferred<void>();
    server.hold = out.promise;
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(refreshes()).toEqual([]);
    const tryAgain = within(card()!).getByRole("button", { name: POSTED_STRINGS.tryAgain });
    tryAgain.focus();
    fireEvent.click(tryAgain);
    expect(refreshes()).toEqual([{ method: "POST", url: "/api/posted/refresh", body: { id: POSTED_ID, retry: true } }]);
    expect(within(card()!).getByRole("status").textContent).toBe(`${POSTED_STRINGS.reading}${POSTED_STRINGS.readingText}`);
    await act(async () => {});
    expect(within(card()!).getByRole("heading", { name: POSTED_STRINGS.cardTitle })).toHaveFocus();

    await act(async () => out.resolve());
    await waitFor(() => expect(card()!.textContent).toContain("12.4K"));
    expect(refreshes()).toHaveLength(1);
  });
});

describe("AfterPosting — a re-read that fails (ruling 20)", () => {
  it("a good first read, then a refused re-read: the card is still there", async () => {
    server.stored = posted();
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    server.getStatus = 500;
    await act(async () => {
      await client.invalidateQueries({ queryKey: postedKeys.all });
    });
    expect(client.getQueryState(postedKeys.piece(PIECE))?.status).toBe("error");
    await settle(); // the page has heard of the error
    expect(card()).not.toBeNull();
    expect(card()!.textContent).toContain("31K");
  });

  it("the same for the quiet row", async () => {
    renderAfter();
    await screen.findByRole("button", { name: /Posted it\?/ });
    server.getStatus = 500;
    await act(async () => {
      await client.invalidateQueries({ queryKey: postedKeys.all });
    });
    expect(client.getQueryState(postedKeys.piece(PIECE))?.status).toBe("error");
    await settle(); // the page has heard of the error
    expect(ask()).toBeInTheDocument();
  });
});

describe("AfterPosting — reading is never a dead end (ruling 19b)", () => {
  /** The interval and the clock stood in; the rest of the timers (TanStack's notices, Radix) stay real. */
  function clock() {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
  }
  /** Lets the answers in flight land (real timers). */
  const land = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  const after = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
    await land();
  };
  const gets = () => sentOf(fetchMock).filter((s) => s.method === "GET").length;

  it("the row is read again every 10 seconds (the cheap read, never the scraper); the numbers show after the second", async () => {
    clock();
    server.stored = reading({ due: false });
    renderAfter();
    await land();
    expect(within(card()!).getByRole("status")).toBeInTheDocument();
    expect(gets()).toBe(1);

    await after(9_000);
    expect(gets()).toBe(1);
    await after(1_000);
    expect(gets()).toBe(2);
    expect(within(card()!).getByRole("status")).toBeInTheDocument();

    server.stored = soFar();
    await after(10_000);
    expect(gets()).toBe(3);
    expect(within(card()!).queryByRole("status")).toBeNull();
    expect(card()!.textContent).toContain("12.4K");

    // The state changed: no more re-reads.
    await after(60_000);
    expect(gets()).toBe(3);
    expect(refreshes()).toEqual([]);
  });

  it("a first read that failed comes back as could not be read: the sentence and Try again, then no more re-reads", async () => {
    clock();
    server.stored = reading({ due: false });
    renderAfter();
    await land();
    server.stored = unread();
    await after(10_000);
    expect(within(card()!).getByText(POSTED_STRINGS.unread)).toBeInTheDocument();
    expect(within(card()!).getByRole("button", { name: POSTED_STRINGS.tryAgain })).toBeInTheDocument();
    const asked = gets();
    await after(60_000);
    expect(gets()).toBe(asked);
    expect(refreshes()).toEqual([]);
  });

  it("at most 3 minutes: 18 re-reads, then none", async () => {
    clock();
    server.stored = reading({ due: false });
    renderAfter();
    await land();
    for (let s = 0; s < 18; s += 1) await after(10_000);
    expect(gets()).toBe(1 + 18);
    for (let s = 0; s < 6; s += 1) await after(10_000);
    expect(gets()).toBe(1 + 18);
    expect(within(card()!).getByRole("status")).toBeInTheDocument();
  });

  it("the piece leaves the page: nothing more is asked, no timer is left", async () => {
    clock();
    server.stored = reading({ due: false });
    const view = renderAfter();
    await land();
    await after(10_000);
    const asked = gets();
    view.unmount();
    await after(60_000);
    expect(gets()).toBe(asked);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a link owed a read: its one scraper read per mount, and the re-reads never start another", async () => {
    clock();
    server.stored = reading({ due: true });
    server.read = () => reading({ due: true }); // the read did not reach it (say, claimed by another request)
    renderAfter();
    await land();
    expect(refreshes()).toHaveLength(1);
    for (let s = 0; s < 5; s += 1) await after(10_000);
    expect(gets()).toBeGreaterThanOrEqual(6);
    expect(refreshes()).toHaveLength(1);
  });
});

describe("AfterPosting — a refused remove (rulings 17, 21)", () => {
  it("Couldn't remove the link. in the toast; the card stays", async () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    vi.setSystemTime(NOW);
    server.stored = posted();
    server.deleteStatus = 500;
    renderAfter();
    await waitFor(() => expect(card()).not.toBeNull());
    const more = screen.getByRole("button", { name: "More: posted link" });
    more.focus();
    fireEvent.click(more);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: POSTED_STRINGS.removeItem }));
    vi.advanceTimersByTime(600);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: POSTED_STRINGS.remove }));

    expect(await screen.findByText(POSTED_STRINGS.removeFailed)).toBeInTheDocument();
    expect(screen.getByText(POSTED_STRINGS.removeFailed).closest('[role="alert"]')).not.toBeNull();
    await settle();
    expect(card()).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Posted it\?/ })).toBeNull();
    expect(sentOf(fetchMock).filter((s) => s.method === "DELETE")).toHaveLength(1);
  });
});

describe("AfterPosting — a video", () => {
  it("reads by the analysis id", async () => {
    renderAfter({ kind: "video", analysisId: "44444444-4444-4444-8444-444444444444" });
    await screen.findByRole("button", { name: /Posted it\?/ });
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ analysisId: "44444444-4444-4444-8444-444444444444" });
  });
});
