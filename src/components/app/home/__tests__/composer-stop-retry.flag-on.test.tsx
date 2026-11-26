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
import { useBoardStore } from "@/stores/board-store";
import { forgetRunsEndedHere } from "@/lib/thread-next/runs-ended-here";
import { StrictMode } from "react";
import { ACCOUNT_READ_FULL, profileRead } from "@/components/thread-next/__tests__/fixtures/answers";

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
const evidenceInput = () => document.querySelector('input[type="file"][accept*=".txt"]') as HTMLInputElement;
const pill = (name: string) => {
  const found = inField()
    .getAllByRole("button", { name })
    .filter((b) => b.getAttribute("type") !== "submit");
  expect(found).toHaveLength(1);
  return found[0]!;
};
/** The creator's message in its bubble (a new chat's header also shows it, as the chat's name). */
const bubble = (t: string) => screen.getByText(t, { selector: "p" });
const threadText = () => screen.getByTestId("composer-thread-region").textContent ?? "";
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

describe("a stopped run gives the live turn up for good", () => {
  const STOPPED = "what should I post this week?";
  const WORDS = "Post the gym myth one";
  /** The ask the chat route stored before its answer was stopped, as the thread holds it. */
  const withStoppedAsk = (...more: ReturnType<typeof msg>[]) => ({
    ...historyThread(),
    messages: [...historyThread().messages, msg("u2", "user", STOPPED), ...more],
  });

  it("stopped after some words, then another run: once that run is in the thread, the stopped words do not come back under its ask, and the stopped ask shows once", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [["token", { delta: WORDS }]], true);
    streams["/api/tools/hooks"] = (signal) => {
      threadFixture = withStoppedAsk(msg("u3", "user", "meal prep"), msg("m3", "assistant", "Three hooks."));
      return sse(signal, [["stage", { name: "Ran your audience", status: "done" }], ["done", {}]], false, 30);
    };
    await renderComposer();
    fireEvent.change(text(), { target: { value: STOPPED } });
    fireEvent.click(send());
    // The words stream in word by word, so they are read off the thread's text.
    await waitFor(() => expect(threadText()).toContain(WORDS));
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    await settle();
    expect(bubble(STOPPED)).toBeInTheDocument();
    expect(threadText()).toContain(WORDS);

    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    expect(await screen.findByText("Three hooks.")).toBeInTheDocument();
    await settle();

    expect(screen.getAllByText("meal prep", { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText(STOPPED, { selector: "p" })).toHaveLength(1);
    expect(threadText()).not.toContain(WORDS);
  });

  it("a read of the thread that brings the stopped ask in (a profile read): the ask is drawn once", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    await renderComposer();
    await sendAndStop(STOPPED);
    expect(screen.getAllByText(STOPPED, { selector: "p" })).toHaveLength(1);

    // An evidence read: the route stores its card, the composer reads the thread again.
    threadFixture = withStoppedAsk(msg("m3", "assistant", "Read your chat."));
    fireEvent.change(evidenceInput(), { target: { files: [new File(["me: hi"], "chat.txt", { type: "text/plain" })] } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    expect(await screen.findByText("Read your chat.")).toBeInTheDocument();
    await settle();

    expect(screen.getAllByText(STOPPED, { selector: "p" })).toHaveLength(1);
  });

  it("…while a read that does not bring it in (the same words asked earlier) leaves the stopped turn on screen", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    await renderComposer();
    // The same words as the thread's earlier ask: that turn is not this one.
    fireEvent.change(text(), { target: { value: "first ask" } });
    fireEvent.click(send());
    fireEvent.click(await waitFor(() => inField().getByRole("button", { name: "Stop the run" })));
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    await settle();
    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(2);

    threadFixture = { ...historyThread(), messages: [...historyThread().messages, msg("m3", "assistant", "Read your chat.")] };
    fireEvent.change(evidenceInput(), { target: { files: [new File(["me: hi"], "chat.txt", { type: "text/plain" })] } });
    fireEvent.click(send());
    expect(await screen.findByText("Read your chat.")).toBeInTheDocument();
    await settle();

    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(2);
  });
});

