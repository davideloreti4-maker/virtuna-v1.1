/** @vitest-environment happy-dom */
/**
 * Stop and Retry on the live turn, flag off (the legacy thread turn). The same two fixes as
 * composer-stop-retry.flag-on.test.tsx: Stop while the run is still thinking keeps the creator's
 * message on screen, and Retry sends the request the failed run sent.
 *
 * The real composer and its real stream hooks; stand-ins only for the network (`fetch`), the router
 * and the storage client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { useBoardStore } from "@/stores/board-store";
import { ACCOUNT_READ_FULL } from "@/components/thread-next/__tests__/fixtures/answers";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
/** How the chat route answers its n-th request. */
let chatReply: (signal: AbortSignal | null | undefined, n: number) => Response;
let threadFixture: unknown;

const at = "2026-11-21T00:00:00.000Z";
const THREAD = {
  threadId: "t1",
  messages: [
    { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "first ask" } }], created_at: at },
    { id: "m1", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "First answer." } }], created_at: at },
  ],
  simSeals: {},
};

/** An SSE body that stays open until the request aborts. */
function held(signal: AbortSignal | null | undefined): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener("abort", () => controller.error(new DOMException("The operation was aborted.", "AbortError")));
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

beforeEach(() => {
  cleanup();
  calls = [];
  chatReply = (signal) => held(signal);
  threadFixture = THREAD;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/api/tools/chat")) return chatReply(init?.signal, calls.filter((c) => c.url.includes("/api/tools/chat")).length);
    if (url.includes("/api/threads/open")) return json(threadFixture);
    if (url.includes("/api/threads/new")) return json({ threadId: "t-new" });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    return json({});
  }) as typeof fetch;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const requests = (path: string) => calls.filter((c) => c.url.includes(path));
const bodyOf = (c: Call) => JSON.parse(String(c.init?.body ?? "{}")) as Record<string, unknown>;

async function renderComposer() {
  renderWithClient(<Composer />);
  expect(await screen.findByText("First answer.")).toBeInTheDocument();
}

function sendChat(ask: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: ask } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("flag off: Stop while the chat is still thinking", () => {
  it("keeps the creator's message, with no error and the disc back to send", async () => {
    await renderComposer();
    sendChat("what should I post this week?");
    const stop = await screen.findByRole("button", { name: "Stop the run" });
    expect(screen.getByText("what should I post this week?")).toBeInTheDocument();

    fireEvent.click(stop);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(requests("/api/tools/chat")[0]!.init?.signal?.aborted).toBe(true);
    expect(screen.getByText("what should I post this week?")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("First answer.")).toBeInTheDocument();
  });
});

describe("flag off: a new chat's first run, stopped while thinking", () => {
  it("is the thread: the page keeps the thread layout, with the creator's message", async () => {
    threadFixture = { threadId: "t1", messages: [] };
    const onThreadChange = vi.fn();
    renderWithClient(<Composer onThreadChange={onThreadChange} />);
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onThreadChange).toHaveBeenLastCalledWith(false);

    sendChat("what time of day should I post on tiktok?");
    fireEvent.click(await screen.findByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("what time of day should I post on tiktok?", { selector: "p" })).toBeInTheDocument();
  });
});

describe("flag off: Retry on a failed chat", () => {
  it("sends the same ask again", async () => {
    chatReply = (signal, n) =>
      n === 1 ? ({ ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response) : held(signal);
    await renderComposer();
    sendChat("what should I post this week?");
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
    const [first, again] = requests("/api/tools/chat").map(bodyOf);
    expect(first!.ask).toBe("what should I post this week?");
    expect(again).toEqual(first);
    fireEvent.click(await screen.findByRole("button", { name: "Stop the run" }));
  });
});

describe("flag off: a stopped ask that a read of the thread brings in", () => {
  it("is drawn once (a profile read reads the thread after the stop)", async () => {
    await renderComposer();
    sendChat("what should I post this week?");
    fireEvent.click(await screen.findByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getAllByText("what should I post this week?", { selector: "p" })).toHaveLength(1);

    // The route stored the ask before it was stopped; an evidence read stores its card and reads the thread.
    threadFixture = {
      ...THREAD,
      messages: [
        ...THREAD.messages,
        { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "what should I post this week?" } }], created_at: at },
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Read your chat." } }], created_at: at },
      ],
    };
    const input = document.querySelector('input[type="file"][accept*=".txt"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["me: hi"], "chat.txt", { type: "text/plain" })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Read this evidence" }));
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    expect(await screen.findByText("Read your chat.")).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getAllByText("what should I post this week?", { selector: "p" })).toHaveLength(1);
  });
});

