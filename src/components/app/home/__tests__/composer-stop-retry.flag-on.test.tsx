/** @vitest-environment happy-dom */
/**
 * Stop and Retry on the live turn, under the new look.
 *
 * Stop: pressing Stop while the run is still "Thinking" (no word, stage or card yet) took the
 * creator's own message off the screen. The live turn is the only thing that draws that message,
 * and a stream with nothing in it no longer counted as a run. A stopped run is still a run: its
 * message stays, as it does for a run stopped mid-answer. A run that starts after it replaces it.
 *
 * Retry: a failed turn's Retry sent an empty ask (`start("", platform)`): a different run, with no
 * intent, and for a remix no link at all. It now sends the request the failed run sent.
 *
 * The real composer and its real stream hooks. Stand-ins only for the network (`fetch`, answered
 * with SSE bodies the test writes), the router and the storage client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));

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

// ── the network ──────────────────────────────────────────────────────────────
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
/** How a stream path answers, by path; a path with none set ends at once with no frames. */
let streams: Record<string, (signal: AbortSignal | null | undefined, n: number) => Response> = {};
let threadFixture: unknown;
let audiencesFixture: unknown = { audiences: [] };

const at = "2026-11-21T00:00:00.000Z";
const msg = (id: string, role: "user" | "assistant", text: string) => ({
  id,
  thread_id: "t1",
  role,
  blocks: [{ type: "markdown", props: { text } }],
  created_at: at,
});
/** One settled exchange: the open thread, so the field is docked under it. */
const historyThread = () => ({ threadId: "t1", messages: [msg("u1", "user", "first ask"), msg("m1", "assistant", "First answer.")], simSeals: {} });

/** An SSE body of these frames (after `delayMs`); held open until the request aborts, or closed after them. */
function sse(signal: AbortSignal | null | undefined, frames: Array<[string, unknown]>, hold: boolean, delayMs = 0): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      for (const [event, data] of frames) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      if (!hold) {
        controller.close();
        return;
      }
      signal?.addEventListener("abort", () => controller.error(new DOMException("The operation was aborted.", "AbortError")));
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}
const refused = () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }) as unknown as Response;
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