describe("the account read has a message of its own: \"Read my account\"", () => {
  it("while it reads: its own message once, the thread's earlier ask once (not again over the read); Stop keeps the message", async () => {
    streams["/api/account-read"] = (signal) => sse(signal, [], true);
    await renderComposer();
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Read my account/ }));
    await waitFor(() => expect(send()).toHaveAttribute("aria-label", "Read my account"));
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/account-read")).toHaveLength(1));
    await waitFor(() => expect(threadText()).toContain("Reading your account"));

    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText("Read my account", { selector: "p" })).toHaveLength(1);
    // The route stores it with the read, once the read is in; the client stores nothing.
    expect(requests("/api/threads/user-turn")).toHaveLength(0);

    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    await settle();
    expect(threadText()).not.toContain("Reading your account");
    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText("Read my account", { selector: "p" })).toHaveLength(1);
    expect(screen.getByText("First answer.")).toBeInTheDocument();
  });
});

describe("a failed run refused again at once is the newest run, though its stream already held a failure", () => {
  it("hooks fails, script fails, hooks is sent again and refused at once: the Retry on screen is the hooks run's", async () => {
    streams["/api/tools/hooks"] = (_signal, n) => (n < 3 ? refused() : sse(_signal, [], true));
    streams["/api/tools/script"] = () => refused();
    await renderComposer();
    const sendWith = async (skill: string, ask: string, path: string, count: number) => {
      fireEvent.click(pill(skill));
      fireEvent.change(text(), { target: { value: ask } });
      fireEvent.click(send());
      await waitFor(() => expect(requests(path)).toHaveLength(count));
      expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
      await settle();
    };
    await sendWith("Hooks", "meal prep", "/api/tools/hooks", 1);
    await sendWith("Script", "desk stretches", "/api/tools/script", 1);
    await sendWith("Hooks", "meal prep again", "/api/tools/hooks", 2);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(3));
    expect(requests("/api/tools/script")).toHaveLength(1);
    expect(bodyOf(requests("/api/tools/hooks")[2]!).ask).toBe("meal prep again");
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });
});