describe("flag off: the starter card's account read in a brand-new chat", () => {
  afterEach(() => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  });

  it("makes the chat before the read, asks the route to store it, keeps the thread layout through the fold, and the read is in the thread", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    threadFixture = { messages: [] };
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/account-read")) {
        calls.push({ url, init });
        // The route stores the read in the new chat, then sends it.
        threadFixture = {
          threadId: "t-new",
          messages: [
            // Any message the client stored itself, then what the route stores: the read's message and the read.
            ...requests("/api/threads/user-turn").map((c, i) => ({ id: `ut${i}`, thread_id: "t-new", role: "user", blocks: [{ type: "markdown", props: { text: String(bodyOf(c).text) } }], created_at: at })),
            { id: "u1", thread_id: "t-new", role: "user", blocks: [{ type: "markdown", props: { text: "Read my account" } }], created_at: at },
            { id: "m1", thread_id: "t-new", role: "assistant", blocks: [{ type: "run-header", props: { skill: "account" } }, ACCOUNT_READ_FULL], created_at: at },
          ],
        };
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            await new Promise((r) => setTimeout(r, 30));
            controller.enqueue(new TextEncoder().encode(`event: done\ndata: ${JSON.stringify({ block: ACCOUNT_READ_FULL })}\n\n`));
            controller.close();
          },
        });
        return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
    const onThreadChange = vi.fn();
    renderWithClient(<Composer onThreadChange={onThreadChange} />);
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onThreadChange).toHaveBeenLastCalledWith(false);

    const opensBefore = requests("/api/threads/open").length;
    fireEvent.click(await screen.findByRole("button", { name: /Read my recent posts/ }));
    await waitFor(() => expect(requests("/api/account-read")).toHaveLength(1));
    const made = calls.findIndex((c) => c.url.includes("/api/threads/new"));
    expect(made).toBeGreaterThanOrEqual(0);
    expect(made).toBeLessThan(calls.indexOf(requests("/api/account-read")[0]!));
    expect(bodyOf(requests("/api/account-read")[0]!)).toEqual({ persist: true });
    // Its message is the route's to store, with the read: nothing from the client.
    expect(requests("/api/threads/user-turn")).toHaveLength(0);

    // The fold: the thread read again once the read is in.
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opensBefore));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onThreadChange.mock.calls.slice(1).every(([v]) => v === true)).toBe(true);
    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    expect(document.body.textContent?.split("@creator_one").length).toBe(2); // the read, once
    expect(screen.getAllByText("Read my account", { selector: "p" })).toHaveLength(1); // its message, once
  });
});

describe("flag off: two quick taps on the starter card's account read", () => {
  afterEach(() => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  });

  it("make one chat and one read: the second tap lands while the chat is still being made, and does nothing", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    threadFixture = { messages: [] };
    let release!: () => void;
    const made = new Promise<void>((r) => (release = r));
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/threads/new")) {
        calls.push({ url, init });
        await made;
        return json({ threadId: "t-new" });
      }
      if (url.includes("/api/account-read")) {
        calls.push({ url, init });
        return held(init?.signal);
      }
      return base(input, init);
    }) as typeof fetch;
    renderWithClient(<Composer />);
    const card = await screen.findByRole("button", { name: /Read my recent posts/ });
    fireEvent.click(card);
    fireEvent.click(card);
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(() => expect(requests("/api/account-read")).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(requests("/api/threads/new")).toHaveLength(1);
    expect(requests("/api/account-read")).toHaveLength(1);
    expect(requests("/api/account-read")[0]!.init?.signal?.aborted).toBe(false);
  });
});

describe("flag off: leaving a chat while its answer streams", () => {
  it("lets the run's request go on (not aborted), and the next chat is at rest", async () => {
    await renderComposer();
    sendChat("what should I post this week?");
    await screen.findByRole("button", { name: "Stop the run" });

    threadFixture = { threadId: "t2", messages: [{ id: "m9", thread_id: "t2", role: "assistant", blocks: [{ type: "markdown", props: { text: "Another answer." } }], created_at: at }], simSeals: {} };
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("Another answer.")).toBeInTheDocument();
    expect(requests("/api/tools/chat")[0]!.init?.signal?.aborted).toBe(false);
    expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull();
  });
});

describe("flag off: a chat reopened while its run still goes on, on the server", () => {
  it("shows the wait under the question; the stored answer arrives on a later read, drawn once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const asked = (ago: number) => ({ id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "hooks about meal prep" } }], created_at: new Date(Date.now() - ago).toISOString() });
      threadFixture = { ...THREAD, messages: [...THREAD.messages, asked(3_000)] };
      renderWithClient(<Composer />);
      expect(await screen.findByText("First answer.")).toBeInTheDocument();
      // The legacy turn's wait; the field stays free (a reopen wait never holds it).
      await waitFor(() => expect(screen.getByText("Thinking…")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull();
      expect(screen.getAllByText("hooks about meal prep", { selector: "p" })).toHaveLength(1);

      threadFixture = {
        ...THREAD,
        messages: [...THREAD.messages, asked(9_000), { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Three hooks for busy students." } }], created_at: at }],
      };
      await act(async () => {
        vi.advanceTimersByTime(3_100);
      });
      await waitFor(() => expect(screen.getAllByText("Three hooks for busy students.")).toHaveLength(1));
      expect(screen.getAllByText("hooks about meal prep", { selector: "p" })).toHaveLength(1);
      expect(screen.queryByText("Thinking…")).toBeNull();
      await waitFor(() => expect(screen.queryByRole("button", { name: "Stop the run" })).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });
});