beforeEach(() => {
  cleanup();
  calls = [];
  streams = {};
  threadFixture = historyThread();
  audiencesFixture = { audiences: [] };
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const entry = Object.entries(streams).find(([path]) => url.includes(path));
    if (entry) return entry[1](init?.signal, calls.filter((c) => c.url.includes(entry[0])).length);
    if (url.includes("/api/tools/")) return sse(init?.signal, [], false);
    if (url.includes("/api/threads/open")) return json(threadFixture);
    if (url.includes("/api/threads/new")) return json({ threadId: "t-new" });
    if (url.includes("/api/audiences")) return json(audiencesFixture);
    if (url.includes("/api/tracked-accounts")) return json({ accounts: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    if (url.includes("/api/surfaces/drops")) return json({ drops: [] });
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
const field = () => screen.getByTestId("thread-field");
const inField = () => within(field());
const text = () => inField().getByRole("textbox") as HTMLTextAreaElement;
const send = () => field().querySelector('button[type="submit"]') as HTMLButtonElement;
const pill = (name: string) => {
  const found = inField()
    .getAllByRole("button", { name })
    .filter((b) => b.getAttribute("type") !== "submit");
  expect(found).toHaveLength(1);
  return found[0]!;
};
/** The creator's message in its bubble (a new chat's header also shows it, as the chat's name). */
const bubble = (t: string) => screen.getByText(t, { selector: "p" });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

async function renderComposer() {
  renderWithClient(<Composer />);
  await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.queryByText("Opening thread…")).toBeNull());
  await screen.findByTestId("next-field-dock");
}

/** Send `ask` (with `skill`'s pill, or chat), wait for Stop, press it, wait for it to go. */
async function sendAndStop(ask: string, skill?: string) {
  if (skill) fireEvent.click(pill(skill));
  fireEvent.change(text(), { target: { value: ask } });
  fireEvent.click(send());
  const stop = await waitFor(() => inField().getByRole("button", { name: "Stop the run" }));
  // Still "Thinking": nothing has arrived.
  expect(bubble(ask)).toBeInTheDocument();
  fireEvent.click(stop);
  await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
  await settle();
}

describe("Stop while the run is still thinking", () => {
  it("a chat ask: the creator's message stays, with no wait line, no error and no empty answer", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    await renderComposer();
    await sendAndStop("what should I post this week?");

    expect(requests("/api/tools/chat")[0]!.init?.signal?.aborted).toBe(true);
    expect(screen.getByText("what should I post this week?")).toBeInTheDocument();
    expect(screen.queryByText("Thinking")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // The earlier exchange is untouched, and the field is back to rest: send, not Stop.
    expect(screen.getByText("First answer.")).toBeInTheDocument();
    expect(send()).toHaveAttribute("aria-label", "Send message");
  });

  it("a hooks ask: the creator's message stays", async () => {
    streams["/api/tools/hooks"] = (signal) => sse(signal, [], true);
    await renderComposer();
    await sendAndStop("gym myths", "Hooks");

    expect(screen.getByText("gym myths")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the next run replaces it: once that run is in the thread, its ask shows once", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    // The hooks run finishes and closes; the thread then holds its ask and its answer. Its answer
    // comes after a beat, as over a network: the run is seen running before it ends.
    streams["/api/tools/hooks"] = (signal) => {
      threadFixture = {
        ...historyThread(),
        messages: [...historyThread().messages, msg("u2", "user", "meal prep"), msg("m2", "assistant", "Three hooks.")],
      };
      return sse(signal, [["stage", { name: "Ran your audience", status: "done" }], ["done", {}]], false, 30);
    };
    await renderComposer();
    await sendAndStop("what should I post this week?");

    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    expect(await screen.findByText("Three hooks.")).toBeInTheDocument();
    await settle();

    expect(screen.getAllByText("meal prep")).toHaveLength(1);
  });
});

describe("in a new chat (no history), the stopped or failed first run is the thread", () => {
  // The page takes the thread layout from `onThreadChange`. Drawing the live turn while the page
  // still has the Home layout grew the page without end in the app (the thread's room under the
  // sent turn is sized from a container that grows with it).
  async function renderNewChat() {
    threadFixture = { threadId: "t1", messages: [] };
    const onThreadChange = vi.fn();
    renderWithClient(<Composer onThreadChange={onThreadChange} />);
    await screen.findByTestId("home-next");
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
    await settle();
    expect(onThreadChange).toHaveBeenLastCalledWith(false);
    return onThreadChange;
  }

  it("Stop before any word: the thread layout stays, with the creator's message", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    const onThreadChange = await renderNewChat();
    await sendAndStop("what time of day should I post on tiktok?");

    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    expect(bubble("what time of day should I post on tiktok?")).toBeInTheDocument();
    expect(screen.queryByTestId("home-next")).toBeNull();
  });

  it("a first run that fails: the thread layout stays, with the message and its Retry", async () => {
    streams["/api/tools/chat"] = () => refused();
    const onThreadChange = await renderNewChat();
    fireEvent.change(text(), { target: { value: "what time of day should I post on tiktok?" } });
    fireEvent.click(send());
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
    await settle();

    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    expect(bubble("what time of day should I post on tiktok?")).toBeInTheDocument();
  });
});

describe("Retry on a failed run sends the request the run sent", () => {
  it("hooks: the same ask, platform and intent", async () => {
    const id = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    audiencesFixture = {
      audiences: [
        { id, name: "@dij.arc", mode: "socials", is_general: false, is_preset: false, platform: "tiktok", goal_label: null, goal_intent: "sell", personas: [], source_account_id: "acct-1" },
      ],
      lastAudienceId: id,
    };
    streams["/api/tools/hooks"] = (signal, n) => (n === 1 ? refused() : sse(signal, [], true));
    await renderComposer();
    await waitFor(() => expect(requests("/api/audiences").length).toBeGreaterThan(0));
    await settle();

    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(2));
    const [first, again] = requests("/api/tools/hooks").map(bodyOf);
    expect(first).toEqual({ ask: "meal prep", platform: "tiktok", intent: "sell" });
    expect(again).toEqual(first);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });

  it("remix: the same link", async () => {
    streams["/api/tools/remix/run"] = (signal, n) => (n === 1 ? refused() : sse(signal, [], true));
    await renderComposer();
    fireEvent.click(pill("Remix"));
    fireEvent.change(text(), { target: { value: "https://www.tiktok.com/@a/video/123" } });
    fireEvent.click(send());
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(requests("/api/tools/remix/run")).toHaveLength(2));
    const [first, again] = requests("/api/tools/remix/run").map(bodyOf);
    expect(first!.url).toBe("https://www.tiktok.com/@a/video/123");
    expect(again).toEqual(first);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });

  it("chat: the same ask (Retry used to send nothing)", async () => {
    streams["/api/tools/chat"] = (signal, n) => (n === 1 ? refused() : sse(signal, [], true));
    await renderComposer();
    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    fireEvent.click(send());
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
    const [first, again] = requests("/api/tools/chat").map(bodyOf);
    expect(first!.ask).toBe("what should I post this week?");
    expect(again).toEqual(first);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });

  it("a run the chat dispatched: the chat again, not the skill's own route with an empty ask", async () => {
    streams["/api/tools/chat"] = (signal, n) =>
      n === 1 ? sse(signal, [["dispatch", { skill: "ideas" }], ["error", { message: "boom" }]], false) : sse(signal, [], true);
    await renderComposer();
    fireEvent.change(text(), { target: { value: "give me ideas for leg day" } });
    fireEvent.click(send());
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
    expect(requests("/api/tools/ideas")).toHaveLength(0);
    const [first, again] = requests("/api/tools/chat").map(bodyOf);
    expect(again).toEqual(first);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });
});