describe("a failed run gives the live turn up once another run starts", () => {
  it("a failed hooks run, then a chat: once the chat is in the thread, the failed run's Retry does not come back under the chat's ask", async () => {
    streams["/api/tools/hooks"] = () => refused();
    streams["/api/tools/chat"] = (signal) => {
      threadFixture = {
        ...historyThread(),
        messages: [
          ...historyThread().messages,
          msg("u2", "user", "meal prep"),
          msg("u3", "user", "what should I post this week?"),
          msg("m3", "assistant", "Post the gym myth one."),
        ],
      };
      return sse(signal, [["token", { delta: "Post the gym myth one." }], ["done", {}]], false, 30);
    };
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();

    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(1));
    await settle();
    await settle();

    expect(screen.getAllByText("what should I post this week?", { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText("meal prep", { selector: "p" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the account read is stored in the chat, as a run's answer is", () => {
  /** What the route stores with `persist`: one assistant row, the run's header and the read. */
  /** What the route stores for a delivered read: its message, then the run's header and the read. */
  const storedRead = { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "run-header", props: { skill: "account" } }, ACCOUNT_READ_FULL], created_at: at };
  // Plus any message the client stored itself (`/api/threads/user-turn`), as the server would hold it.
  const withRead = (...more: ReturnType<typeof msg>[]) => ({
    ...historyThread(),
    messages: [
      ...historyThread().messages,
      ...requests("/api/threads/user-turn").map((c, i) => msg(`ut${i}`, "user", String(bodyOf(c).text))),
      msg("u2", "user", "Read my account"),
      storedRead,
      ...more,
    ],
  });
  /** The turn before it keeps its answer, and the read's message is drawn once. */
  const expectTurnsIntact = () => {
    expect(screen.getByText("First answer.")).toBeInTheDocument();
    expect(screen.getAllByText("Read my account", { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(1);
  };
  /** How many times the read is drawn (its follower count is on its card once). */
  const readsDrawn = () => threadText().split("12.4K followers").length - 1;
  const accountBodies = () => requests("/api/account-read").map(bodyOf);

  async function readFromField() {
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Read my account/ }));
    await waitFor(() => expect(send()).toHaveAttribute("aria-label", "Read my account"));
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/account-read")).toHaveLength(1));
  }

  it("a read from the field asks the route to store it, folds into the thread once in, and is there after a reload", async () => {
    streams["/api/account-read"] = (signal) => {
      threadFixture = withRead();
      return sse(signal, [["done", { block: ACCOUNT_READ_FULL }]], false, 30);
    };
    await renderComposer();
    await readFromField();
    expect(accountBodies()[0]).toEqual({ persist: true });
    const opens = requests("/api/threads/open").length;
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opens));
    await settle();
    expect(readsDrawn()).toBe(1);
    expectTurnsIntact();

    // A reload: the read comes back from the thread, under its own message.
    cleanup();
    await renderComposer();
    await settle();
    expect(readsDrawn()).toBe(1);
    expectTurnsIntact();
  });

  it("a chip under it: the read keeps its place above the chip's turn, drawn once", async () => {
    streams["/api/account-read"] = (signal) => {
      threadFixture = withRead();
      return sse(signal, [["done", { block: ACCOUNT_READ_FULL }]], false, 30);
    };
    streams["/api/tools/chat"] = (signal) => {
      const ask = String(bodyOf(requests("/api/tools/chat").at(-1)!).ask);
      threadFixture = withRead(msg("u3", "user", ask), msg("m3", "assistant", "Your hooks are the weakest part."));
      return sse(signal, [["token", { delta: "Your hooks are the weakest part." }], ["done", {}]], false, 30);
    };
    await renderComposer();
    await readFromField();
    await waitFor(() => expect(readsDrawn()).toBe(1));
    // Folded: the thread read again and the read in it. The chip is then the persisted turn's.
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(1));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /^Follow up: / }));
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    const ask = String(bodyOf(requests("/api/tools/chat")[0]!).ask);
    // The answer's turn is swapped for its stored copy at the fold, so it is read off the text.
    await waitFor(() => expect(threadText()).toContain("Your hooks are the weakest part."));
    await settle();
    await settle();

    expect(readsDrawn()).toBe(1);
    expect(screen.getAllByText(ask, { selector: "p" })).toHaveLength(1);
    expectTurnsIntact();
    // The read comes before the chip's ask, where it was.
    const all = threadText();
    expect(all.indexOf("12.4K followers")).toBeLessThan(all.indexOf(ask));
  });

  it("Retry on a failed read asks the route to store it too", async () => {
    streams["/api/account-read"] = (signal, n) => (n === 1 ? refused() : sse(signal, [], true));
    await renderComposer();
    await readFromField();
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));
    await waitFor(() => expect(requests("/api/account-read")).toHaveLength(2));
    expect(accountBodies()).toEqual([{ persist: true }, { persist: true }]);
    // Its message is the route's to store, with a delivered read: nothing from the client.
    expect(requests("/api/threads/user-turn")).toHaveLength(0);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });

  it("a scrape TikTok refused: the turn says so, and does not blame the handle", async () => {
    streams["/api/account-read"] = (signal) =>
      sse(signal, [["error", { message: "Couldn't read your account just now. Try again in a few minutes.", cause: "scrape_failed", retry: true }]], false);
    await renderComposer();
    await readFromField();
    expect(await screen.findByText("Couldn’t read your account just now.")).toBeInTheDocument();
    expect(screen.getByText(/TikTok didn’t let us load your posts this time/)).toBeInTheDocument();
    expect(threadText()).not.toMatch(/check the handle/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("leaving the chat while it reads lets the read run on (not aborted): nothing of it lands in the next chat", async () => {
    // As over a network: the body errors once its request is aborted; else the read lands after a beat.
    streams["/api/account-read"] = (signal) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener("abort", () => controller.error(new DOMException("The operation was aborted.", "AbortError")));
          setTimeout(() => {
            if (signal?.aborted) return;
            controller.enqueue(new TextEncoder().encode(`event: done\ndata: ${JSON.stringify({ block: ACCOUNT_READ_FULL })}\n\n`));
            controller.close();
          }, 150);
        },
      });
      return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
    };
    await renderComposer();
    await readFromField();
    await waitFor(() => expect(threadText()).toContain("Reading your account"));

    threadFixture = { threadId: "t2", messages: [msg("u9", "user", "another chat"), msg("m9", "assistant", "Another answer.")], simSeals: {} };
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("Another answer.")).toBeInTheDocument();
    expect(requests("/api/account-read")[0]!.init?.signal?.aborted).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(readsDrawn()).toBe(0);
    expect(screen.queryByText("Read my account", { selector: "p" })).toBeNull();
  });

  it("a failed read: its message and the error with Retry live; after a reload nothing of it (nothing was stored)", async () => {
    streams["/api/account-read"] = (signal) =>
      sse(signal, [["error", { message: "Couldn't read your account. Check your handle is public and try again." }]], false);
    await renderComposer();
    await readFromField();
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getAllByText("Read my account", { selector: "p" })).toHaveLength(1);
    expect(requests("/api/threads/user-turn")).toHaveLength(0);

    cleanup();
    await renderComposer();
    await settle();
    expect(screen.queryByText("Read my account", { selector: "p" })).toBeNull();
    expect(screen.getByText("First answer.")).toBeInTheDocument();
  });
});

