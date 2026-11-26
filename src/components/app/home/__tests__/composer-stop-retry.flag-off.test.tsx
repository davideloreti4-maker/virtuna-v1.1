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