describe("leaving a chat while a run streams: the run does not follow into the next chat", () => {
  /** A stream the test writes to; its body errors once its request is aborted, as over a network. */
  function writable() {
    let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
    let signal: AbortSignal | null | undefined;
    const respond = (sig: AbortSignal | null | undefined) => {
      signal = sig;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c;
          sig?.addEventListener("abort", () => c.error(new DOMException("The operation was aborted.", "AbortError")));
        },
      });
      return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
    };
    const push = async (event: string, data: unknown) => {
      // A request the switch aborted gets no more frames, as over a network.
      if (!signal?.aborted) ctrl?.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
    };
    return { respond, push, aborted: () => !!signal?.aborted };
  }
  const nextChat = () => ({ threadId: "t2", messages: [msg("u9", "user", "another chat"), msg("m9", "assistant", "Another answer.")], simSeals: {} });
  const switchAway = async () => {
    threadFixture = nextChat();
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("Another answer.")).toBeInTheDocument();
  };

  it("a hooks run: its request is NOT aborted (it runs on, to be stored), and its later cards and closing line are not in the next chat", async () => {
    const run = writable();
    streams["/api/tools/hooks"] = (signal) => run.respond(signal);
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await run.push("stage", { name: "Generating", status: "active" });

    await switchAway();
    expect(run.aborted()).toBe(false);
    await run.push("stage", { name: "Generating", status: "done" });
    await run.push("content", { blocks: [{ props: { hookLine: "Late hook from the old chat", rank: 1, scrollQuote: "x" } }] });
    await run.push("followup", { text: "Late closing line." });
    await settle();

    expect(threadText()).not.toContain("Late hook from the old chat");
    expect(threadText()).not.toContain("Late closing line.");
    expect(threadText()).not.toContain("meal prep");
    expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();
  });

  it("a chat run: its request is NOT aborted, and its later words are not in the next chat", async () => {
    const run = writable();
    streams["/api/tools/chat"] = (signal) => run.respond(signal);
    await renderComposer();
    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await run.push("token", { delta: "Post the " });

    await switchAway();
    expect(run.aborted()).toBe(false);
    await run.push("token", { delta: "gym myth one." });
    await run.push("done", {});
    await settle();

    expect(threadText()).not.toContain("gym myth");
    expect(threadText()).not.toContain("what should I post this week?");
    expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();
  });

  it("Stop still ends a run: the creator's own", async () => {
    const run = writable();
    streams["/api/tools/hooks"] = (signal) => run.respond(signal);
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    fireEvent.click(await waitFor(() => inField().getByRole("button", { name: "Stop the run" })));
    await settle();
    expect(run.aborted()).toBe(true);
  });

  it("the left run's late frames do not reach the next chat's own run either", async () => {
    // Leave mid-run, start a run in the next chat, then the left run's frames arrive.
    const left = writable();
    const next = writable();
    streams["/api/tools/hooks"] = (signal, n) => (n === 1 ? left.respond(signal) : next.respond(signal));
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await switchAway();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "gym myths" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(2));
    await next.push("stage", { name: "Generating", status: "active" });

    await left.push("stage", { name: "Generating", status: "done" });
    await left.push("content", { blocks: [{ props: { hookLine: "Late hook from the old chat", rank: 1, scrollQuote: "x" } }] });
    await left.push("done", {});
    await settle();

    expect(left.aborted()).toBe(false);
    expect(threadText()).not.toContain("Late hook from the old chat");
    // The next chat's own run is still running, untouched by the old one's end.
    expect(inField().getByRole("button", { name: "Stop the run" })).toBeInTheDocument();
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });
});


describe("the evidence read is its own turn in the chat", () => {
  it("after the read and after a reload: the previous turn keeps its answer, and the read's message is drawn once", async () => {
    // What the route stores for a delivered read: its message, then the card.
    const stored = () => ({
      ...historyThread(),
      messages: [
        ...historyThread().messages,
        msg("u2", "user", "Read this evidence"),
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [profileRead()], created_at: at },
      ],
    });
    await renderComposer();
    threadFixture = stored();
    fireEvent.change(evidenceInput(), { target: { files: [new File(["me: hi"], "chat.txt", { type: "text/plain" })] } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText("Read this evidence", { selector: "p" })).toHaveLength(1));
    await settle();
    expect(screen.getByText("First answer.")).toBeInTheDocument();
    expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(1);

    cleanup();
    await renderComposer();
    await settle();
    expect(screen.getByText("First answer.")).toBeInTheDocument();
    expect(screen.getAllByText("Read this evidence", { selector: "p" })).toHaveLength(1);
  });
});

describe("the chat list follows a chat left mid-run", () => {
  const lists = () => requests("/api/threads/list").length;

  it("is read again when the creator leaves the chat, and again when the left run's request ends", async () => {
    let end: () => void = () => {};
    streams["/api/tools/hooks"] = (signal) => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          end = () => c.close();
          signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
        },
      });
      return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
    };
    await renderComposer();
    await waitFor(() => expect(lists()).toBeGreaterThan(0));
    await settle();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await settle();
    const beforeLeaving = lists();

    threadFixture = { threadId: "t2", messages: [msg("u9", "user", "another chat"), msg("m9", "assistant", "Another answer.")], simSeals: {} };
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("Another answer.")).toBeInTheDocument();
    await waitFor(() => expect(lists()).toBeGreaterThan(beforeLeaving));
    await settle();
    const afterLeaving = lists();

    await act(async () => {
      end();
      await new Promise((r) => setTimeout(r, 30));
    });
    await waitFor(() => expect(lists()).toBeGreaterThan(afterLeaving));
  });
});

describe("a chat reopened while its run still goes on, on the server", () => {
  const ASK = "hooks about meal prep";
  const asked = (ago: number) => ({
    id: "u2",
    thread_id: "t1",
    role: "user" as const,
    blocks: [{ type: "markdown", props: { text: ASK } }],
    created_at: new Date(Date.now() - ago).toISOString(),
  });
  const waiting = () => threadText().includes("Thinking");

  it("shows the run's wait under the question, reads the chat again until the answer is in, then draws it once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(3_000)] };
      await renderComposer();
      await waitFor(() => expect(waiting()).toBe(true));
      expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
      const reads = requests("/api/threads/open").length;

      // Not stored yet at the next read: still waiting.
      await act(async () => {
        vi.advanceTimersByTime(3_100);
      });
      await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(reads));
      expect(waiting()).toBe(true);

      // The route stores the answer; the next read brings it in.
      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(9_000), msg("m2", "assistant", "Three hooks for busy students.")] };
      await act(async () => {
        vi.advanceTimersByTime(3_100);
      });
      await waitFor(() => expect(threadText()).toContain("Three hooks for busy students."));
      expect(waiting()).toBe(false);
      expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
      expect(screen.getAllByText("first ask", { selector: "p" })).toHaveLength(1);
      expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();

      // Once in, the chat is not read again.
      const after = requests("/api/threads/open").length;
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(requests("/api/threads/open").length).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });

  beforeEach(() => forgetRunsEndedHere());

  it("an old question with no answer shows no wait: the question alone, as before (the window is 2 min)", async () => {
    threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(2 * 60_000 + 5_000)] };
    await renderComposer();
    await settle();
    expect(waiting()).toBe(false);
    expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
    expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();
  });

  it("a wait whose answer never comes ends at its limit: the question alone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(110_000)] };
      await renderComposer();
      await waitFor(() => expect(waiting()).toBe(true));
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      await waitFor(() => expect(waiting()).toBe(false));
      expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
      expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never holds the field: a send ends the wait (the question back in history, once) and goes on", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(3_000)] };
    await renderComposer();
    await waitFor(() => expect(waiting()).toBe(true));
    expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull();
    expect(send()).toHaveAttribute("aria-label", "Send message");

    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await settle();
    expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
    expect(screen.getAllByText("and one more thing", { selector: "p" })).toHaveLength(1);
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
  });

  it("a run this tab stopped: back in its chat, no wait for it, and the field sends", async () => {
    streams["/api/tools/chat"] = (signal) => sse(signal, [], true);
    await renderComposer();
    await sendAndStop(ASK);

    threadFixture = { threadId: "t2", messages: [msg("u9", "user", "another chat"), msg("m9", "assistant", "Another answer.")], simSeals: {} };
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("Another answer.")).toBeInTheDocument();
    // Back: the route had stored the stopped ask, with no answer after it.
    threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(4_000)] };
    act(() => useBoardStore.getState().switchThread());
    expect(await screen.findByText("First answer.")).toBeInTheDocument();
    await settle();
    expect(waiting()).toBe(false);
    expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
    expect(send()).toHaveAttribute("aria-label", "Send message");
  });

  it("a read that answers with another chat is not put on screen: the wait goes on until its own chat answers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(3_000)] };
      await renderComposer();
      await waitFor(() => expect(waiting()).toBe(true));
      // The pointer moved meanwhile (another tab): the read names another chat.
      threadFixture = { threadId: "t2", messages: [msg("u9", "user", "another chat"), msg("m9", "assistant", "Another answer.")], simSeals: {} };
      const reads = requests("/api/threads/open").length;
      await act(async () => {
        vi.advanceTimersByTime(3_100);
      });
      await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(reads));
      await settle();
      expect(threadText()).not.toContain("Another answer.");
      expect(waiting()).toBe(true);

      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(9_000), msg("m2", "assistant", "Three hooks for busy students.")] };
      await act(async () => {
        vi.advanceTimersByTime(3_100);
      });
      await waitFor(() => expect(threadText()).toContain("Three hooks for busy students."));
      expect(waiting()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("under StrictMode, a wait that ends at its limit puts the question back once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      threadFixture = { ...historyThread(), messages: [...historyThread().messages, asked(110_000)] };
      renderWithClient(
        <StrictMode>
          <Composer />
        </StrictMode>,
      );
      await screen.findByTestId("next-field-dock");
      await waitFor(() => expect(waiting()).toBe(true));
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      await waitFor(() => expect(waiting()).toBe(false));
      expect(screen.getAllByText(ASK, { selector: "p" })).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

