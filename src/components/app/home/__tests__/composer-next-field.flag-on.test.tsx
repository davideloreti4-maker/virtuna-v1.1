/** @vitest-environment happy-dom */
/**
 * The composer under the new look (NEW_LOOK_ENABLED, with AMBIENT_V2 and CONCEPT_V8 on, as the
 * dev server runs): THE BOX renders the new field (`ThreadField`) and the composer's own state and
 * request paths drive it. Plan 2026-11-20 (thread field), Task 3.
 *
 * Everything here is the real composer and its real stream hooks. Stand-ins only for what cannot
 * run in a test: the network (`fetch`, answered with an SSE body that ends, or stays open for the
 * Stop case), the storage upload (the Supabase client), the OS file picker (a file input's
 * `click`), object URLs and media decoding (the video tile's frame), and ResizeObserver's
 * measurements. matchMedia is the setup's no-op shim, so this is the phone (<640, <1280).
 *
 * The open thread is one settled exchange by default (`historyThread`), so the field is the
 * thread's, docked under it. An empty chat is Home (Home plan 2026-11-23, Task 4; its own suite is
 * composer-home.flag-on.test.tsx): the tests here that start from an empty chat say so and drive
 * Home's field (`renderHome`).
 */
import type { ReactElement } from "react";
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

// The storage upload: the one Supabase call a video send makes before /api/analyze.
const upload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => upload(bucket, ...args),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));

import { Composer } from "../composer";
import { BILLABLE_BY_TOOL } from "../composer-controls";
import { creditCost } from "@/lib/pricing";
import { dropCardToRemixBlocks } from "@/lib/surfaces/drop-seed";
import { useBoardStore } from "@/stores/board-store";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { reactRequestBody } from "../v8/fire-sim";
import { MEAL_PREP_HOOKS, population } from "@/components/thread-next/__tests__/fixtures/answers";
import { useShellStore } from "@/stores/shell-store";
import { forgetRunVideos, runVideoOf } from "@/lib/result/run-video";
import { settleClock } from "@/components/thread-next/answer-sheet";

// ── the network ──────────────────────────────────────────────────────────────
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
/** Keep the hooks stream open until it is aborted (the Stop case). */
let holdHooksOpen = false;
let threadFixture: unknown = historyThread();
let audiencesFixture: unknown[] = [];
/** Streams the test writes itself (`holdStream`), by path; none set, every stream answers as before. */
let streamReplies: Record<string, (signal: AbortSignal | null | undefined) => Response> = {};

/** One settled turn of history: a question and a plain answer (the open thread by default). */
function historyThread() {
  const at = "2026-11-21T00:00:00.000Z";
  return {
    threadId: "t1",
    messages: [
      { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "first ask" } }], created_at: at },
      { id: "m1", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "First answer." } }], created_at: at },
    ],
    simSeals: {},
  };
}

/** An open thread with nothing in it yet: Home. */
const emptyChat = () => ({ threadId: "t1", messages: [] });

/** An SSE body: ends at once, or stays open until the request's signal aborts. */
function sse(signal: AbortSignal | null | undefined, hold: boolean): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!hold) {
        controller.close();
        return;
      }
      signal?.addEventListener("abort", () =>
        controller.error(new DOMException("The operation was aborted.", "AbortError")),
      );
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

function installFetch() {
  calls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const reply = Object.entries(streamReplies).find(([path]) => url.includes(path))?.[1];
    if (reply) return reply(init?.signal);
    if (url.includes("/api/tools/hooks")) return sse(init?.signal, holdHooksOpen);
    if (url.includes("/api/tools/chat") || url.includes("/api/analyze")) return sse(init?.signal, false);
    if (url.includes("/api/threads/open")) return json(threadFixture);
    if (url.includes("/api/threads/new")) return json({ threadId: "t-new" });
    if (url.includes("/api/audiences")) return json({ audiences: audiencesFixture });
    if (url.includes("/api/tracked-accounts")) return json({ accounts: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    if (url.includes("/api/surfaces/drops")) return json({ drops: [] });
    if (url.includes("/api/tools/react"))
      return json({
        fraction: "6/10 stop",
        personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `a${i}`, verdict: i < 6 ? "stop" : "scroll", quote: `v${i}` })),
        population: null,
      });
    return json({});
  }) as typeof fetch;
}

const requests = (path: string) => calls.filter((c) => c.url.includes(path));
const bodyOf = (c: Call) => JSON.parse(String(c.init?.body ?? "{}")) as Record<string, unknown>;

// ── the page ─────────────────────────────────────────────────────────────────
const field = () => screen.getByTestId("thread-field");
const inField = () => within(field());
const text = () => inField().getByRole("textbox") as HTMLTextAreaElement;
/** A pill by name, never the send button (whose name follows the selected skill). */
const pill = (name: string) => {
  const found = inField()
    .getAllByRole("button", { name })
    .filter((b) => b.getAttribute("type") !== "submit");
  expect(found).toHaveLength(1);
  return found[0]!;
};
const send = () => field().querySelector('button[type="submit"]') as HTMLButtonElement;
/** The block the composer measures for the bottom reserve: around the field's outer element. */
const fieldBlock = () => field().parentElement!.parentElement!;
const evidenceInput = () => document.querySelector('input[type="file"][accept*=".txt"]') as HTMLInputElement;
/** The seeded remix card's gauge slot: on screen once the reloaded thread has drawn. */
const remixSlot = () => screen.findByRole("button", { name: /^Simulate the hook: / });
const priceOf = (tool: keyof typeof BILLABLE_BY_TOOL) => creditCost(BILLABLE_BY_TOOL[tool]!);

/** The composer on the open thread, once its content has loaded: the field docked under it.
 *  (While the load is out the page is already the thread's: the loading outline, with the field
 *  docked under it. No pointer in the cookie opens a chat, Home plan 2026-11-23, Task 5.) */
async function renderComposer() {
  const result = renderWithClient(<Composer />);
  await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.queryByText("Opening thread…")).toBeNull());
  await screen.findByTestId("next-field-dock");
  return result;
}

/** The composer on an empty chat: Home, once the open thread's load has landed. */
async function renderHome(ui: ReactElement = <Composer />) {
  const result = renderWithClient(ui);
  await screen.findByTestId("home-next");
  await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByTestId("composer-shell")).toHaveAttribute("data-layout", "home");
  return result;
}

/** A thread carrying the remix stack the drop seed writes (the real producer, as composer-v8). */
function seededThread() {
  const drop = {
    contentId: "d1",
    hook: "Adapted drop hook",
    coverUrl: "https://x.supabase.co/storage/v1/object/public/covers/c.jpg",
    videoUrl: "https://tiktok.example/v/1",
    views: "8.1M",
    viewsRaw: 8_100_000,
    handle: "creator",
    archetype: null,
    hookTemplate: null,
    personas: Array.from({ length: 10 }, (_, i) => ({
      archetype: `a${i}`,
      verdict: i < 8 ? ("stop" as const) : ("scroll" as const),
      quote: `q${i}`,
    })),
    concepts: [
      {
        hook: "I sit 10 hours a day. Stretching didn't fix me — this did.",
        angle: "open-loop confession, then the mechanism",
        who_its_for: "desk workers with a stiff back",
        format_borrowed: "open-loop cold open",
        personaStops: 6,
        stopQuote: "ok that's me. fine.",
      },
    ],
  };
  return {
    threadId: "t1",
    messages: [
      {
        id: "m1",
        thread_id: "t1",
        role: "assistant" as const,
        blocks: dropCardToRemixBlocks(drop, "Your people"),
        created_at: "2026-08-09T00:00:00.000Z",
      },
    ],
    simSeals: {},
  };
}

const clip = () => new File(["video-bytes"], "take.mp4", { type: "video/mp4" });

/**
 * A row's gauge once it has its number. In a real thread it is the picture first and, once the
 * thread id and the text's key are known, a link to the result page (thread answers step 2); both
 * carry the number, so the tests that only care that it landed read it here.
 */
const simulatedGauge = (value: number) => document.querySelector(`[data-gauge="done"][data-value="${value}"]`);

beforeEach(() => {
  cleanup();
  holdHooksOpen = false;
  streamReplies = {};
  threadFixture = historyThread();
  audiencesFixture = [];
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  installFetch();
  // The tile reads a frame from the picked video: object URLs are a browser's.
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the composer renders the new field under the flag", () => {
  it("replaces the legacy box: no plate, no veil, no skill pill, no model selector, no armed tag", async () => {
    await renderComposer();
    expect(screen.queryByTestId("composer")).toBeNull(); // the legacy <form>
    expect(screen.queryByTestId("composer-backdrop")).toBeNull(); // the veil
    expect(screen.queryByTestId("composer-skill-pill")).toBeNull();
    expect(screen.queryByTestId("sim-model-selector")).toBeNull();
    expect(screen.queryByTestId("composer-armed-skill")).toBeNull();
    // Thread answers step 1 (Task 6): the room is gone, so the phone's room slot is not mounted.
    expect(screen.queryByTestId("audience-header-slot")).toBeNull();
    // At rest: chat, "Message Maven", today's field and send names.
    expect(text().placeholder).toBe("Message Maven");
    expect(text()).toHaveAttribute("aria-label", "Ask anything about your content");
    expect(send()).toHaveAttribute("aria-label", "Send message");
    expect(send()).toBeDisabled();
  });

  it("pill Hooks selects hooks, and the next send calls the hooks stream once with the typed topic", async () => {
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    expect(pill("Hooks")).toHaveAttribute("aria-pressed", "true");
    expect(text().placeholder).toBe("A topic for your hooks");
    expect(text()).toHaveAttribute("aria-label", "Hook topic (leave empty for Auto)");
    expect(send()).toHaveAttribute("aria-label", "Generate hooks");

    fireEvent.change(text(), { target: { value: "meal prep for busy students" } });
    fireEvent.click(send());

    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/hooks")[0]!).ask).toBe("meal prep for busy students");
    // The one-shot: the field is back to chat.
    await waitFor(() => expect(pill("Hooks")).toHaveAttribute("aria-pressed", "false"));
    expect(text().placeholder).toBe("Message Maven");
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });

  it("a second tap on a pill goes back to chat", async () => {
    await renderComposer();
    fireEvent.click(pill("Script"));
    expect(pill("Script")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pill("Script"));
    expect(pill("Script")).toHaveAttribute("aria-pressed", "false");
    expect(text().placeholder).toBe("Message Maven");
  });

  it("Simulate selects the video test (`test`): its placeholder, its price, and a link runs the video read", async () => {
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
    expect(text().placeholder).toBe("Add a video or paste a link");
    expect(text()).toHaveAttribute("aria-label", "Paste a TikTok link");
    // Fix round 1, ruling A: under the flag the send button says what it does with Simulate.
    expect(send()).toHaveAttribute("aria-label", "Send to simulate");
    expect(field().textContent).toContain(`· ${priceOf("test")}`);
    // Without a video or a link it cannot be sent.
    expect(send()).toBeDisabled();

    const link = "https://www.tiktok.com/@creator/video/7460113355847362834";
    fireEvent.change(text(), { target: { value: link } });
    expect(send()).not.toBeDisabled();
    fireEvent.click(send());

    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    expect(bodyOf(requests("/api/analyze")[0]!)).toMatchObject({ input_mode: "tiktok_url", tiktok_url: link });
    // Never the General `simulate` verb.
    expect(requests("/api/tools/simulate")).toHaveLength(0);
  });

  it("a picked video stages the file, selects Simulate, and its send reaches the existing upload path", async () => {
    await renderComposer();
    const take = clip();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [take] } });

    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(text().placeholder).toBe("Send to simulate this video");
    expect(send()).not.toBeDisabled();

    fireEvent.click(send());

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    const [bucket, path, uploaded] = upload.mock.calls[0]!;
    expect(bucket).toBe("videos");
    expect(String(path)).toMatch(/^u1\/.+\.mp4$/);
    expect(uploaded).toBe(take);
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    expect(bodyOf(requests("/api/analyze")[0]!)).toEqual({
      input_mode: "video_upload",
      content_type: "video",
      video_storage_path: path,
    });
  });

  it("the tile shows only while Simulate is selected (going back to chat does not drop it)", async () => {
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    fireEvent.click(pill("Simulate")); // back to chat
    expect(screen.queryByTestId("field-video")).toBeNull();
    fireEvent.click(pill("Simulate")); // the same file is still there
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(text().placeholder).toBe("Send to simulate this video");
  });

  it("after a FAILED run the video stays staged: the retry re-reads it", async () => {
    // /api/analyze refuses: the run fails, the failure turn offers Retry.
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/analyze")) {
        calls.push({ url: String(input), init });
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
    await renderComposer();
    const take = clip();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [take] } });
    fireEvent.click(send());
    await screen.findByText(/Couldn’t finish that read/);
    fireEvent.click(pill("Simulate"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(text().placeholder).toBe("Send to simulate this video");
    fireEvent.click(screen.getByRole("button", { name: "Retry the video test" }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload.mock.calls[1]![2]).toBe(take);
  });

  it('More\'s "Read a file" clicks the evidence input inside the tap', async () => {
    await renderComposer();
    const input = evidenceInput();
    expect(input).not.toBeNull(); // still mounted under the flag
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /read a file/i }));
    // Synchronously, in the same tap: no await between the click and the picker.
    expect(click).toHaveBeenCalledTimes(1);
    // It is not the General `profile` verb: nothing is selected, the field stays chat.
    expect(text().placeholder).toBe("Message Maven");
  });

  it("a staged evidence file shows as a chip, and send runs the profile read (the form path)", async () => {
    await renderComposer();
    const chat = new File(["me: hi\nthem: hello"], "chat.txt", { type: "text/plain" });
    fireEvent.change(evidenceInput(), { target: { files: [chat] } });

    expect(screen.getByTestId("field-evidence").textContent).toContain("chat.txt");
    expect(send()).toHaveAttribute("aria-label", "Read this evidence");
    expect(send()).not.toBeDisabled();

    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    const body = bodyOf(requests("/api/tools/profile")[0]!);
    expect(body.kind).toBe("file_text");
    expect((body.file as { name: string }).name).toBe("chat.txt");
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });

  it("a dropped non-video file goes to the evidence path (an unsupported one says so)", async () => {
    await renderComposer();
    const pdf = new File(["%PDF"], "deck.pdf", { type: "application/pdf" });
    fireEvent.drop(field(), { dataTransfer: { files: [pdf], types: ["Files"] } });
    expect(field().textContent).toContain("That file type isn't supported yet");

    const shot = new File(["png"], "shot.png", { type: "image/png" });
    fireEvent.drop(field(), { dataTransfer: { files: [shot], types: ["Files"] } });
    expect(screen.getByTestId("field-evidence").textContent).toContain("shot.png");
    expect(field().textContent).not.toContain("That file type isn't supported yet");
  });

  it("Enter with text and no evidence sends chat", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/chat")[0]!).ask).toBe("what should I post this week?");
    expect(requests("/api/tools/profile")).toHaveLength(0);
  });

  it("Stop sends one abort and no second run", async () => {
    holdHooksOpen = true;
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "gym myths" } });
    fireEvent.click(send());

    const stop = await waitFor(() => inField().getByRole("button", { name: "Stop the run" }));
    expect(requests("/api/tools/hooks")).toHaveLength(1);
    const signal = requests("/api/tools/hooks")[0]!.init?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    const submitted = vi.fn();
    field().addEventListener("submit", submitted);
    const notCancelled = fireEvent.click(stop);

    expect(notCancelled).toBe(false); // the click's default action was cancelled
    expect(signal.aborted).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    expect(requests("/api/tools/hooks")).toHaveLength(1);
  });

  it("a skill picked in More shows on the More button with its price", async () => {
    await renderComposer();
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Ideas/ }));
    const armed = await waitFor(() => pill("Ideas"));
    expect(armed).toHaveAttribute("aria-pressed", "true");
    expect(armed.textContent).toBe(`Ideas · ${priceOf("idea")}`);
    expect(send()).toHaveAttribute("aria-label", "Generate ideas");
    expect(text().placeholder).toBe("A topic for ideas");
  });

  it("Explore selected keeps its params popover reachable", async () => {
    await renderComposer();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Explore/ }));
    const search = await screen.findByRole("button", { name: "Search" });
    expect(pill("Explore")).toHaveAttribute("aria-pressed", "true");
    // Inside the measured block, so the thread's bottom reserve makes room for it.
    expect(fieldBlock().contains(search)).toBe(true);
  });

  it("`/` still opens the skill list, and picking one selects it", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "/hoo" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    // Portaled to the page (the dock cannot clip it), standing above the docked field.
    expect(menu.closest("[data-radix-popper-content-wrapper]")?.parentElement).toBe(document.body);
    expect(menu).toHaveAttribute("data-side", "top");
    expect(within(menu).getByRole("button", { name: "Hooks" })).toHaveAttribute("data-enter", "true");
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(pill("Hooks")).toHaveAttribute("aria-pressed", "true");
    expect(text().value).toBe("");
  });

  it("`/` and a tap on a row selects that skill, as Enter does", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "/" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    fireEvent.click(within(menu).getByRole("button", { name: "Script" }));
    expect(pill("Script")).toHaveAttribute("aria-pressed", "true");
    expect(text().value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Skills" })).toBeNull();
  });

  it("Escape is the composer's: it clears the `/` and the menu goes with it", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "/hoo" } });
    await screen.findByRole("dialog", { name: "Skills" });
    fireEvent.keyDown(text(), { key: "Escape" });
    expect(text().value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Skills" })).toBeNull();
    expect(pill("Hooks")).toHaveAttribute("aria-pressed", "false");
  });

  it("Enter takes the row the menu marks: `/sim` is Simulate, the video test", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "/sim" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    expect(within(menu).getByRole("button", { name: "Simulate" })).toHaveAttribute("data-enter", "true");
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
    expect(text().value).toBe("");
  });
});

describe("the phone's audience room under the flag", () => {
  // Thread answers step 1 (Task 6): the side panel and the phone's room are off under the flag.
  it("no room: no sheet, no rail, no docked presence, no room bar", async () => {
    threadFixture = seededThread();
    await renderComposer();
    await remixSlot();
    expect(screen.queryByTestId("ambient-overview-sheet")).toBeNull();
    expect(screen.queryByTestId("ambient-overview")).toBeNull();
    expect(screen.queryByTestId("audience-header-slot")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open your audience" })).toBeNull();
  });

  // Thread answers step 1: the room is gone under the flag (Task 4: no `openRoomForCard`), and the
  // remix is the new card (Task 5), which has no room door at all. Its slot simulates the hook
  // through the thread's one queue: one `react`, and nothing opens the room.
  it("the remix card's \"Simulate the hook\" fires `react` once and opens no room", async () => {
    threadFixture = seededThread();
    await renderComposer();
    fireEvent.click(await remixSlot());
    expect(screen.queryByText(/simulate with your audience/i)).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(requests("/api/tools/react")).toHaveLength(1);
    expect(bodyOf(requests("/api/tools/react")[0]!)).toEqual(
      reactRequestBody({ text: "I sit 10 hours a day. Stretching didn't fix me — this did.", kind: "remix" }),
    );
    expect(screen.queryByTestId("ambient-sheet-panel")).toBeNull();
  });
});

// Thread answers step 1 (Task 5): a reloaded thread renders through the new turn, and a hook pack's
// gauges spend through the composer's one queue (`TextSimProvider` over the thread), whose results
// merge into the seal map the thread reloads with.
describe("a reloaded hooks thread under the new turn", () => {
  const HOOKS = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);
  const ASK = "3 hooks for a video about meal prep for busy students";

  /** A reloaded hooks run: the question, the run stamp and three cards, then the closing line. */
  function hooksThread() {
    const at = "2026-11-21T00:00:00.000Z";
    return {
      threadId: "t1",
      messages: [
        { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: ASK } }], created_at: at },
        {
          id: "m1",
          thread_id: "t1",
          role: "assistant",
          blocks: [{ type: "run-header", props: { skill: "hooks", audienceLabel: "@nia.tests", platform: "tiktok", hookLine: null } }, ...MEAL_PREP_HOOKS],
          created_at: at,
        },
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "#1 is your strongest." } }], created_at: at },
      ],
      simSeals: {},
    };
  }

  /** `react` held until the test answers it, so "one at a time" can be seen. */
  function holdReact() {
    const held: { body: Record<string, unknown>; answer: (stopPct: number) => void }[] = [];
    const base = global.fetch;
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/api/tools/react")) return base(input, init);
      calls.push({ url: String(input), init });
      return new Promise<Response>((resolve) => {
        held.push({
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
          answer: (stopPct) => resolve(json({ fraction: "6/10 stop", scrollQuote: "", personas: [], population: population(stopPct), slice: null })),
        });
      });
    }) as typeof fetch;
    return held;
  }

  const gauge = (hook: string) => screen.getByRole("button", { name: new RegExp(`^Simulate: ${hook.slice(0, 24).replace(/[$.]/g, "\\$&")}`) });
  const settleQueue = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  it("one card, no intro, receipt or outro; each gauge tap runs one `react`, one at a time, and shows its number", async () => {
    const held = holdReact();
    threadFixture = hooksThread();
    await renderComposer();
    await screen.findByText(ASK, { selector: "p" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3));
    expect(document.querySelectorAll('[data-answer="card"]')).toHaveLength(1);
    for (const gone of [/Pulled hooks/, /Ran your audience/, /#1 is your strongest/, /Write a script from/]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByTestId("run-receipt")).toBeNull();

    fireEvent.click(gauge(HOOKS[0]!));
    fireEvent.click(gauge(HOOKS[1]!));
    await settleQueue();
    expect(requests("/api/tools/react")).toHaveLength(1);
    expect(held[0]!.body).toEqual(reactRequestBody({ text: HOOKS[0]!, kind: "hook" }));

    await act(async () => held[0]!.answer(30));
    await waitFor(() => expect(simulatedGauge(30)).not.toBeNull());
    await waitFor(() => expect(requests("/api/tools/react")).toHaveLength(2));
    expect(held[1]!.body).toEqual(reactRequestBody({ text: HOOKS[1]!, kind: "hook" }));

    await act(async () => held[1]!.answer(22));
    await waitFor(() => expect(simulatedGauge(22)).not.toBeNull());
    await settleQueue();
    expect(requests("/api/tools/react")).toHaveLength(2);
    // Two of three: no sentence yet, and the third row still offers its gauge.
    expect(screen.queryByText(/leads by|is ahead by|a tie/)).toBeNull();
    expect(gauge(HOOKS[2]!)).toBeEnabled();
  });
});

describe("the thread's bottom reserve under the flag", () => {
  it("is the field's measured height (plus the space under it, in CSS)", async () => {
    // ResizeObserver's measurement is the browser's; capture the callback and report a size.
    const observers: Array<{ cb: ResizeObserverCallback; targets: Element[] }> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets: Element[] = [];
        constructor(cb: ResizeObserverCallback) {
          observers.push({ cb, targets: this.targets });
        }
        observe(el: Element) {
          this.targets.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    threadFixture = seededThread();
    await renderComposer();
    await remixSlot();

    const region = screen.getByTestId("composer-thread-region");
    expect(region.className).toContain("pb-[calc(var(--field-reserve)+30px)]");
    expect(region.className).toContain("md:pb-[calc(var(--field-reserve)+24px)]");
    expect(region.className).not.toMatch(/pb-\[(184|240)px\]/);

    // The watched element: the block around the field's outer element (it also holds Explore's
    // control while Explore is selected — see the Explore test).
    const block = fieldBlock();
    const watcher = observers.find((o) => o.targets.includes(block));
    expect(watcher).toBeDefined();
    watcher!.cb(
      [{ target: block, borderBoxSize: [{ blockSize: 164, inlineSize: 361 }], contentRect: { height: 164 } } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await waitFor(() => expect(region.style.getPropertyValue("--field-reserve")).toBe("164px"));
  });
});

// ── Fix round 1 (review of Task 3) ───────────────────────────────────────────

/** A ResizeObserver whose measurement the test reports (the browser's job). */
function stubResizeObserver() {
  const observers: Array<{ cb: ResizeObserverCallback; targets: Element[]; disconnected: boolean }> = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      record: { cb: ResizeObserverCallback; targets: Element[]; disconnected: boolean };
      constructor(cb: ResizeObserverCallback) {
        this.record = { cb, targets: [], disconnected: false };
        observers.push(this.record);
      }
      observe(el: Element) {
        this.record.targets.push(el);
      }
      unobserve() {}
      disconnect() {
        this.record.disconnected = true;
      }
    },
  );
  /** The live observer watching the field's block, and a way to report a height for it. */
  const block = () => {
    const el = fieldBlock();
    const found = observers.filter((o) => o.targets.includes(el) && !o.disconnected);
    expect(found).toHaveLength(1);
    return found[0]!;
  };
  const report = (height: number) => {
    const el = fieldBlock();
    block().cb(
      [{ target: el, borderBoxSize: [{ blockSize: height, inlineSize: 361 }], contentRect: { height } } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  };
  return { observers, block, report };
}

describe("fix round 1: one attachment at a time", () => {
  it("evidence, then a video: the evidence is cleared and send simulates (the upload path)", async () => {
    await renderComposer();
    fireEvent.change(evidenceInput(), { target: { files: [new File(["png"], "shot.png", { type: "image/png" })] } });
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();

    const take = clip();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [take] } });
    expect(screen.queryByTestId("field-evidence")).toBeNull();
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(send()).toHaveAttribute("aria-label", "Send to simulate");

    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    expect(upload.mock.calls[0]![2]).toBe(take);
    expect(requests("/api/tools/profile")).toHaveLength(0);
  });

  it("a video, then evidence: the tile is gone and send runs the profile read", async () => {
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();

    fireEvent.change(evidenceInput(), { target: { files: [new File(["png"], "shot.png", { type: "image/png" })] } });
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();

    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    expect(upload).not.toHaveBeenCalled();
    expect(requests("/api/analyze")).toHaveLength(0);
    // The staged video itself is gone, not just hidden behind chat (fix round 3): selecting
    // Simulate again shows no tile, and Simulate cannot be sent without a video or a link.
    await waitFor(() => expect(screen.queryByTestId("field-evidence")).toBeNull());
    fireEvent.click(pill("Simulate"));
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(send()).toBeDisabled();
    fireEvent.click(send());
    expect(upload).not.toHaveBeenCalled();
  });

  it("a video and a screenshot dropped together: only the video is staged", async () => {
    await renderComposer();
    const shot = new File(["png"], "shot.png", { type: "image/png" });
    fireEvent.drop(field(), { dataTransfer: { files: [shot, clip()], types: ["Files"] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(screen.queryByTestId("field-evidence")).toBeNull();
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
  });

  it("a dropped screenshot clears a staged video", async () => {
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.drop(field(), { dataTransfer: { files: [new File(["png"], "shot.png", { type: "image/png" })], types: ["Files"] } });
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();
    // Gone, not hidden (fix round 3): remove the evidence, select Simulate, and there is no
    // video to tile or to send.
    fireEvent.click(inField().getByRole("button", { name: "Remove attachment" }));
    fireEvent.click(pill("Simulate"));
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(send()).toBeDisabled();
    fireEvent.click(send());
    expect(upload).not.toHaveBeenCalled();
    expect(requests("/api/analyze")).toHaveLength(0);
  });
});

describe("fix round 1: copy under the flag", () => {
  it("each skill's placeholder is the short one (rulings A and B)", async () => {
    await renderComposer();
    for (const [name, placeholder] of [
      ["Script", "What the script is about"],
      ["Remix", "Paste a TikTok link"],
      ["Hooks", "A topic for your hooks"],
    ] as const) {
      fireEvent.click(pill(name));
      expect(text().placeholder).toBe(placeholder);
      fireEvent.click(pill(name)); // back to chat
    }
    for (const [name, label, placeholder] of [
      [/^Ideas/, "Ideas", "A topic for ideas"],
      [/^Explore/, "Explore", "A niche to explore"],
      [/^Read my account/, "Account", "Read your account"],
    ] as const) {
      fireEvent.click(pill("More"));
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name }));
      await waitFor(() => expect(text().placeholder).toBe(placeholder));
      fireEvent.click(pill(label)); // the armed More button: back to chat
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    expect(text().placeholder).toBe("Message Maven");
  });

  it("no TikTok-link error while a video is staged", async () => {
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.change(text(), { target: { value: "my caption idea" } });
    expect(field().textContent).not.toContain("Maven reads TikTok videos");
    expect(text()).not.toHaveAttribute("aria-invalid");
    // Without the video the same text is still refused, as today.
    fireEvent.click(inField().getByRole("button", { name: "Remove video" }));
    expect(field().textContent).toContain("Maven reads TikTok videos");
    expect(text()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("fix round 1: the measured block", () => {
  it("the field growing keeps a pinned thread at its end", async () => {
    const ro = stubResizeObserver();
    threadFixture = seededThread();
    await renderComposer();
    await remixSlot();
    const region = screen.getByTestId("composer-thread-region");
    let scrollHeight = 2000;
    Object.defineProperty(region, "scrollHeight", { configurable: true, get: () => scrollHeight });
    Object.defineProperty(region, "clientHeight", { configurable: true, get: () => 800 });
    region.scrollTop = 1200; // at the end
    ro.report(96);
    scrollHeight = 2068; // the reserve grew by 68 (a video tile)
    ro.report(164);
    await waitFor(() => expect(region.style.getPropertyValue("--field-reserve")).toBe("164px"));
    expect(region.scrollTop).toBe(2068);
  });

  it("…and leaves a thread the creator scrolled up in alone", async () => {
    const ro = stubResizeObserver();
    threadFixture = seededThread();
    await renderComposer();
    await remixSlot();
    const region = screen.getByTestId("composer-thread-region");
    Object.defineProperty(region, "scrollHeight", { configurable: true, get: () => 2068 });
    Object.defineProperty(region, "clientHeight", { configurable: true, get: () => 800 });
    region.scrollTop = 200; // reading an earlier card
    // The scroll event the browser delivers for it (happy-dom sends none): the reserve follows the
    // autoscroll hook's pin, and the creator's own scroll is what releases it.
    fireEvent.scroll(region);
    ro.report(164);
    await waitFor(() => expect(region.style.getPropertyValue("--field-reserve")).toBe("164px"));
    expect(region.scrollTop).toBe(200);
  });

  it("the observer lives with the block: disconnected when it goes", async () => {
    const ro = stubResizeObserver();
    const { unmount } = await renderComposer();
    const watcher = ro.block();
    unmount();
    expect(watcher.disconnected).toBe(true);
  });
});

describe("fix round 1: More's audience row", () => {
  const AUDIENCE_ID = "3f2a7c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";
  it("opens the audience sheet, and a pick runs its path (persist + the thread pin)", async () => {
    audiencesFixture = [
      {
        id: AUDIENCE_ID,
        name: "Gym beginners",
        mode: "socials",
        is_general: false,
        is_preset: false,
        platform: "tiktok",
        goal_label: null,
        goal_intent: null,
        personas: [],
        source_account_id: "acct-1",
      },
    ];
    await renderComposer();
    await waitFor(() => expect(requests("/api/audiences").length).toBeGreaterThan(0));
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Audience: General" }));

    const audienceSheet = await screen.findByRole("dialog", { name: "Audience" });
    fireEvent.click(within(audienceSheet).getByRole("button", { name: "Gym beginners" }));

    await waitFor(() => expect(requests("/api/settings/last-audience")).toHaveLength(1));
    expect(bodyOf(requests("/api/settings/last-audience")[0]!)).toEqual({ audienceId: AUDIENCE_ID });
    await waitFor(() => expect(requests("/api/threads/t1").filter((c) => c.init?.method === "PATCH")).toHaveLength(1));
    // More names the new audience.
    fireEvent.click(pill("More"));
    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Audience: Gym beginners" })).toBeInTheDocument();
  });
});

describe("the audience sheet (Home plan, Task 1)", () => {
  const OWN_ID = "3f2a7c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";
  /** As `/api/audiences` answers: General and a preset first, then the creator's own. */
  const LIST = [
    { id: "general", name: "General", mode: "socials", is_general: true, is_preset: false, platform: "tiktok", personas: [] },
    { id: "preset-growth", name: "Growth Audience", mode: "socials", is_general: false, is_preset: true, platform: "tiktok", personas: [] },
    { id: OWN_ID, name: "Gym beginners", mode: "socials", is_general: false, is_preset: false, platform: "tiktok", personas: [], source_account_id: "acct-1" },
  ];

  async function openFromMore() {
    await renderComposer();
    await waitFor(() => expect(requests("/api/audiences").length).toBeGreaterThan(0));
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    fireEvent.click(within(more).getByRole("button", { name: "Audience: General" }));
    return screen.findByRole("dialog", { name: "Audience" });
  }

  it("lists the creator's own audience and General in use; a tap on the other persists it and closes the sheet", async () => {
    audiencesFixture = LIST;
    const sheet = await openFromMore();
    expect(within(sheet).getByRole("button", { name: "Gym beginners" })).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).getByRole("button", { name: "General" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).queryByRole("button", { name: "Growth Audience" })).toBeNull();

    fireEvent.click(within(sheet).getByRole("button", { name: "Gym beginners" }));

    await waitFor(() => expect(requests("/api/settings/last-audience")).toHaveLength(1));
    const put = requests("/api/settings/last-audience")[0]!;
    expect(put.init?.method).toBe("PUT");
    expect(bodyOf(put)).toEqual({ audienceId: OWN_ID });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Audience" })).toBeNull());
    // More's row is gone, so the sheet hands focus to the field's text, not to the page.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(document.activeElement).toBe(text());
  });
});

// ── Fix round 2 (rulings on round 1's concerns) ──────────────────────────────

describe("fix round 2", () => {
  it("staging evidence with Simulate selected returns to chat: no pill lit, send reads and runs the profile read only", async () => {
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(evidenceInput(), { target: { files: [new File(["png"], "shot.png", { type: "image/png" })] } });
    expect(field().querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
    expect(send()).toHaveAttribute("aria-label", "Read this evidence");
    expect(text().placeholder).toBe("Message Maven");

    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    expect(upload).not.toHaveBeenCalled();
    expect(requests("/api/analyze")).toHaveLength(0);
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });

  it("a dropped screenshot with Hooks selected also returns to chat", async () => {
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.drop(field(), { dataTransfer: { files: [new File(["png"], "shot.png", { type: "image/png" })], types: ["Files"] } });
    expect(field().querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
    expect(send()).toHaveAttribute("aria-label", "Read this evidence");
  });

  it("Read my account armed from More reads \"Account · 5\"; More's row keeps its full name", async () => {
    await renderComposer();
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: /^Read my account/ })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Read my account/ }));
    const armed = await waitFor(() => pill("Account"));
    expect(armed).toHaveAttribute("aria-pressed", "true");
    expect(armed.textContent).toBe(`Account · ${priceOf("account")}`);
    expect(send()).toHaveAttribute("aria-label", "Read my account");
  });
});

// ── Fix round 3 ──────────────────────────────────────────────────────────────

describe("fix round 3: selecting a skill clears staged evidence", () => {
  const stageShot = () =>
    fireEvent.change(evidenceInput(), { target: { files: [new File(["png"], "shot.png", { type: "image/png" })] } });

  it("evidence staged → tap Hooks: no evidence chip, send runs hooks, no profile request", async () => {
    await renderComposer();
    stageShot();
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();
    fireEvent.click(pill("Hooks"));
    expect(screen.queryByTestId("field-evidence")).toBeNull();
    expect(pill("Hooks")).toHaveAttribute("aria-pressed", "true");
    expect(send()).toHaveAttribute("aria-label", "Generate hooks");

    fireEvent.change(text(), { target: { value: "gym myths" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/hooks")[0]!).ask).toBe("gym myths");
    expect(requests("/api/tools/profile")).toHaveLength(0);
  });

  it("…the same for a skill picked in More, and for one picked with `/`", async () => {
    await renderComposer();
    stageShot();
    fireEvent.click(pill("More"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Ideas/ }));
    await waitFor(() => expect(screen.queryByTestId("field-evidence")).toBeNull());
    expect(send()).toHaveAttribute("aria-label", "Generate ideas");

    fireEvent.click(pill("Ideas")); // back to chat
    stageShot();
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();
    fireEvent.change(text(), { target: { value: "/scr" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    expect(within(menu).getByRole("button", { name: "Script" })).toHaveAttribute("data-enter", "true");
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(pill("Script")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("field-evidence")).toBeNull();
  });

  it("returning to chat keeps the evidence (only a skill clears it)", async () => {
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    stageShot(); // staging returns the field to chat (round 2) and keeps the file
    expect(screen.getByTestId("field-evidence")).toBeInTheDocument();
    expect(send()).toHaveAttribute("aria-label", "Read this evidence");
  });
});

// ── Task 4: the live Simulate turn's tile (plan 2026-11-20, thread field) ─────────────────────
describe("the live Simulate turn shows the staged video above the bubble", () => {
  it("while the run is live: the file's name in the bubble, its tile above it", async () => {
    // The live turn (testSubmitTurn) shows once the upload is through and the run is dispatched.
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());

    const bubble = await screen.findByText("take.mp4", { selector: "p" });
    const turn = bubble.parentElement as HTMLElement;
    expect(within(turn).getByRole("heading", { level: 2, name: "You", hidden: true })).toBeTruthy();
    const tile = within(turn).getByRole("img", { name: /^Video/ });
    expect(tile.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a link run has no file: no tile", async () => {
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(text(), { target: { value: "https://www.tiktok.com/@creator/video/7300000000000000000" } });
    fireEvent.click(send());
    await screen.findByText("https://www.tiktok.com/@creator/video/7300000000000000000", { selector: "p" });
    expect(screen.queryByRole("img", { name: /^Video/ })).toBeNull();
  });
});

// ── Thread answers step 1, Task 7: the running card survives the hand-off from the read to the card ──
describe("the running video card from the read to the card", () => {
  /** /api/analyze stays open and is fed by `push`; /api/tools/test/card never answers (still carding). */
  function holdAnalyze() {
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    const enc = new TextEncoder();
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/analyze")) {
        calls.push({ url, init });
        const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
        return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
      }
      if (url.includes("/api/tools/test/card")) {
        calls.push({ url, init });
        return new Promise<Response>(() => {});
      }
      return base(input, init);
    }) as typeof fetch;
    return {
      push(event: string, data: unknown) {
        controller!.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      },
      close() {
        controller!.close();
      },
    };
  }

  it("is one element from the run to the card request, and its clock counts from the send", async () => {
    const t0 = new Date("2026-11-22T10:00:00Z").getTime();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: t0 });
    try {
      const analyze = holdAnalyze();
      await renderComposer();
      fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
      fireEvent.click(send());
      await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
      act(() => analyze.push("started", { id: "a1" }));
      const running = await screen.findByText("of about a minute");
      const card = running.closest('[data-answer="card"]') as HTMLElement;
      expect(card).toBeTruthy();

      // 49 s into the read, it completes: the composer asks for the card (held open).
      await act(async () => {
        vi.setSystemTime(t0 + 49_000);
        analyze.push("complete", { overall_score: 50 });
        analyze.close();
      });
      await waitFor(() => expect(requests("/api/tools/test/card")).toHaveLength(1));
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });

      // The same card, never remounted, and its clock still counts from the send.
      expect(card.isConnected).toBe(true);
      expect(within(card).getByText("of about a minute")).toBeInTheDocument();
      expect(within(card).getByText(/^0:(49|5\d)$/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the first video of an empty chat is thread content from the send (the page takes the thread layout)", async () => {
    holdAnalyze();
    threadFixture = emptyChat(); // Home: its field's + and send
    const onThreadChange = vi.fn();
    await renderHome(<Composer onThreadChange={onThreadChange} />);
    expect(onThreadChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    await waitFor(() => expect(onThreadChange).toHaveBeenLastCalledWith(true));
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    expect(onThreadChange).toHaveBeenLastCalledWith(true);
  });

  it("an upload that fails before the run starts shows no turn: the error by the field, the clip still staged, not the thread layout", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    threadFixture = emptyChat(); // Home: its field's + and send
    const onThreadChange = vi.fn();
    await renderHome(<Composer onThreadChange={onThreadChange} />);
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("That upload didn't go through.");
    expect(requests("/api/analyze")).toHaveLength(0);
    expect(onThreadChange).toHaveBeenLastCalledWith(false);
  });
});

// ── Task 4, fix round 1 (2): the tile is the video THIS turn sent, never the one staged now ─────
describe("a failed Simulate turn keeps only its own video", () => {
  /** /api/analyze refuses: the run fails and the failure turn stays on screen. */
  function failAnalyze() {
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/analyze")) {
        calls.push({ url: String(input), init });
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
  }
  /** The turn whose bubble says `text` (its sr-only "You" heading's wrapper). */
  const turnOf = (text: string) => screen.getByText(text, { selector: "p" }).parentElement as HTMLElement;

  it("a failed link run, then a clip staged: the failed turn has no tile", async () => {
    failAnalyze();
    await renderComposer();
    const link = "https://www.tiktok.com/@creator/video/7300000000000000000";
    fireEvent.click(pill("Simulate"));
    fireEvent.change(text(), { target: { value: link } });
    fireEvent.click(send());
    await screen.findByText(/Couldn’t finish that read/);
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(within(turnOf(link)).queryByRole("img", { name: /^Video/ })).toBeNull();
  });

  it("a failed file run, then another clip staged: the failed turn shows no tile, not the new clip", async () => {
    failAnalyze();
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    await screen.findByText(/Couldn’t finish that read/);
    expect(within(turnOf("take.mp4")).getByRole("img", { name: /^Video/ })).toBeTruthy();
    fireEvent.change(inField().getByLabelText("Choose a video file"), {
      target: { files: [new File(["other-bytes"], "other.mp4", { type: "video/mp4" })] },
    });
    expect(within(turnOf("take.mp4")).queryByRole("img", { name: /^Video/ })).toBeNull();
  });
});

// ── Final review, fix wave (plan 2026-11-20, thread field) ────────────────────────────────────
/** /api/analyze answers a run that starts and completes (`run-1`, `run-2`, …); the seal then
 *  cards it in the thread. */
function succeedAnalyze() {
  const base = global.fetch;
  let n = 0;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/analyze")) {
      calls.push({ url: String(input), init });
      n += 1;
      const frames = `event: started\ndata: {"id":"run-${n}"}\n\nevent: complete\ndata: {}\n\n`;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(frames));
          c.close();
        },
      });
      return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
    }
    return base(input, init);
  }) as typeof fetch;
}

describe("final review: a finished video does not come back (1)", () => {
  /** A thread holding a script card: its "Add your take" hands the opener over as the brief. */
  function scriptThread() {
    return {
      threadId: "t1",
      messages: [
        {
          id: "m1",
          thread_id: "t1",
          role: "assistant" as const,
          blocks: [
            {
              type: "script-card",
              props: {
                openingBeatSeed: "I stopped editing my videos and my views tripled.",
                beats: [
                  {
                    label: "Hook",
                    content: "I stopped editing my videos and my views tripled.",
                    timing: "0–3s",
                    retentionMarker: "Outcome-first claim creates a how-gap.",
                    filming: "Close-up, handheld.",
                  },
                ],
                band: "Strong",
                fraction: "7/10 stop",
                scrollQuote: "Fast and to the point.",
                model: "sim1-flash",
              },
            },
          ],
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      simSeals: {},
    };
  }
  // The new script card (Task 5): "Add your take" is the handoff the legacy "Test full script" was.
  const takeTheBrief = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Add your take" }));
    expect(await screen.findByTestId("field-brief")).toHaveTextContent("I stopped editing my videos");
  };

  it("success: Simulate again shows no tile and no brief, send is off, and a pasted link simulates the link", async () => {
    succeedAnalyze();
    threadFixture = scriptThread();
    await renderComposer();
    await takeTheBrief();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    const reloadsBefore = requests("/api/threads/open").length;
    fireEvent.click(send());

    // The run completes and seals: the card POST, then the thread reload that shows the card.
    await waitFor(() => expect(requests("/api/tools/test/card")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/test/card")[0]!)).toEqual({ analysisId: "run-1" });
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(reloadsBefore));

    await waitFor(() => {
      if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
      expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByTestId("field-video")).toBeNull();
    });
    expect(screen.queryByTestId("field-brief")).toBeNull();
    expect(text().placeholder).toBe("Add a video or paste a link");
    expect(send()).toBeDisabled();

    const link = "https://www.tiktok.com/@creator/video/7460113355847362834";
    fireEvent.change(text(), { target: { value: link } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(2));
    expect(bodyOf(requests("/api/analyze")[1]!)).toMatchObject({ input_mode: "tiktok_url", tiktok_url: link });
    expect(upload).toHaveBeenCalledTimes(1); // the first run's only: nothing uploaded again
  });

  it("a thread switch drops the staged video and the brief", async () => {
    threadFixture = scriptThread();
    await renderComposer();
    await takeTheBrief();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();

    // Another thread with content, so the field stays the docked one (an empty chat is Home).
    threadFixture = { ...historyThread(), threadId: "t2" };
    act(() => useBoardStore.getState().switchThread());
    await waitFor(() => expect(pill("Simulate")).toHaveAttribute("aria-pressed", "false"));
    fireEvent.click(pill("Simulate"));
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(screen.queryByTestId("field-brief")).toBeNull();
    expect(send()).toBeDisabled();
  });
});

describe("final review: one run per send (2)", () => {
  afterEach(() => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  });

  it("two quick taps on send in a new chat: one new thread, one run", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    // A blank new chat, as the server answers the sentinel: Home, its field's send.
    threadFixture = { messages: [] };
    // The new thread's round trip is held open, so the second tap lands inside it.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/threads/new")) {
        calls.push({ url: String(input), init });
        await held;
        return json({ threadId: "t-new" });
      }
      return base(input, init);
    }) as typeof fetch;
    await renderHome();
    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    fireEvent.click(send());
    fireEvent.click(send());
    // Enter is the same submit: a third try inside the same round trip does nothing either.
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(send()).toBeDisabled();
    release();
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(requests("/api/threads/new")).toHaveLength(1);
    // Released once the run settled: the next message can be sent.
    fireEvent.change(text(), { target: { value: "and the week after?" } });
    await waitFor(() => expect(send()).not.toBeDisabled());
  });

  it("released on an early return: a send that runs nothing leaves send usable", async () => {
    // Simulate with text that is not a link and no video: canSubmit is false, nothing runs.
    // A link typed afterwards sends, so no latch was left behind.
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(text(), { target: { value: "not a link" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    fireEvent.change(text(), { target: { value: "https://www.tiktok.com/@creator/video/7460113355847362834" } });
    expect(send()).not.toBeDisabled();
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
  });
});

describe("final review: errors do not stick (4)", () => {
  it("an upload error goes when the text changes, and when the skill changes", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    const message = "That upload didn't go through. Check your connection and try again.";
    await waitFor(() => expect(field().textContent).toContain(message));
    fireEvent.change(text(), { target: { value: "x" } });
    expect(field().textContent).not.toContain(message);

    fireEvent.click(send()); // fails again, Simulate still selected (a bail keeps the arm)
    await waitFor(() => expect(field().textContent).toContain(message));
    fireEvent.click(pill("Hooks"));
    expect(field().textContent).not.toContain(message);
  });

  it("the evidence error is quiet (not the error colour) and goes when the text or the skill changes", async () => {
    await renderComposer();
    const pdf = () => new File(["%PDF"], "deck.pdf", { type: "application/pdf" });
    fireEvent.drop(field(), { dataTransfer: { files: [pdf()], types: ["Files"] } });
    const line = within(field()).getByText(/That file type isn't supported yet/);
    expect(line.className).not.toMatch(/\btext-error\b/);
    expect(line.className).toMatch(/\btext-foreground-secondary\b/);
    expect(line).toHaveAttribute("role", "alert");
    fireEvent.change(text(), { target: { value: "x" } });
    expect(field().textContent).not.toContain("That file type isn't supported yet");

    fireEvent.drop(field(), { dataTransfer: { files: [pdf()], types: ["Files"] } });
    expect(field().textContent).toContain("That file type isn't supported yet");
    fireEvent.click(pill("Script"));
    expect(field().textContent).not.toContain("That file type isn't supported yet");
  });

  it("the field's own refusal stays in the error colour", async () => {
    await renderComposer();
    fireEvent.change(inField().getByLabelText("Choose a video file"), {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    const line = within(field()).getByText("Please select a video file (MP4, MOV, WebM)");
    expect(line.className).toMatch(/\btext-error\b/);
  });
});

describe("final review: More → Audience hands focus to the audience sheet (5)", () => {
  it("focus lands inside the audience sheet, not on More behind it", async () => {
    audiencesFixture = [
      {
        id: "3f2a7c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b",
        name: "Gym beginners",
        mode: "socials",
        is_general: false,
        is_preset: false,
        platform: "tiktok",
        goal_label: null,
        goal_intent: null,
        personas: [],
        source_account_id: "acct-1",
      },
    ];
    await renderComposer();
    await waitFor(() => expect(requests("/api/audiences").length).toBeGreaterThan(0));
    const more = pill("More");
    more.focus();
    fireEvent.click(more);
    const sheet = await screen.findByRole("dialog", { name: "More" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Audience: / }));
    const audienceSheet = await screen.findByRole("dialog", { name: "Audience" });
    // Radix hands focus back on a timer once More's layer is gone.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    // The audience sheet took the focus itself (Radix: its first control), and More did not pull it back.
    expect(audienceSheet.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(pill("More"));
  });
});

describe("final review: Enter submits like the send button (7)", () => {
  it("evidence staged + text + Enter: the profile read, no chat", async () => {
    await renderComposer();
    fireEvent.change(evidenceInput(), { target: { files: [new File(["me: hi"], "chat.txt", { type: "text/plain" })] } });
    expect(send()).toHaveAttribute("aria-label", "Read this evidence");
    fireEvent.change(text(), { target: { value: "who is this person?" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(requests("/api/tools/profile")).toHaveLength(1));
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });

  it("Shift+Enter is still a new line, and Enter in the slash menu still picks the first match", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "first line" } });
    fireEvent.keyDown(text(), { key: "Enter", shiftKey: true });
    expect(requests("/api/tools/chat")).toHaveLength(0);
    fireEvent.change(text(), { target: { value: "/rem" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    expect(within(menu).getByRole("button", { name: "Remix" })).toHaveAttribute("data-enter", "true");
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(pill("Remix")).toHaveAttribute("aria-pressed", "true");
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });
});

describe("final review: the dock and the reserve agree (8)", () => {
  /** A bottom padding class's pixels: `pb-[30px]` → 30, `pb-6` → 24 (Tailwind's 4px step). */
  const pixels = (cls: string) => {
    const arbitrary = cls.match(/^pb-\[(\d+)px\]$/);
    if (arbitrary) return Number(arbitrary[1]);
    const step = cls.match(/^pb-(\d+)$/);
    return step ? Number(step[1]) * 4 : NaN;
  };
  const padding = (classes: string[], prefix: "" | "md:") =>
    classes.filter((c) => c.startsWith(`${prefix}pb-`) && (prefix || !c.includes(":"))).map((c) => c.slice(prefix.length));

  it("the space under the field is the space the thread reserve adds, on the phone and from md up", async () => {
    await renderComposer();
    const dock = screen.getByTestId("next-field-dock");
    expect(dock.contains(field())).toBe(true);
    const dockClasses = dock.className.split(/\s+/);
    const reserveClasses = screen.getByTestId("composer-thread-region").className.split(/\s+/);
    for (const prefix of ["", "md:"] as const) {
      const [under] = padding(dockClasses, prefix);
      const [reserve] = padding(reserveClasses, prefix);
      expect(under, `dock ${prefix}pb`).toBeDefined();
      const added = reserve?.match(/^pb-\[calc\(var\(--field-reserve\)\+(\d+)px\)\]$/);
      expect(added, `reserve ${prefix}pb`).not.toBeNull();
      expect(pixels(under!)).toBe(Number(added![1]));
    }
  });
});

describe("residual fix: a run's inputs are recorded where it is armed", () => {
  const link = "https://www.tiktok.com/@creator/video/7460113355847362834";
  /** Simulate selected, a clip picked and sent; resolves once its seal's card POST and reload ran. */
  async function sendClip(f: File, run: number) {
    if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [f] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    await waitFor(() => expect(send()).not.toBeDisabled());
    const reloads = requests("/api/threads/open").length;
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/test/card")).toHaveLength(run));
    expect(bodyOf(requests("/api/tools/test/card")[run - 1]!)).toEqual({ analysisId: `run-${run}` });
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(reloads));
  }
  /** Simulate again: no tile, and with no link send has nothing to run. */
  async function expectNoStagedClip() {
    await waitFor(() => {
      if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
      expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByTestId("field-video")).toBeNull();
    });
    expect(send()).toBeDisabled();
  }
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 100)); });

  it("the same file name twice: the second clip is gone after its success too, and a link then simulates the link", async () => {
    succeedAnalyze();
    // A thread whose reloads restore no user turn (a drop's seeded stack), so the turn text stays
    // the clip's name from the first run to the second, as this case needs.
    threadFixture = seededThread();
    await renderComposer();
    await sendClip(new File(["first-take"], "take.mp4", { type: "video/mp4" }), 1);
    await expectNoStagedClip();
    // Same name as the turn the first run echoed, so the turn text does not change.
    await sendClip(new File(["second-take"], "take.mp4", { type: "video/mp4" }), 2);
    await expectNoStagedClip();

    fireEvent.change(text(), { target: { value: link } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(3));
    expect(bodyOf(requests("/api/analyze")[2]!)).toMatchObject({ input_mode: "tiktok_url", tiktok_url: link });
    expect(upload).toHaveBeenCalledTimes(2); // one per clip: the second clip was not uploaded again
  });

  it("a reopened thread whose last turn is the clip's name: the clip is gone after its success", async () => {
    succeedAnalyze();
    threadFixture = {
      threadId: "t1",
      messages: [
        {
          id: "u1",
          thread_id: "t1",
          role: "user",
          blocks: [{ type: "markdown", props: { text: "take.mp4" } }],
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      simSeals: {},
    };
    await renderComposer();
    // The restored turn is on screen before the clip is staged.
    expect(await screen.findByText("take.mp4", { selector: "p" })).toBeInTheDocument();
    await sendClip(clip(), 1);
    await expectNoStagedClip();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  // Thread answers step 1 (Task 4): the ＋ door lived in the room, and a card's door was its only
  // way in from the thread. With the room off under the flag, that door cannot be reached, so the
  // case this pinned (a brought link run leaving the field's clip alone) cannot happen; what is
  // left to pin is that the way in is closed and the failed clip stays staged.
  it("the room's ＋ door is gone with the room: a card's door reaches no ＋ door, and the failed clip stays staged", async () => {
    // The first /api/analyze (the field's clip) is refused; every later one starts and completes.
    succeedAnalyze();
    const sealing = global.fetch;
    let refusedOnce = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/analyze") && !refusedOnce) {
        refusedOnce = true;
        calls.push({ url: String(input), init });
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      }
      return sealing(input, init);
    }) as typeof fetch;
    threadFixture = seededThread();
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    // The clip's own run fails: it stays staged for its retry (and its run's record stays too).
    fireEvent.click(send());
    await screen.findByText(/Couldn’t finish that read/);
    if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);

    // The room's ＋ was reached through a card's door, which opened the room. The remix is the new
    // card now (Task 5): no door; its slot simulates the hook (one `react`), and no room, ＋ door or
    // second read appears.
    expect(screen.queryByText(/simulate with your audience/i)).toBeNull();
    fireEvent.click(await remixSlot());
    await settle();
    expect(requests("/api/tools/react")).toHaveLength(1);
    expect(screen.queryByTestId("ambient-sheet-panel")).toBeNull();
    expect(screen.queryByTestId("ambient-sim-door")).toBeNull();
    expect(screen.queryByTestId("sim-door-host")).toBeNull();
    expect(requests("/api/analyze")).toHaveLength(1);
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("Enter while offline sends nothing (back online, the same Enter sends)", async () => {
    await renderComposer();
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    fireEvent.change(text(), { target: { value: "what should I post this week?" } });
    expect(send()).toBeDisabled(); // the send button's own check
    fireEvent.keyDown(text(), { key: "Enter" });
    await settle();
    expect(requests("/api/tools/chat")).toHaveLength(0);

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
  });

  it("Enter during another skill's stream sends nothing", async () => {
    // Explore's own "Run Explore" starts its stream (since the final fix round, B3, behind the
    // same send latch as the field's send, which holds until the stream ends); the stream stays
    // open until Stop.
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/tools/explore")) {
        calls.push({ url: String(input), init });
        return sse(init?.signal, true);
      }
      return base(input, init);
    }) as typeof fetch;
    await renderComposer();
    fireEvent.click(pill("More"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Explore/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Search" }));
    // The popover's own button, not the field's send (whose name is also "Run Explore").
    const runs = await screen.findAllByRole("button", { name: "Run Explore" });
    fireEvent.click(runs.find((b) => b !== send())!);
    const stop = await waitFor(() => inField().getByRole("button", { name: "Stop the run" }));
    expect(requests("/api/tools/explore")).toHaveLength(1);

    // Back to chat while Explore still streams, a message, Enter.
    fireEvent.click(pill("Explore"));
    await waitFor(() => expect(text().placeholder).toBe("Message Maven"));
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await settle();
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(requests("/api/tools/explore")).toHaveLength(1);

    fireEvent.click(stop);
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    // Stop ended the run, so the latch is released: the same Enter now sends, once.
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await settle();
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("Enter during a stream that does not hold the send latch (a failed turn's Retry) sends nothing", async () => {
    // The streaming check on the field's send, on its own: a run turn's Retry starts its stream
    // directly (`retryActiveRun`), outside the latch, so only `isAnyStreaming` stands between an
    // Enter and a second billed run. The first hooks run is refused (a 500), its Retry stays open.
    const base = global.fetch;
    let hookRuns = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/tools/hooks")) {
        calls.push({ url: String(input), init });
        hookRuns += 1;
        if (hookRuns === 1) return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
        return sse(init?.signal, true);
      }
      return base(input, init);
    }) as typeof fetch;
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    const retry = await screen.findByRole("button", { name: /retry/i });
    // The failed send has settled: the latch is off before the Retry.
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());

    fireEvent.click(retry);
    const stop = await waitFor(() => inField().getByRole("button", { name: "Stop the run" }));
    expect(requests("/api/tools/hooks")).toHaveLength(2);

    // While the Retry streams: a message, Enter. Nothing goes out.
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await settle();
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(requests("/api/tools/hooks")).toHaveLength(2);

    fireEvent.click(stop);
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
  });

  it("Enter without form.requestSubmit (Safari 15 and older) still submits the form", async () => {
    await renderComposer();
    const proto = HTMLFormElement.prototype as unknown as Record<string, unknown>;
    const own = Object.getOwnPropertyDescriptor(proto, "requestSubmit");
    Object.defineProperty(proto, "requestSubmit", { value: undefined, configurable: true, writable: true });
    try {
      expect((field() as HTMLFormElement).requestSubmit).toBeUndefined();
      fireEvent.change(text(), { target: { value: "what should I post this week?" } });
      fireEvent.keyDown(text(), { key: "Enter" });
      await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
      expect(bodyOf(requests("/api/tools/chat")[0]!).ask).toBe("what should I post this week?");
    } finally {
      if (own) Object.defineProperty(proto, "requestSubmit", own);
      else delete proto.requestSubmit;
    }
  });
});

describe("residual fix, round 2: the latch frees send when a run says done before its stream closes", () => {
  /** Hooks' stream sends `done` 150 ms in and then stays open (until aborted), as hooks, ideas
   *  and script can: `isStreaming` goes false on `done`, while `hooks.start` is still pending. */
  function hooksDoneThenHold() {
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/tools/hooks")) {
        calls.push({ url: String(input), init });
        const signal = init?.signal;
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            setTimeout(() => c.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`)), 150);
            signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
          },
        });
        return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
  }
  const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  /** A Hooks run whose `done` has landed (Stop gone), its stream still open; a chat line typed. */
  async function afterHooksDone() {
    hooksDoneThenHold();
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "gym myths" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await waitFor(() => inField().getByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    await wait(100);
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    await waitFor(() => expect(send()).not.toBeDisabled());
    expect(send()).toHaveAttribute("aria-label", "Send message");
  }

  it("a click on the enabled send sends the chat", async () => {
    await afterHooksDone();
    fireEvent.click(send());
    await wait(300);
    expect(requests("/api/tools/chat")).toHaveLength(1);
    expect(bodyOf(requests("/api/tools/chat")[0]!).ask).toBe("and one more thing");
  });

  it("Enter sends the chat too", async () => {
    await afterHooksDone();
    fireEvent.keyDown(text(), { key: "Enter" });
    await wait(300);
    expect(requests("/api/tools/chat")).toHaveLength(1);
    expect(bodyOf(requests("/api/tools/chat")[0]!).ask).toBe("and one more thing");
  });
});

describe("residual fix, round 2: a chat sent while a run seals does not become the run's record", () => {
  it("card POST held, clip B staged, a chat sent: the seal clears clip A only, clip B stays", async () => {
    succeedAnalyze();
    const base = global.fetch;
    let openGate: () => void = () => {};
    const gate = new Promise<void>((r) => {
      openGate = r;
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/tools/test/card")) {
        calls.push({ url: String(input), init });
        await gate;
        return json({});
      }
      return base(input, init);
    }) as typeof fetch;
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(inField().getByLabelText("Choose a video file"), {
      target: { files: [new File(["a"], "a.mp4", { type: "video/mp4" })] },
    });
    await waitFor(() => expect(send()).not.toBeDisabled());
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/test/card")).toHaveLength(1));

    // While the card POST is pending: clip B staged, back to chat, a chat line sent.
    if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
    fireEvent.change(inField().getByLabelText("Choose a video file"), {
      target: { files: [new File(["b"], "b.mp4", { type: "video/mp4" })] },
    });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    fireEvent.click(pill("Simulate"));
    await waitFor(() => expect(pill("Simulate")).toHaveAttribute("aria-pressed", "false"));
    fireEvent.change(text(), { target: { value: "quick question" } });
    await waitFor(() => expect(send()).not.toBeDisabled());
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // The card lands and the seal clears what its run sent (clip A, already replaced).
    const reloads = requests("/api/threads/open").length;
    await act(async () => {
      openGate();
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(requests("/api/threads/open").length).toBeGreaterThan(reloads);
    fireEvent.click(pill("Simulate"));
    await waitFor(() => expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
  });
});

// ── Thread answers step 1, Task 6: the frame around the thread ────────────────────────────────

/** A reloaded hooks thread whose run named its audience (`run-header.audienceLabel`). */
function mealPrepThread(audienceLabel: string | null = "@nia.tests", simSeals: Record<string, unknown> = {}) {
  const at = "2026-11-21T00:00:00.000Z";
  return {
    threadId: "t1",
    messages: [
      { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "3 hooks for a video about meal prep for busy students" } }], created_at: at },
      {
        id: "m1",
        thread_id: "t1",
        role: "assistant",
        blocks: [{ type: "run-header", props: { skill: "hooks", audienceLabel, platform: "tiktok", hookLine: null } }, ...MEAL_PREP_HOOKS],
        created_at: at,
      },
    ],
    simSeals,
  };
}

/** Answer one URL with a JSON body; everything else as before. */
function answer(path: string, body: unknown) {
  const base = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes(path)) {
      calls.push({ url: String(input), init });
      return json(body);
    }
    return base(input, init);
  }) as typeof fetch;
}

/** /api/analyze starts the run (`started`, its id) and stays open: a video run in flight. */
function holdAnalyzeStarted(id = "run-1") {
  const base = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).includes("/api/analyze")) return base(input, init);
    calls.push({ url: String(input), init });
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(`event: started\ndata: {"id":"${id}"}\n\n`));
        init?.signal?.addEventListener("abort", () => c.error(new DOMException("The operation was aborted.", "AbortError")));
      },
    });
    return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
  }) as typeof fetch;
}

const runDial = () => document.querySelector('[data-part="run-dial"]') as HTMLElement | null;
const pickAndSend = () => {
  fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
  fireEvent.click(send());
};
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("task 6: the live video turn", () => {
  it("one card from the upload to the run: its clock is not restarted, and 'Watch it run' opens the run once it has an id", async () => {
    let releaseUpload: () => void = () => {};
    upload.mockImplementation(() => new Promise((r) => (releaseUpload = () => r({ error: null }))));
    holdAnalyzeStarted("run-1");
    await renderComposer();
    pickAndSend();

    await waitFor(() => expect(runDial()).not.toBeNull());
    const dial = runDial()!;
    expect(dial).toHaveTextContent("uploading");
    expect(screen.queryByRole("link", { name: /Watch it run/ })).toBeNull();
    // Not the legacy wait: no spinner line, no "Testing your video", no checklist.
    expect(screen.queryByText(/Uploading your video/)).toBeNull();
    expect(screen.queryByText(/Testing your video/)).toBeNull();

    await act(async () => releaseUpload());
    await waitFor(() => expect(dial).toHaveTextContent("of about a minute"));
    expect(runDial()).toBe(dial); // the same element: mounted once
    expect(screen.getByRole("link", { name: /Watch it run/ })).toHaveAttribute("href", "/simulation/run-1");
  });

  it("in a thread with history, the live turn comes after the history, in the same column", async () => {
    holdAnalyzeStarted();
    threadFixture = historyThread();
    await renderComposer();
    const history = await screen.findByText("First answer.");
    pickAndSend();

    const bubble = await screen.findByText("take.mp4", { selector: "p" });
    await waitFor(() => expect(runDial()).not.toBeNull());
    expect(follows(history, bubble)).toBe(true);
    expect(follows(bubble, runDial()!)).toBe(true);
    const column = (el: Element) => el.closest('[class*="max-w-[720px]"]');
    expect(column(runDial()!)).toBe(column(history));
  });

  // Fix round 1: the running video is the thread's answer on its way, so no turn above it offers the
  // next-step chips (a chip would start a second run in the middle of this one).
  it("while the video runs, the answer above it shows no chips", async () => {
    holdAnalyzeStarted();
    threadFixture = mealPrepThread("@nia.tests");
    await renderComposer();
    expect(await screen.findByTestId("followup-row")).toBeInTheDocument();
    pickAndSend();
    await waitFor(() => expect(runDial()).not.toBeNull());
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("a failed run: its turn comes after the history, with today's copy and Retry", async () => {
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/analyze")) {
        calls.push({ url: String(input), init });
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
    threadFixture = historyThread();
    await renderComposer();
    const history = await screen.findByText("First answer.");
    pickAndSend();

    const headline = await screen.findByText(/Couldn’t finish that read/);
    expect(follows(history, headline)).toBe(true);
    expect(follows(screen.getByText("take.mp4", { selector: "p" }), headline)).toBe(true);
    expect(screen.getByRole("button", { name: /Retry the video test/ })).toBeInTheDocument();
  });
});

describe("task 6: the thread's header", () => {
  const listed = (title: string) => answer("/api/threads/list", { threads: [{ id: "t1", title, updated_at: "", created_at: "", pinned_at: null }] });

  it("desktop: the thread's title as the page heading, then 'For {audience}', above the scroll region", async () => {
    listed("Meal prep for busy students");
    threadFixture = mealPrepThread("@nia.tests");
    await renderComposer();
    const title = await screen.findByRole("heading", { level: 1, name: "Meal prep for busy students" });
    const row = title.parentElement as HTMLElement;
    expect(within(row).getByText("For @nia.tests")).toBeInTheDocument();
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(["hidden", "md:flex", "shrink-0"]));
    expect(row.parentElement).toBe(screen.getByTestId("composer-shell"));
    expect(follows(row, screen.getByTestId("composer-thread-region"))).toBe(true);
    // The generic sr-only "Conversation" heading is replaced, not doubled.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("publishes the audience for the phone's header, and withdraws it when the composer goes", async () => {
    threadFixture = mealPrepThread("@nia.tests");
    const { unmount } = renderWithClient(<Composer />);
    await waitFor(() => expect(useShellStore.getState().threadAudience).toBe("@nia.tests"));
    unmount();
    expect(useShellStore.getState().threadAudience).toBe("");
  });

  it("a run that named no audience (General): no line", async () => {
    listed("Meal prep for busy students");
    threadFixture = mealPrepThread("General");
    await renderComposer();
    await screen.findByRole("heading", { level: 1, name: "Meal prep for busy students" });
    expect(screen.queryByText(/^For /)).toBeNull();
    expect(useShellStore.getState().threadAudience).toBe("");
  });

  it("while a run is in flight, its audience wins over the thread's last one", async () => {
    const id = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    answer("/api/audiences", {
      audiences: [
        { id, name: "@dij.arc", mode: "socials", is_general: false, is_preset: false, platform: "tiktok", goal_label: null, goal_intent: null, personas: [], source_account_id: "acct-1" },
      ],
      lastAudienceId: id,
    });
    holdHooksOpen = true;
    threadFixture = mealPrepThread("@nia.tests");
    await renderComposer();
    expect(await screen.findByText("For @nia.tests")).toBeInTheDocument();
    await waitFor(() => expect(requests("/api/audiences").length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    fireEvent.click(pill("Hooks"));
    fireEvent.change(text(), { target: { value: "gym hooks" } });
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    expect(await screen.findByText("For @dij.arc")).toBeInTheDocument();
    expect(screen.queryByText("For @nia.tests")).toBeNull();
    expect(useShellStore.getState().threadAudience).toBe("@dij.arc");
  });
});

describe("task 6: a solid base under the field", () => {
  it("behind the field, the shell's full width, from the field's top edge to the bottom plus a 24px fade; the dock's padding is unchanged", async () => {
    threadFixture = seededThread();
    await renderComposer();
    await remixSlot();
    const dock = screen.getByTestId("next-field-dock");
    const base = dock.firstElementChild as HTMLElement;
    expect(base.getAttribute("aria-hidden")).toBe("true");
    expect(base.contains(field())).toBe(false);
    const classes = base.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "pointer-events-none",
        "absolute",
        "inset-x-0",
        "bottom-0",
        "bg-background",
        // Solid from 24px down, fading in over its top 24px (`.composer-veil`'s mask pattern).
        "[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_24px)]",
        "[mask-image:linear-gradient(to_bottom,transparent_0,black_24px)]",
      ]),
    );
    // Its height is the whole measured block plus the space under the field (the dock's own bottom
    // padding) plus the fade, on the phone and from md up: solid from the field's top edge.
    const dockClasses = dock.className.split(/\s+/);
    for (const prefix of ["", "md:"] as const) {
      const pb = dockClasses.find((c) => c.startsWith(`${prefix}pb-[`) && (prefix || !c.includes(":")))!;
      const under = Number(pb.match(/pb-\[(\d+)px\]$/)![1]);
      const h = classes.find((c) => c.startsWith(`${prefix}h-[`) && (prefix || !c.includes(":")))!;
      expect(h).toBe(`${prefix}h-[calc(var(--field-reserve)_+_${under + 24}px)]`);
    }
    // The dock reads the same measurement the thread reserve does.
    expect(dock.style.getPropertyValue("--field-reserve")).toBe(
      screen.getByTestId("composer-thread-region").style.getPropertyValue("--field-reserve"),
    );
    // The field's column paints above the base (positioned, later in the tree).
    expect((base.nextElementSibling as HTMLElement).className).toContain("relative");
  });
});

describe("task 6: nothing opens the room any more", () => {
  it("the funnel's return (?claimed=1) toasts and opens no room: Home stays", async () => {
    window.history.replaceState({}, "", "/home?claimed=1");
    try {
      // An empty chat holding only the funnel's sealed video: Home.
      threadFixture = {
        threadId: "t1",
        messages: [],
        simSeals: { "analysis-1": { sealed: true, at: "2026-07-27T00:00:00.000Z", video: { analysisId: "analysis-1", craftScore: 77 } } },
      };
      await renderHome();
      expect(await screen.findByText("Account linked")).toBeInTheDocument();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(screen.getByTestId("composer-shell")).toHaveAttribute("data-layout", "home");
      for (const name of ["Simulate", "Hooks", "Script", "Remix"]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
      expect(screen.queryByTestId("ambient-overview-sheet")).toBeNull();
    } finally {
      window.history.replaceState({}, "", "/home");
    }
  });

  it("a switch to another thread does not carry the old thread's numbers", async () => {
    const hook = MEAL_PREP_HOOKS[0]!.props.hookLine;
    threadFixture = mealPrepThread("@nia.tests", {
      [hook.trim()]: { fraction: "3/10 stop", scrollQuote: "", personas: [], population: population(30), at: "2026-11-21T00:00:00.000Z" },
    });
    await renderComposer();
    await waitFor(() => expect(simulatedGauge(30)).not.toBeNull());
    threadFixture = { ...mealPrepThread("@nia.tests"), threadId: "t2" };
    act(() => useBoardStore.getState().switchThread());
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3));
    expect(simulatedGauge(30)).toBeNull();
  });
});

describe("step 2: 'Script this one' from a result page lands in its thread", () => {
  const hook = MEAL_PREP_HOOKS[0]!.props.hookLine;
  const leave = (threadId: string, text: string, at = Date.now()) =>
    sessionStorage.setItem("maven:script-from", JSON.stringify({ threadId, text, at }));
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/home");
  });

  /** /api/threads/open waits until the test lets it answer; the chat stream stays open (the live turn,
   *  with its question, stays drawn). */
  function holdLoadAndChat(): () => void {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/threads/open")) {
        calls.push({ url, init });
        await held;
        return json(threadFixture);
      }
      if (url.includes("/api/tools/chat")) {
        calls.push({ url, init });
        return sse(init?.signal, true);
      }
      return base(input, init);
    }) as typeof fetch;
    return release;
  }

  it("runs one write-script turn with the text once its thread has loaded, and the hand-off is gone", async () => {
    const thread = mealPrepThread();
    threadFixture = thread;
    leave(thread.threadId, hook); // the open thread's id, as /api/threads/open answers it
    const release = holdLoadAndChat();
    // The load is held: until it lands the page is the loading outline, with the field docked.
    renderWithClient(<Composer />);
    await screen.findByTestId("thread-field");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    // Not before the thread is in: the turn must land after its history.
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(sessionStorage.getItem("maven:script-from")).not.toBeNull();
    await act(async () => release());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/chat")[0]!)).toMatchObject({
      ask: "Write the script from this hook.",
      skill: "script",
      anchor: hook,
    });
    expect(sessionStorage.getItem("maven:script-from")).toBeNull();
    // The script's turn sits after the thread's history.
    const historyRow = screen.getByText(hook);
    // The turn's bubble. (Not the header: a card's button never names a chat, it sits under a turn.)
    const ask = await screen.findByText("Write the script from this hook.", { selector: "p" });
    expect(historyRow.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Once: nothing more fires.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("a text left for another thread runs nothing here, and is gone", async () => {
    threadFixture = mealPrepThread();
    leave("00000000-0000-4000-8000-00000000dead", hook);
    await renderComposer();
    await screen.findAllByRole("button", { name: /^Simulate: / });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(sessionStorage.getItem("maven:script-from")).toBeNull();
  });

  it("a text left more than a minute ago runs nothing, and is gone", async () => {
    const thread = mealPrepThread();
    threadFixture = thread;
    leave(thread.threadId, hook, Date.now() - 61_000);
    await renderComposer();
    await screen.findAllByRole("button", { name: /^Simulate: / });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(sessionStorage.getItem("maven:script-from")).toBeNull();
  });

  it("an address can never start it: /home?scriptFrom= runs nothing", async () => {
    window.history.replaceState({}, "", `/home?scriptFrom=${encodeURIComponent(hook)}`);
    threadFixture = mealPrepThread();
    await renderComposer();
    await screen.findAllByRole("button", { name: /^Simulate: / });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });
});

describe("the run's page plays the creator's own clip", () => {
  const LINK = "https://www.tiktok.com/@nia.tests/video/7000000000000000001";
  beforeEach(() => {
    // Every object URL is its own, so the one handed over can be told from the field's tile's.
    let n = 0;
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:test/${++n}`);
  });
  afterEach(() => forgetRunVideos());

  it("a clip sent from the field: its file is handed to the run's page once the run has its id, and once only", async () => {
    let releaseUpload: () => void = () => {};
    upload.mockImplementation(() => new Promise((r) => (releaseUpload = () => r({ error: null }))));
    holdAnalyzeStarted("run-7");
    await renderComposer();
    const sent = clip();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [sent] } });
    fireEvent.click(send());

    // Uploading: the run has no id yet, so nothing is handed over.
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(runVideoOf("run-7")).toBeNull();

    await act(async () => releaseUpload());
    await waitFor(() => expect(runVideoOf("run-7")).not.toBeNull());
    const handed = runVideoOf("run-7")!;
    const created = vi.mocked(URL.createObjectURL);
    const at = created.mock.results.findIndex((r) => r.value === handed);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(created.mock.calls[at]![0]).toBe(sent);

    // Once: later renders hand nothing new over (a new address would replace this one and let it go).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(runVideoOf("run-7")).toBe(handed);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(handed);
  });

  it("a link run hands nothing over", async () => {
    holdAnalyzeStarted("run-8");
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(text(), { target: { value: LINK } });
    await waitFor(() => expect(send()).not.toBeDisabled());
    fireEvent.click(send());

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Watch it run/ })).toHaveAttribute("href", "/simulation/run-8"),
    );
    expect(runVideoOf("run-8")).toBeNull();
  });
});

// ── Thread feel, step 1 (Task 1): a sent turn sits at the top ────────────────────────────────────

/**
 * A stream (by path: "/api/tools/chat", "/api/tools/hooks") that stays open, so the run is still
 * on screen as the live turn: the test pushes its frames and ends it (`end`) when it means to.
 */
function holdStream(path: string) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const early: string[] = [];
  const settleFrames = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  streamReplies[path] = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        for (const frame of early.splice(0)) c.enqueue(encoder.encode(frame));
        signal?.addEventListener("abort", () =>
          c.error(new DOMException("The operation was aborted.", "AbortError")),
        );
      },
    });
    return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
  };
  return {
    push: async (event: string, data: unknown) => {
      const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      if (controller) controller.enqueue(encoder.encode(frame));
      else early.push(frame);
      await settleFrames();
    },
    end: async () => {
      controller?.close();
      await settleFrames();
    },
  };
}
const holdChat = () => holdStream("/api/tools/chat");

/** The creator's motion setting: reduced, so the moves land at once. Only the exact query matches. */
function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const region = () => screen.getByTestId("composer-thread-region");
const turnsIn = () => [...region().querySelectorAll<HTMLElement>("[data-turn]")];

/**
 * The thread's layout, by hand (happy-dom does none): the region is 800 tall at the viewport's
 * top, with no padding (no stylesheet here). Turn `i` (the `[data-turn]` elements, in order)
 * starts at `tops[i]` in the content and its content (its last child) ends at `ends[i]`. Every box
 * is read against the live scrollTop, as a browser's is. The arrays can be changed as the thread
 * grows.
 */
function layOut(geo: { tops: number[]; ends: number[]; scrollHeight: number }) {
  const el = region();
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => geo.scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 800 });
  const box = (top: number, bottom: number) =>
    ({ top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this === el) return box(0, 800);
    const turns = turnsIn();
    const i = turns.indexOf(this as HTMLElement);
    if (i >= 0) return box(geo.tops[i]! - el.scrollTop, geo.ends[i]! - el.scrollTop);
    const parent = this.parentElement ? turns.indexOf(this.parentElement) : -1;
    if (parent >= 0 && this.parentElement!.lastElementChild === this) {
      return box(geo.ends[parent]! - 40 - el.scrollTop, geo.ends[parent]! - el.scrollTop);
    }
    return original.call(this);
  });
  return el;
}

/** The thread's content grew: the autoscroll hook's observer (on the region's first child) fires. */
function grown(ro: ReturnType<typeof stubResizeObserver>) {
  const content = region().firstElementChild!;
  const found = ro.observers.filter((o) => o.targets.includes(content) && !o.disconnected);
  expect(found).toHaveLength(1);
  act(() => found[0]!.cb([], {} as ResizeObserver));
}

const askInField = (ask: string) => {
  fireEvent.change(text(), { target: { value: ask } });
  fireEvent.click(send());
};

describe("thread feel (Task 1): a sent turn sits at the top", () => {
  it("a send from the field takes the sent turn's top to 8 under the window's top, not to the end, and the answer then grows under it", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);
    expect(el.scrollTop).toBe(1400); // an opened chat: at its end, as today

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 3000;
    grown(ro);
    expect(el.scrollTop).toBe(1330 - 8);
    expect(el.scrollTop).not.toBe(geo.scrollHeight);

    // The answer streams under it: the view stays where the send put it.
    geo.ends[1] = 2600;
    geo.scrollHeight = 3800;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
  });

  it("the room: none on a chat only opened; the last turn's once a turn is sent; gone after a thread switch", async () => {
    holdChat();
    await renderComposer();
    expect(turnsIn()).toHaveLength(1);
    expect(region().querySelector("[data-room]")).toBeNull();

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    expect(turnsIn().map((t) => t.hasAttribute("data-room"))).toEqual([false, true]);

    threadFixture = { ...historyThread(), threadId: "t2" };
    act(() => useBoardStore.getState().switchThread());
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByText("First answer.")).toBeInTheDocument());
    await waitFor(() => expect(turnsIn()).toHaveLength(1));
    expect(region().querySelector("[data-room]")).toBeNull();
  });

  it("the room's trim: the phone's band, the 8 above the turn and the dock's own space under the field (30), and 8 + 24 from md", async () => {
    await renderComposer();
    const dock = screen.getByTestId("next-field-dock").className.split(/\s+/);
    const under = (prefix: "" | "md:") =>
      Number(dock.find((c) => c.startsWith(`${prefix}pb-[`) && (prefix || !c.includes(":")))!.match(/(\d+)px/)![1]);
    const classes = region().className.split(/\s+/);
    expect(classes).toContain(`[--thread-room-trim:calc(var(--nav-pt)+${8 + under("")}px)]`);
    expect(classes).toContain(`md:[--thread-room-trim:${8 + under("md:")}px]`);
  });

  /** Wait a few frames: long enough for a settle on the next frame to have run, if one was due. */
  const someFrames = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

  it("a skill's cards in (`isDone`): an end that landed 90 under the field is brought up 98, once", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const run = holdStream("/api/tools/hooks"); // held open after `done`: the run stays the live turn
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    fireEvent.click(pill("Hooks"));
    askInField("gym myths");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);

    // The cards land 90 under the visible end (800 tall, no padding without a stylesheet).
    const hook = (rank: number) => ({ props: { hookLine: `Gym myth number ${rank}`, rank, scrollQuote: "ok that is me" } });
    await run.push("content", { blocks: [hook(1), hook(2), hook(3)] });
    geo.ends[1] = 1322 + 800 + 90;
    grown(ro);
    await someFrames();
    expect(el.scrollTop).toBe(1322); // not before the run says it is done

    await run.push("done", {});
    await waitFor(() => expect(el.scrollTop).toBe(1322 + 98));

    // Once per answer: what comes after (the closing line, a re-render) does not move it again.
    geo.ends[1] += 90;
    await run.push("followup", { text: "Want a script for the first one?" });
    grown(ro);
    await someFrames();
    expect(el.scrollTop).toBe(1420);
  });

  it("Explore's own Run (its Search popover) is a send like every other: its turn is taken to the top, though the creator had scrolled up", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    holdStream("/api/tools/explore");
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);
    // Back up the thread, as after an earlier send's long answer: the pin is let go.
    el.scrollTop = 400;
    fireEvent.scroll(el);

    fireEvent.click(pill("More"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Explore/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Search" }));
    // The popover's own button, not the field's send (whose name is also "Run Explore").
    const runs = await screen.findAllByRole("button", { name: "Run Explore" });
    fireEvent.click(runs.find((b) => b !== send())!);
    await waitFor(() => expect(requests("/api/tools/explore")).toHaveLength(1));
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1330 - 8);
    expect(turnsIn()[1]!.hasAttribute("data-room")).toBe(true);
  });

  it("a run the chat dispatched: brought up when its cards are in, its stream still open; nothing more at the close", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const chat = holdChat(); // held open after the cards: billing and the closing line still to come
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    askInField("hooks about meal prep for busy students");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);

    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "done" });
    // The cards land 90 under the visible end.
    geo.ends[1] = 1322 + 800 + 90;
    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    grown(ro);
    await waitFor(() => expect(el.scrollTop).toBe(1322 + 98));

    // The closing line streams (not drawn under cards), then the stream closes: no second move.
    geo.ends[1] += 90;
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    await chat.push("done", {});
    await chat.end();
    grown(ro);
    await someFrames();
    expect(el.scrollTop).toBe(1420);
  });

  it("the fold: a run lands in the live turn, the thread is reloaded, and its persisted copy takes its place with the room, the view and the landing it had (the landing only inside its window)", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const chat = holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    const ask = "hooks about meal prep for busy students";
    askInField(ask);
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
    const live = turnsIn()[1]!;
    expect(live.dataset.send).toBe("1");
    expect(live.hasAttribute("data-room")).toBe(true);

    // The run waits, then its cards land in the live turn.
    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "active" });
    await chat.push("stage", { name: "Generating", status: "done" });
    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    await waitFor(() => expect(liveRows()).toHaveLength(3));
    expect(live.querySelector("[data-thread-landing]")).not.toBeNull();

    // The fold: the server holds the turn now; the stream closes and the thread is reloaded.
    threadFixture = {
      ...historyThread(),
      messages: [
        ...historyThread().messages,
        { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: ask } }], created_at: "2026-11-25T00:00:00.000Z" },
        {
          id: "m2",
          thread_id: "t1",
          role: "assistant",
          blocks: [{ type: "run-header", props: { skill: "hooks" } }, ...MEAL_PREP_HOOKS, { type: "markdown", props: { text: "Hook 1 is the one to film." } }],
          created_at: "2026-11-25T00:00:00.000Z",
        },
      ],
    };
    const opens = requests("/api/threads/open").length;
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opens));
    await waitFor(() => expect(live.isConnected).toBe(false));

    const turns = turnsIn();
    expect(turns).toHaveLength(2);
    const copy = turns[1]!;
    expect(copy.textContent).toContain(MEAL_PREP_HOOKS[0]!.props.hookLine);
    expect(copy.hasAttribute("data-room")).toBe(true);
    expect(region().querySelector("[data-send]")).toBeNull();
    grown(ro); // the layout pass after the reload: the view is not pinned, so it is not followed
    expect(el.scrollTop).toBe(1322);
    // Inside the window the copy carries the landing on; after it, it is no longer one.
    expect(copy.querySelector("[data-thread-landing]")).not.toBeNull();
    await waitFor(() => expect(copy.querySelector("[data-thread-landing]")).toBeNull(), { timeout: 3_000 });
    expect(copy.isConnected).toBe(true);
    expect(el.scrollTop).toBe(1322);
  });

  it("a plain chat answer whose stream ends 300 under the field is left where it is (the button's case)", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const chat = holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1322 + 800 + 300);
    geo.scrollHeight = 4000;
    grown(ro);
    await chat.push("token", { delta: "Post the gym myth one first." });
    await chat.end();
    await someFrames();
    expect(el.scrollTop).toBe(1322);
  });

  it("a plain chat answer: brought up when its stream ends (the chat's run carries no `isDone`)", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const chat = holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);

    await chat.push("token", { delta: "Post the gym myth one first." });
    geo.ends[1] = 1322 + 800 + 90;
    grown(ro);
    await someFrames();
    expect(el.scrollTop).toBe(1322); // still streaming: the view stays where the send put it

    // The server has the turn now: the fold after the stream reloads it into history, same place.
    threadFixture = {
      ...historyThread(),
      messages: [
        ...historyThread().messages,
        { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "what should I post next?" } }], created_at: "2026-11-25T00:00:00.000Z" },
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Post the gym myth one first." } }], created_at: "2026-11-25T00:00:00.000Z" },
      ],
    };
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(el.scrollTop).toBe(1322 + 98));
    await someFrames();
    expect(el.scrollTop).toBe(1420);
    expect(turnsIn()).toHaveLength(2); // folded into history, the last turn keeps the room
    expect(turnsIn()[1]!.hasAttribute("data-room")).toBe(true);
  });

  it("a field-height change after the anchor does not re-pin a short answer that fills the window: the view stays as the answer grows", async () => {
    // With a short answer the room fills the window, so the anchored view IS at the scroll's end.
    // Reading "within 120 of the end" there took it for a pinned thread and re-pinned it: the next
    // growth then followed the end again, and the question scrolled away. The field's reserve
    // follows the hook's pin instead.
    reduceMotion();
    const ro = stubResizeObserver();
    holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500); // a short answer: the room holds it
    geo.scrollHeight = 1330 - 8 + 800; // the room makes the anchored place the scroll's end
    grown(ro);
    expect(el.scrollTop).toBe(1322);
    expect(el.scrollHeight - el.clientHeight - el.scrollTop).toBe(0);

    // The field's block changes height (a tile staged, the draft's lines), then the answer grows.
    ro.report(140);
    await waitFor(() => expect(el.style.getPropertyValue("--field-reserve")).toBe("140px"));
    expect(el.scrollTop).toBe(1322);
    geo.ends[1] = 2600;
    geo.scrollHeight = 3000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
  });

  it("the same question sent a second time is taken to the top too (a new send, in the re-used live slot)", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const chat = holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
    await chat.push("token", { delta: "Post the gym myth one first." });
    await chat.end(); // no `done`: the live turn stays in its slot (no fold), as a stopped answer does

    // The creator scrolls back up to the first answer, then sends the SAME question again (a retry
    // after a stopped answer). The live slot is re-used; the send is still a new turn.
    el.scrollTop = 400;
    fireEvent.scroll(el);
    holdChat();
    askInField("what should I post next?");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
    await waitFor(() => expect(turnsIn()[1]!.dataset.send).toBe("2"));
    grown(ro);
    expect(el.scrollTop).toBe(1330 - 8);
  });

  it("a skill run with no question (Hooks with an empty field, Auto) is taken to the top, and so is the next one", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    const run = holdStream("/api/tools/hooks");
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);

    fireEvent.click(pill("Hooks"));
    fireEvent.click(send()); // nothing typed: Auto, no bubble
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    expect(turnsIn()[1]!.dataset.turn).toBe("answer");
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 4000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
    const hook = (rank: number) => ({ props: { hookLine: `Gym myth number ${rank}`, rank, scrollQuote: "ok that is me" } });
    await run.push("content", { blocks: [hook(1), hook(2), hook(3)] });
    // Stopped with its cards in: no `done`, so it never folds; its cards stay in the live slot.
    fireEvent.click(inField().getByRole("button", { name: "Stop the run" }));
    await waitFor(() => expect(inField().queryByRole("button", { name: "Stop the run" })).toBeNull());
    expect(turnsIn()).toHaveLength(2);

    el.scrollTop = 400;
    fireEvent.scroll(el);
    holdStream("/api/tools/hooks");
    await waitFor(() => expect(pill("Hooks")).toHaveAttribute("aria-pressed", "false"));
    fireEvent.click(pill("Hooks"));
    await waitFor(() => expect(send()).not.toBeDisabled());
    fireEvent.click(send());
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(2));
    await waitFor(() => expect(turnsIn()[1]!.dataset.send).toBe("2"));
    grown(ro);
    expect(el.scrollTop).toBe(1322);
  });

  it("the field's height read while pinned, with the anchor landing before React commits: the anchor holds, and the answer grows under it", async () => {
    // A real send clears the field (its block gets shorter) and mounts the turn in one frame: the
    // field's observer (still pinned) and the content's (the anchor) report in one batch, and React
    // commits after both. The reserve's follow must ask the hook again then, not trust its stale read.
    reduceMotion();
    const ro = stubResizeObserver();
    holdChat();
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro); // an opened chat at its end: pinned

    askInField("what should I post next?");
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 3000;
    const content = region().firstElementChild!;
    const contentObserver = ro.observers.find((o) => o.targets.includes(content) && !o.disconnected)!;
    act(() => {
      ro.report(88); // the field's block, shorter: read while still pinned
      contentObserver.cb([], {} as ResizeObserver); // the anchor, before React commits
    });
    await waitFor(() => expect(el.style.getPropertyValue("--field-reserve")).toBe("88px"));
    expect(el.scrollTop).toBe(1322);

    geo.ends[1] = 2600;
    geo.scrollHeight = 3800;
    grown(ro);
    expect(el.scrollTop).toBe(1322);
  });

  describe("a send arms where its run starts, so the answer still in the live slot is never taken for it", () => {
    const link = "https://www.tiktok.com/@creator_one/video/7300000000000000001";
    /** /api/analyze refuses: the link run fails and its failure turn (with Retry) is the tail. */
    function failVideoRead() {
      const base = global.fetch;
      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/analyze")) {
          calls.push({ url: String(input), init });
          return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
        }
        return base(input, init);
      }) as typeof fetch;
    }
    /** An opened chat, then a chat answer that ended without folding: it stays in the live slot. */
    async function answerInLiveSlot() {
      reduceMotion();
      const ro = stubResizeObserver();
      const chat = holdChat();
      failVideoRead();
      await renderComposer();
      const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
      const el = layOut(geo);
      grown(ro);
      askInField("what should I post next?");
      await waitFor(() => expect(turnsIn()).toHaveLength(2));
      geo.tops.push(1330);
      geo.ends.push(1500);
      geo.scrollHeight = 3000;
      grown(ro);
      expect(el.scrollTop).toBe(1322);
      await chat.push("token", { delta: "Post the gym myth one first." });
      await chat.end();
      const live = turnsIn()[1]!;
      expect(live.dataset.send).toBe("1");
      return { ro, el, geo, live };
    }
    /** A link sent to Simulate, refused: its turn is the tail, with its failure and a Retry. */
    async function failedVideoTurn() {
      fireEvent.click(pill("Simulate"));
      fireEvent.change(text(), { target: { value: link } });
      fireEvent.click(send());
      await screen.findByText(/Couldn’t finish that read/);
      await waitFor(() => expect(turnsIn()).toHaveLength(3));
    }

    it("a video sent with an answer still in the live slot: the video's turn (the tail) is taken to the top; the answer is not re-stamped or re-mounted", async () => {
      const { ro, el, geo, live } = await answerInLiveSlot();
      el.scrollTop = 400;
      fireEvent.scroll(el);
      await failedVideoTurn();
      expect(turnsIn()[1]).toBe(live);
      expect(live.dataset.send).toBe("1");
      expect(turnsIn()[2]!.dataset.send).toBe("2");
      geo.tops.push(1530);
      geo.ends.push(1700);
      geo.scrollHeight = 3200;
      grown(ro);
      expect(el.scrollTop).toBe(1530 - 8);
    });

    it("(a) a send that bails before it starts a run (Retry, with no clip and no link left): no new number, no turn re-mounted, the room as it was, the view at the end", async () => {
      const { ro, el, geo, live } = await answerInLiveSlot();
      await failedVideoTurn();
      geo.tops.push(1530);
      geo.ends.push(1700);
      geo.scrollHeight = 3200;
      grown(ro);
      const tailTurn = turnsIn()[2]!;
      const sendsBefore = turnsIn().map((t) => t.dataset.send ?? null);
      const roomBefore = turnsIn().map((t) => t.hasAttribute("data-room"));

      // The creator scrolls up, empties the field, and taps Retry: nothing to read, nothing runs.
      el.scrollTop = 400;
      fireEvent.scroll(el);
      fireEvent.change(text(), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: /^Retry/ }));
      expect(turnsIn()[1]).toBe(live); // the tap's own render
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(requests("/api/analyze")).toHaveLength(1);
      const after = turnsIn();
      expect(after[1]).toBe(live);
      expect(after[2]).toBe(tailTurn);
      expect(after.map((t) => t.dataset.send ?? null)).toEqual(sendsBefore);
      expect(after.map((t) => t.hasAttribute("data-room"))).toEqual(roomBefore);
      // At the end, as a send that bails always left it (happy-dom does not clamp: scrollHeight).
      expect(el.scrollTop).toBe(el.scrollHeight);
      grown(ro);
      expect(el.scrollTop).toBe(el.scrollHeight);
    });

    it("(b) the same start, then a send that starts a run: nothing is stamped before the run starts, and the turn taken to the top holds the NEW question", async () => {
      const { ro, el, live } = await answerInLiveSlot();
      el.scrollTop = 400;
      fireEvent.scroll(el);
      holdChat();
      askInField("and the week after?");
      // The tap's own render, before the run starts (after the chat's own await): the answer in the
      // live slot is untouched, and a frame now takes nothing to the top.
      expect(turnsIn()[1]).toBe(live);
      expect(live.dataset.send).toBe("1");
      grown(ro);
      expect(el.scrollTop).toBe(el.scrollHeight);

      await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
      await waitFor(() => expect(turnsIn()[1]!.dataset.send).toBe("2"));
      const sent = turnsIn()[1]!;
      expect(sent).not.toBe(live);
      expect(sent.textContent).toContain("and the week after?");
      expect(sent.textContent).not.toContain("Post the gym myth one first.");
      grown(ro);
      expect(el.scrollTop).toBe(1322);
    });
  });

  it("a video send whose upload is refused after its turn appeared: the turn goes, `anchored` is back to what it was (no room under the last turn), and the pin rule puts the view at the end", async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    let refuse!: () => void;
    upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          refuse = () => resolve({ error: { message: "refused" } });
        }),
    );
    await renderComposer();
    const geo = { tops: [22], ends: [1300], scrollHeight: 1400 };
    const el = layOut(geo);
    grown(ro);
    expect(region().querySelector("[data-room]")).toBeNull(); // a chat only opened: no room

    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    // The video's turn (the tail, "uploading") appears with the send, and is taken to the top.
    await waitFor(() => expect(turnsIn()).toHaveLength(2));
    expect(turnsIn()[1]!.hasAttribute("data-room")).toBe(true);
    geo.tops.push(1330);
    geo.ends.push(1500);
    geo.scrollHeight = 3000;
    grown(ro);
    expect(el.scrollTop).toBe(1322);

    // The upload is refused before the run starts: the error by the field, the turn gone.
    await act(async () => refuse());
    await waitFor(() => expect(turnsIn()).toHaveLength(1));
    expect(requests("/api/analyze")).toHaveLength(0);
    expect(region().querySelector("[data-room]")).toBeNull();
    geo.tops.pop();
    geo.ends.pop();
    geo.scrollHeight = 1400;
    grown(ro);
    expect(el.scrollTop).toBe(1400); // the end (happy-dom does not clamp: scrollHeight)
    // …and the end is followed again.
    geo.ends[0] = 1600;
    geo.scrollHeight = 1700;
    grown(ro);
    expect(el.scrollTop).toBe(1700);
  });

  it("(c) a new chat's first send is taken to the top and takes the room: the id it gets is its own, not a switch", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    try {
      reduceMotion();
      const ro = stubResizeObserver();
      holdChat();
      threadFixture = { messages: [] }; // a blank new chat, as the server answers the sentinel
      await renderHome();
      askInField("what should I post this week?");
      await waitFor(() => expect(requests("/api/threads/new")).toHaveLength(1));
      await waitFor(() => expect(turnsIn()).toHaveLength(1));
      expect(turnsIn()[0]!.hasAttribute("data-room")).toBe(true);

      const geo = { tops: [12], ends: [200], scrollHeight: 1000 };
      const el = layOut(geo);
      grown(ro);
      expect(el.scrollTop).toBe(12 - 8);
      expect(turnsIn()[0]!.hasAttribute("data-room")).toBe(true);
    } finally {
      document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
    }
  });

  it('"Go to the latest" shows while more than 150 of the answer is under the field, sits in the dock outside the measured field, and takes the thread to its end', async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    await renderComposer();
    const geo = { tops: [22], ends: [2000], scrollHeight: 2100 };
    const el = layOut(geo);
    grown(ro);
    expect(screen.queryByRole("button", { name: "Go to the latest" })).toBeNull();

    // The creator scrolls back up to read.
    el.scrollTop = 200;
    fireEvent.scroll(el);
    const jump = await screen.findByRole("button", { name: "Go to the latest" });
    expect(screen.getByTestId("next-field-dock").contains(jump)).toBe(true);
    expect(fieldBlock().contains(jump)).toBe(false);

    fireEvent.click(jump);
    expect(el.scrollTop).toBe(2100 - 800);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Go to the latest" })).toBeNull());

    // …and the end is followed again.
    geo.ends[0] = 2600;
    geo.scrollHeight = 2700;
    grown(ro);
    expect(el.scrollTop).toBe(2700);
  });

  it('"Go to the latest" from the keyboard: the button goes once the end is in view, and the focus is in the field\'s text, not on the page; a tap leaves the focus alone (no keyboard over the end on a phone)', async () => {
    reduceMotion();
    const ro = stubResizeObserver();
    await renderComposer();
    const geo = { tops: [22], ends: [2000], scrollHeight: 2100 };
    const el = layOut(geo);
    grown(ro);

    el.scrollTop = 200;
    fireEvent.scroll(el);
    const jump = await screen.findByRole("button", { name: "Go to the latest" });
    jump.focus();
    fireEvent.keyDown(jump, { key: "Enter" });
    fireEvent.click(jump);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Go to the latest" })).toBeNull());
    expect(document.activeElement).toBe(text());

    // A tap (a pointer): the view goes to the end, the focus is not moved into the field.
    text().blur();
    el.scrollTop = 200;
    fireEvent.scroll(el);
    const again = await screen.findByRole("button", { name: "Go to the latest" });
    fireEvent.pointerDown(again);
    fireEvent.click(again);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Go to the latest" })).toBeNull());
    expect(document.activeElement).not.toBe(text());
  });
});

// ── Thread feel, step 1 (Task 4): the field while a run finishes, the title, the script's message ──

const waitMs = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const stopButton = () => inField().queryByRole("button", { name: "Stop the run" });
/** The live pack's rows, once its cards are drawn. */
const liveRows = () => screen.getAllByRole("button", { name: /^Simulate: / });

describe("thread feel (Task 4): the field shows Stop only until the answer is in (spec §4.6)", () => {
  it("a chat-dispatched run: Stop while it works and bills; once its cards are in, the send arrow, off, and Enter sends nothing; at rest once the stream closes", async () => {
    const chat = holdChat();
    await renderComposer();
    askInField("hooks about meal prep for busy students");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "active" });
    expect(stopButton()).toBeEnabled();
    await chat.push("stage", { name: "Generating", status: "done" });
    await chat.push("stage", { name: "Ranking", status: "done" });
    // Every stage done, no card yet (the run bills before it writes them): still Stop.
    expect(stopButton()).toBeEnabled();

    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    await waitFor(() => expect(liveRows()).toHaveLength(3));
    expect(stopButton()).toBeNull();
    expect(send()).toHaveAttribute("aria-label", "Send message");
    expect(send()).toBeDisabled();
    // Enter still sends nothing while the stream is open.
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitMs(50);
    expect(requests("/api/tools/chat")).toHaveLength(1);
    // The closing line streams (this look does not draw it under cards): the arrow stays off.
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    expect(stopButton()).toBeNull();
    expect(send()).toBeDisabled();

    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(send()).not.toBeDisabled());
    expect(stopButton()).toBeNull();
    expect(send()).toHaveAttribute("aria-label", "Send message");
  });

  it("a stream that outlasts its cards by 8 s (a closing line that stalls): Stop again, and it ends the stream with the cards kept", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const chat = holdChat();
      await renderComposer();
      askInField("hooks about meal prep for busy students");
      await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
      await chat.push("dispatch", { skill: "hooks" });
      await chat.push("stage", { name: "Generating", status: "done" });
      for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
      await waitFor(() => expect(liveRows()).toHaveLength(3));
      expect(stopButton()).toBeNull();
      expect(send()).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(7_000);
      });
      expect(stopButton()).toBeNull(); // the usual close: a few seconds
      await act(async () => {
        vi.advanceTimersByTime(1_100);
      });
      expect(stopButton()).toBeEnabled();

      fireEvent.click(stopButton()!);
      await waitFor(() => expect(stopButton()).toBeNull());
      expect(liveRows()).toHaveLength(3);
      fireEvent.change(text(), { target: { value: "and one more thing" } });
      expect(send()).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a run a chip started, with Script picked while it runs: once its cards are in, the arrow is off until the stream closes", async () => {
    // A chip's run holds no send of the field's own, and Script's own stream is idle, so only the
    // run finishing keeps this send off.
    const chat = holdChat();
    threadFixture = mealPrepThread("@nia.tests");
    await renderComposer();
    fireEvent.click((await screen.findAllByRole("button", { name: /^Follow up: / }))[0]!);
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "done" });
    fireEvent.click(pill("Script"));
    expect(stopButton()).toBeEnabled();
    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    await waitFor(() => expect(stopButton()).toBeNull());
    expect(send()).toHaveAttribute("aria-label", "Generate script");
    expect(send()).toBeDisabled();
    fireEvent.click(send());
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitMs(50);
    expect(requests("/api/tools/script")).toHaveLength(0);

    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(send()).not.toBeDisabled());
    expect(send()).toHaveAttribute("aria-label", "Generate script");
  });

  it("a chat turn that dispatches a second run: Stop again from its dispatch, though the first run's cards stay", async () => {
    const chat = holdChat();
    await renderComposer();
    askInField("hooks about meal prep, then a script for the best one");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "done" });
    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    await waitFor(() => expect(stopButton()).toBeNull());

    // The second run clears the stages (a fresh dispatch); the turn waits for it, so Stop is back.
    await chat.push("dispatch", { skill: "script" });
    expect(stopButton()).toBeEnabled();
    await chat.push("stage", { name: "Generating", status: "active" });
    expect(stopButton()).toBeEnabled();
    await chat.end();
  });

  it("a skill's own run (Hooks): Stop until its cards are in, then the arrow, off, until the run says done", async () => {
    const run = holdStream("/api/tools/hooks");
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    askInField("gym myths");
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await run.push("stage", { name: "Generating", status: "active" });
    expect(stopButton()).toBeEnabled();
    await run.push("stage", { name: "Generating", status: "done" });
    await run.push("stage", { name: "Ranking", status: "active" });
    expect(stopButton()).toBeEnabled();
    await run.push("stage", { name: "Ranking", status: "done" });

    const hookBlock = (rank: number) => ({ props: { hookLine: `Gym myth number ${rank}`, rank, scrollQuote: "ok that is me" } });
    await run.push("content", { blocks: [hookBlock(1), hookBlock(2), hookBlock(3)] });
    await waitFor(() => expect(liveRows()).toHaveLength(3));
    // The route stores the cards, writes the title and bills before `done`: nothing to stop.
    expect(stopButton()).toBeNull();
    expect(send()).toBeDisabled();
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitMs(50);
    expect(requests("/api/tools/chat")).toHaveLength(0);

    await run.push("done", {});
    await waitFor(() => expect(send()).not.toBeDisabled());
    expect(stopButton()).toBeNull();
  });
});

describe("thread depth (Task 2): a follow-up tapped while the last answer's stream is still open waits for it", () => {
  const ASK = "hooks about meal prep for busy students";
  const [, HOOK_2] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);
  const chats = () => requests("/api/tools/chat");
  /** The thread as the server holds it once the hooks turn is stored: the pack under its own question. */
  const storedHooksTurn = () => ({
    ...historyThread(),
    messages: [
      ...historyThread().messages,
      { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: ASK } }], created_at: "2026-11-25T00:00:00.000Z" },
      {
        id: "m2",
        thread_id: "t1",
        role: "assistant",
        blocks: [{ type: "run-header", props: { skill: "hooks" } }, ...MEAL_PREP_HOOKS, { type: "markdown", props: { text: "Hook 1 is the one to film.", origin: "chat-agent" } }],
        created_at: "2026-11-25T00:00:00.000Z",
      },
    ],
  });
  /** A typed ask the chat dispatches to hooks: its cards land, its stream stays open (the closing words). */
  async function hooksLandedStreamOpen() {
    const chat = holdChat();
    await renderComposer();
    askInField(ASK);
    await waitFor(() => expect(chats()).toHaveLength(1));
    await chat.push("dispatch", { skill: "hooks" });
    await chat.push("stage", { name: "Generating", status: "done" });
    for (const block of MEAL_PREP_HOOKS) await chat.push("block", { block });
    await waitFor(() => expect(liveRows()).toHaveLength(3));
    expect(stopButton()).toBeNull(); // the field is finishing: the answer is in, the stream open
    return chat;
  }
  /** Row 2's sheet, and its "Script this one". */
  async function scriptRow2FromSheet() {
    fireEvent.click(screen.getByRole("button", { name: (name) => name.startsWith(`Open: ${HOOK_2!.slice(0, 30)}`) }));
    fireEvent.click(await screen.findByRole("button", { name: "Script this one, 2 credits" }));
  }
  /** The live turn: the one marked with a send. */
  const liveTurn = () => region().querySelector<HTMLElement>("[data-turn][data-send]");
  // A sheet takes no click in its first moment (a double-tap's second tap; its own test is
  // answer-sheet.test.tsx). Here its clock jumps a second at every read, so a click right after a
  // sheet opens counts.
  const realSettleNow = settleClock.now;
  beforeEach(() => {
    let tick = 0;
    settleClock.now = () => (tick += 1000);
  });
  afterEach(() => {
    settleClock.now = realSettleNow;
  });

  it("a script from a hook's sheet: nothing sent and the open stream left alone; Stop in the field, the pack under its own question; once the stream has closed and folded, one request with the hook as its anchor, in a new turn", async () => {
    const chat = await hooksLandedStreamOpen();
    await scriptRow2FromSheet();
    await waitMs(50);
    expect(chats()).toHaveLength(1);
    expect(chats()[0]!.init?.signal?.aborted).toBe(false);
    expect(stopButton()).toBeEnabled();
    const live = liveTurn()!;
    expect(live.textContent).toContain(ASK);
    expect(live.textContent).toContain(HOOK_2);
    expect(within(live).getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3);

    // The closing words, the end of the stream, the fold (the thread read again).
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(chats()).toHaveLength(2));
    expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script from this hook.", skill: "script", anchor: HOOK_2 });
    // Sent after the thread was read again (the fold), not before.
    const reload = requests("/api/threads/open")[opensBefore];
    expect(reload).toBeDefined();
    expect(calls.indexOf(chats()[1]!)).toBeGreaterThan(calls.indexOf(reload!));
    await waitMs(30);
    expect(chats()).toHaveLength(2);

    // The hooks turn, persisted, still holds its pack under its own question; the new turn is the script's ask.
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.hasAttribute("data-send")).toBe(false);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(turns[2]!.dataset.send).toBeDefined();
    expect(within(turns[2]!).getByText("Write the script from this hook.", { selector: "p" })).toBeInTheDocument();
    expect(turns[2]!.textContent).not.toContain(HOOK_2);
  });

  it("Stop while a follow-up is held: the stream stops as Stop does today, and no request follows", async () => {
    await hooksLandedStreamOpen();
    await scriptRow2FromSheet();
    await waitMs(30);
    expect(chats()).toHaveLength(1);
    fireEvent.click(stopButton()!);
    await waitFor(() => expect(chats()[0]!.init?.signal?.aborted).toBe(true));
    await waitMs(100);
    expect(chats()).toHaveLength(1);
    expect(stopButton()).toBeNull();
  });

  it("a stream that has not closed 8,000 ms after the tap: the held follow-up goes anyway (today's behaviour for a stream that hangs)", async () => {
    await hooksLandedStreamOpen();
    // Fake timers from the tap on (the hold's timer is set by it), with the clock still moving so
    // the stream's own frames and the waits keep working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await scriptRow2FromSheet();
      await act(async () => {
        vi.advanceTimersByTime(7_000);
      });
      expect(chats()).toHaveLength(1);
      expect(stopButton()).toBeEnabled();
      await act(async () => {
        vi.advanceTimersByTime(1_100);
      });
      await waitFor(() => expect(chats()).toHaveLength(2));
      expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script from this hook.", anchor: HOOK_2 });
      expect(chats()[0]!.init?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a chip under the landed answer goes through the same hold, and the last follow-up tapped is the one sent", async () => {
    const chat = await hooksLandedStreamOpen();
    await scriptRow2FromSheet();
    // The chips are on screen in that window (the answer is in): a chip after the sheet's script,
    // the rewrite one, which carries the pack's lines.
    fireEvent.click(await screen.findByRole("button", { name: "Follow up: Punch them up" }));
    await waitMs(50);
    expect(chats()).toHaveLength(1);
    expect(chats()[0]!.init?.signal?.aborted).toBe(false);

    threadFixture = storedHooksTurn();
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(chats()).toHaveLength(2));
    await waitMs(30);
    expect(chats()).toHaveLength(2);
    // The chip's own send, as it would have gone at the tap: its prompt, its skill, the pack's lines.
    const sent = bodyOf(chats()[1]!);
    expect(sent).toMatchObject({ ask: "Rewrite these hooks tighter and more specific.", skill: "hooks" });
    expect(sent.anchor).toBeUndefined();
    expect(sent.cards).toEqual(MEAL_PREP_HOOKS.map((b) => b.props.hookLine));
  });

  it("a tap in the fold's moment (the stream closed, the thread still being read): held too, Enter sends nothing meanwhile, and it goes once the read is in, the pack kept on screen", async () => {
    const chat = await hooksLandedStreamOpen();
    // The fold's read of the thread is held open from here.
    let releaseRead: () => void = () => {};
    let holdReads = false;
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (holdReads && String(input).includes("/api/threads/open")) {
        calls.push({ url: String(input), init });
        await new Promise<void>((r) => (releaseRead = r));
        return json(threadFixture);
      }
      return base(input, init);
    }) as typeof fetch;
    holdReads = true;
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opensBefore));

    // The stream has closed (the field is no longer finishing); the fold is reading the thread.
    await scriptRow2FromSheet();
    await waitMs(50);
    expect(chats()).toHaveLength(1);
    expect(stopButton()).toBeEnabled();
    const live = liveTurn()!;
    expect(live.textContent).toContain(ASK);
    expect(within(live).getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3);
    // Enter in the field meanwhile sends nothing, and the held one stays held.
    fireEvent.change(text(), { target: { value: "and one more thing" } });
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitMs(50);
    expect(chats()).toHaveLength(1);

    await act(async () => releaseRead());
    await waitFor(() => expect(chats()).toHaveLength(2));
    expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script from this hook.", skill: "script", anchor: HOOK_2 });
    expect(calls.indexOf(chats()[1]!)).toBeGreaterThan(calls.indexOf(requests("/api/threads/open")[opensBefore]!));
    await waitMs(50);
    expect(chats()).toHaveLength(2);
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(within(turns[2]!).getByText("Write the script from this hook.", { selector: "p" })).toBeInTheDocument();
  });

  it("the hold's 8,000 ms timer is cleared when a normal fold sends the follow-up: past 8,000 ms, no second request", async () => {
    const chat = await hooksLandedStreamOpen();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The fake timers, watched by hand: 8,000 ms timers set, and every id cleared. Not `vi.spyOn`:
    // the suite's `restoreAllMocks` would put the fake timers back after the real ones return.
    const fakeSet = globalThis.setTimeout;
    const fakeClear = globalThis.clearTimeout;
    const eightSecondTimers: unknown[] = [];
    const cleared: unknown[] = [];
    globalThis.setTimeout = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
      const id = fakeSet(handler, ms, ...rest);
      if (ms === 8_000) eightSecondTimers.push(id);
      return id;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id?: Parameters<typeof clearTimeout>[0]) => {
      cleared.push(id);
      fakeClear(id);
    }) as typeof clearTimeout;
    try {
      await scriptRow2FromSheet();
      // The hold's own timer: the one 8,000 ms timer the tap set.
      expect(eightSecondTimers).toHaveLength(1);
      const holdTimer = eightSecondTimers[0];

      threadFixture = storedHooksTurn();
      await chat.push("done", {});
      await chat.end();
      await waitFor(() => expect(chats()).toHaveLength(2));
      expect(cleared).toContain(holdTimer);
      await act(async () => {
        vi.advanceTimersByTime(8_500);
      });
      await waitMs(30);
      expect(chats()).toHaveLength(2);
    } finally {
      globalThis.setTimeout = fakeSet;
      globalThis.clearTimeout = fakeClear;
      vi.useRealTimers();
    }
  });

  /** Hooks picked and sent: the skill's own stream, held open after its `done` with the cards in. */
  async function ownHooksRunDoneStreamOpen() {
    const run = holdStream("/api/tools/hooks");
    holdChat(); // the script's run, when it goes, stays on screen as the live turn
    await renderComposer();
    fireEvent.click(pill("Hooks"));
    askInField(ASK);
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await run.push("stage", { name: "Generating", status: "done" });
    await run.push("content", { blocks: MEAL_PREP_HOOKS.map((b) => ({ props: b.props })) });
    await run.push("done", {});
    await waitFor(() => expect(liveRows()).toHaveLength(3));
    // Ruling 18: the field is at rest from `done`, though the closing line is still to come.
    expect(stopButton()).toBeNull();
    return run;
  }

  it("a skill's own run (Hooks picked), after its `done` while its closing line still streams: the sheet's script is held, the pack stays under its own question; once the stream has closed and folded, one request", async () => {
    const run = await ownHooksRunDoneStreamOpen();
    await scriptRow2FromSheet();
    await waitMs(50);
    expect(chats()).toHaveLength(0);
    expect(stopButton()).toBeEnabled();
    const live = liveTurn()!;
    expect(live.textContent).toContain(ASK);
    expect(live.textContent).toContain(HOOK_2);
    expect(within(live).getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3);

    // The closing line, the close, the fold (the thread read again).
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await run.push("followup", { text: "Hook 1 is the one to film." });
    await run.end();
    await waitFor(() => expect(chats()).toHaveLength(1));
    expect(bodyOf(chats()[0]!)).toMatchObject({ ask: "Write the script from this hook.", skill: "script", anchor: HOOK_2 });
    const reload = requests("/api/threads/open")[opensBefore];
    expect(reload).toBeDefined();
    expect(calls.indexOf(chats()[0]!)).toBeGreaterThan(calls.indexOf(reload!));
    await waitMs(50);
    expect(chats()).toHaveLength(1);
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.hasAttribute("data-send")).toBe(false);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(within(turns[2]!).getByText("Write the script from this hook.", { selector: "p" })).toBeInTheDocument();
  });

  it("(unchanged) the same run once its stream has closed and folded: the sheet's script goes at once", async () => {
    const run = await ownHooksRunDoneStreamOpen();
    threadFixture = storedHooksTurn();
    await run.end();
    await waitFor(() => expect(liveTurn()).toBeNull()); // folded: the pack is the persisted turn's
    await scriptRow2FromSheet();
    // `chat.start` makes its request in the tap's own task.
    expect(chats()).toHaveLength(1);
    expect(bodyOf(chats()[0]!)).toMatchObject({ ask: "Write the script from this hook.", anchor: HOOK_2 });
    expect(stopButton()).toBeEnabled(); // the script's own run
  });

  // Task 3: the fold waits while a sheet is open on the turn it would replace.
  const openRow2Sheet = async () => {
    fireEvent.click(screen.getByRole("button", { name: (name) => name.startsWith(`Open: ${HOOK_2!.slice(0, 30)}`) }));
    return screen.findByRole("dialog");
  };

  it("(Task 3) a row's sheet open as the stream ends: the fold waits (the dialog stays, the live turn stays live, the thread is not read); once Escape has closed it, the thread is read and the turn folds with its pack", async () => {
    const chat = await hooksLandedStreamOpen();
    const dialog = await openRow2Sheet();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("token", { delta: "Hook 1 is the one to film." });
    await chat.push("done", {});
    await chat.end();
    await waitMs(100);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(liveTurn()).not.toBeNull();
    expect(requests("/api/threads/open")).toHaveLength(opensBefore);
    // The field's states are as before: the stream has closed, nothing is held.
    expect(stopButton()).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1));
    await waitFor(() => expect(liveTurn()).toBeNull());
    expect(region().querySelector("[data-send]")).toBeNull();
    const turns = turnsIn();
    expect(turns).toHaveLength(2);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    await waitMs(50);
    expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1); // once per run
  });

  it("(Task 3) the sheet open as the stream ends, then its 'Script this one': the sheet closes, the fold runs, then exactly one script request; turn 1 keeps its pack", async () => {
    const chat = await hooksLandedStreamOpen();
    await openRow2Sheet();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("done", {});
    await chat.end();
    await waitMs(50);
    expect(requests("/api/threads/open")).toHaveLength(opensBefore);

    fireEvent.click(await screen.findByRole("button", { name: "Script this one, 2 credits" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(chats()).toHaveLength(2));
    expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script from this hook.", skill: "script", anchor: HOOK_2 });
    expect(calls.indexOf(chats()[1]!)).toBeGreaterThan(calls.indexOf(requests("/api/threads/open")[opensBefore]!));
    await waitMs(50);
    expect(chats()).toHaveLength(2);
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.hasAttribute("data-send")).toBe(false);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(within(turns[2]!).getByText("Write the script from this hook.", { selector: "p" })).toBeInTheDocument();
  });

  it("(Task 3) a skill's own run (Hooks picked): a row's sheet open as its stream closes: its fold waits too, and runs once the sheet has closed", async () => {
    const run = await ownHooksRunDoneStreamOpen();
    const dialog = await openRow2Sheet();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await run.push("followup", { text: "Hook 1 is the one to film." });
    await run.end();
    await waitMs(100);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(liveTurn()).not.toBeNull();
    expect(requests("/api/threads/open")).toHaveLength(opensBefore);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(liveTurn()).toBeNull());
    expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1);
    const turns = turnsIn();
    expect(turns).toHaveLength(2);
    expect(turns[1]!.textContent).toContain(HOOK_2);
  });

  it("(Task 3) a held follow-up's 8,000 ms limit does not fire under an open sheet: it waits for the sheet to close, then goes after the fold, once", async () => {
    const chat = await hooksLandedStreamOpen();
    // Fake timers from the tap on (the hold's limit is set by it), the clock still moving.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // A chip while the run finishes: held. Then a row's sheet, kept open.
      fireEvent.click(await screen.findByRole("button", { name: "Follow up: Punch them up" }));
      await waitMs(30);
      expect(chats()).toHaveLength(1);
      const dialog = await openRow2Sheet();
      // The stream ends; the fold waits for the sheet.
      threadFixture = storedHooksTurn();
      const opensBefore = requests("/api/threads/open").length;
      await chat.push("done", {});
      await chat.end();
      await act(async () => {
        vi.advanceTimersByTime(8_500);
      });
      await waitMs(30);
      expect(chats()).toHaveLength(1);
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(liveTurn()).not.toBeNull();
      expect(requests("/api/threads/open")).toHaveLength(opensBefore);

      // The sheet closes: the fold reads the thread, then the held chip goes, once.
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(chats()).toHaveLength(2));
      expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Rewrite these hooks tighter and more specific.", skill: "hooks" });
      expect(calls.indexOf(chats()[1]!)).toBeGreaterThan(calls.indexOf(requests("/api/threads/open")[opensBefore]!));
      await act(async () => {
        vi.advanceTimersByTime(8_500);
      });
      await waitMs(30);
      expect(chats()).toHaveLength(2);
      const turns = turnsIn();
      expect(turns).toHaveLength(3);
      expect(turns[1]!.textContent).toContain(HOOK_2);
    } finally {
      vi.useRealTimers();
    }
  });

  // Maven's pick, Task 2: a sheet opened while the fold's read of the thread is out.
  /** From here, the next read of the thread (`/api/threads/open`) waits until `release()`; later ones go at once. */
  function holdNextThreadRead() {
    let let_go: (() => void) | null = null;
    let held = false;
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!held && String(input).includes("/api/threads/open")) {
        held = true;
        calls.push({ url: String(input), init });
        await new Promise<void>((r) => (let_go = r));
        return json(threadFixture);
      }
      return base(input, init);
    }) as typeof fetch;
    return {
      release: () =>
        act(async () => {
          (let_go as (() => void) | null)?.();
        }),
    };
  }
  /** How many times hook 2 is drawn in the thread (the sheet's copy sits outside it, in its layer). */
  const hook2InThread = () => (region().textContent ?? "").split(HOOK_2!).length - 1;

  it("(pick Task 2) a row's sheet opened while the chat's fold is reading the thread: the read answers and nothing is replaced (the dialog stays, the live turn stays, the pack once); Escape: read again, then the turn folds, the pack once", async () => {
    const chat = await hooksLandedStreamOpen();
    const read = holdNextThreadRead();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1));

    // The read is out; the creator opens a row's sheet; then the read answers.
    const dialog = await openRow2Sheet();
    await read.release();
    await waitMs(50);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(liveTurn()).not.toBeNull();
    expect(turnsIn()).toHaveLength(2); // the first turn and the live one: no stored copy beside it
    expect(hook2InThread()).toBe(1);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 2));
    await waitFor(() => expect(liveTurn()).toBeNull());
    expect(region().querySelector("[data-send]")).toBeNull();
    expect(turnsIn()).toHaveLength(2);
    expect(turnsIn()[1]!.textContent).toContain(ASK);
    expect(hook2InThread()).toBe(1);
    await waitMs(50);
    expect(requests("/api/threads/open")).toHaveLength(opensBefore + 2);
  });

  it("(pick Task 2) the same for a skill's own run (Hooks picked, the run's fold): a sheet opened during its read stays, and the turn folds once it has closed", async () => {
    const run = await ownHooksRunDoneStreamOpen();
    const read = holdNextThreadRead();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await run.push("followup", { text: "Hook 1 is the one to film." });
    await run.end();
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1));

    const dialog = await openRow2Sheet();
    await read.release();
    await waitMs(50);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(liveTurn()).not.toBeNull();
    expect(turnsIn()).toHaveLength(2);
    expect(hook2InThread()).toBe(1);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(liveTurn()).toBeNull());
    expect(requests("/api/threads/open")).toHaveLength(opensBefore + 2);
    expect(turnsIn()).toHaveLength(2);
    expect(hook2InThread()).toBe(1);
  });

  it("(pick Task 2) a sheet opened during the read, then its 'Script this one': the sheet closes, the fold runs, exactly one script request follows, turn 1 holds the pack", async () => {
    const chat = await hooksLandedStreamOpen();
    const read = holdNextThreadRead();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1));
    await openRow2Sheet();
    await read.release();
    await waitMs(50);

    fireEvent.click(await screen.findByRole("button", { name: "Script this one, 2 credits" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(chats()).toHaveLength(2));
    expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script from this hook.", skill: "script", anchor: HOOK_2 });
    // After the fresh read the fold made once the sheet had closed.
    expect(calls.indexOf(chats()[1]!)).toBeGreaterThan(calls.indexOf(requests("/api/threads/open")[opensBefore + 1]!));
    await waitMs(50);
    expect(chats()).toHaveLength(2);
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.hasAttribute("data-send")).toBe(false);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(within(turns[2]!).getByText("Write the script from this hook.", { selector: "p" })).toBeInTheDocument();
  });

  it("(pick Task 2, fix 1) a fold cancelled while its read is out (a message sent from the field meanwhile) still puts the read's turns on screen, and resets nothing", async () => {
    const chat = await hooksLandedStreamOpen();
    const read = holdNextThreadRead();
    threadFixture = storedHooksTurn();
    const opensBefore = requests("/api/threads/open").length;
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1));

    // The stream has closed and nothing is held, so the field sends: its run's start cancels the fold.
    askInField("and one for a gym audience?");
    await waitFor(() => expect(chats()).toHaveLength(2));
    await read.release();
    await waitMs(50);

    // The finished turn is in history from the read; the new send is the live turn, untouched.
    const turns = turnsIn();
    expect(turns).toHaveLength(3);
    expect(turns[1]!.hasAttribute("data-send")).toBe(false);
    expect(turns[1]!.textContent).toContain(ASK);
    expect(turns[1]!.textContent).toContain(HOOK_2);
    expect(turns[2]!.dataset.send).toBeDefined();
    expect(turns[2]!.textContent).toContain("and one for a gym audience?");
    expect(hook2InThread()).toBe(1);
    expect(requests("/api/threads/open")).toHaveLength(opensBefore + 1);
  });

  it("leaving the chat drops a held follow-up: nothing is sent into the next chat", async () => {
    await hooksLandedStreamOpen();
    await scriptRow2FromSheet();
    await waitMs(30);
    threadFixture = { ...historyThread(), threadId: "t2" };
    act(() => useBoardStore.getState().switchThread());
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(1));
    await waitMs(100);
    expect(chats()).toHaveLength(1);
  });

  it("(unchanged) a follow-up tapped while the run still works, its answer not in: it cancels and replaces the run at once, as today", async () => {
    const [h1, h2, h3] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);
    const seal = (n: number) => ({ fraction: `${n / 10}/10 stop`, scrollQuote: "", personas: [], population: population(n), at: "2026-11-21T00:00:00.000Z" });
    threadFixture = mealPrepThread("@nia.tests", { [h1!.trim()]: seal(30), [h2!.trim()]: seal(35), [h3!.trim()]: seal(28) });
    const chat = holdChat();
    await renderComposer();
    askInField("what should I post next?");
    await waitFor(() => expect(chats()).toHaveLength(1));
    await chat.push("dispatch", { skill: "ideas" });
    await chat.push("stage", { name: "Generating", status: "active" });
    // An older card's script button, while this run is still working.
    fireEvent.click(await screen.findByRole("button", { name: "Script hook 2, 2 credits" }));
    await waitFor(() => expect(chats()).toHaveLength(2));
    expect(chats()[0]!.init?.signal?.aborted).toBe(true);
    expect(bodyOf(chats()[1]!)).toMatchObject({ ask: "Write the script for hook 2.", anchor: h2 });
  });
});

describe("thread feel (Task 4): a chat with no title is named in its header at once (spec §5.1)", () => {
  beforeEach(() => useShellStore.setState({ threadTitleHint: null }));
  afterEach(() => useShellStore.setState({ threadTitleHint: null }));
  const untitled = () =>
    answer("/api/threads/list", { threads: [{ id: "t1", title: null, updated_at: "", created_at: "", pinned_at: null }] });
  const headerNamed = (name: string) => screen.findByRole("heading", { level: 1, name });
  /** The list answers with what the server has stored for "t1": `title`, changed by the test. */
  const listAnswersStored = () => {
    const stored: { title: string | null } = { title: null };
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/threads/list")) {
        calls.push({ url: String(input), init });
        return json({ threads: [{ id: "t1", title: stored.title, updated_at: "", created_at: "", pinned_at: null }] });
      }
      return base(input, init);
    }) as typeof fetch;
    return stored;
  };

  it("a new chat's first send: its ask, cleaned by the server's rule, in the header while the answer is still on its way", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    try {
      holdChat();
      threadFixture = { messages: [] }; // a blank new chat, as the server answers the sentinel
      await renderHome();
      askInField("  “meal prep   for busy students”  ");
      await waitFor(() => expect(requests("/api/threads/new")).toHaveLength(1));
      expect(await headerNamed("meal prep for busy students")).toBeInTheDocument();
      expect(useShellStore.getState().threadTitleHint).toEqual({ id: "t-new", title: "meal prep for busy students" });
    } finally {
      document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
    }
  });

  it("a new chat whose creation fails: no hint, and the header is not named from the ask", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
    // An id left from an earlier chat: the hint must never land on it.
    useBoardStore.setState({ activeThreadId: "t-old" });
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/threads/new")) {
        calls.push({ url: String(input), init });
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      }
      return base(input, init);
    }) as typeof fetch;
    try {
      holdChat();
      threadFixture = { messages: [] }; // a blank new chat, as the server answers the sentinel
      await renderHome();
      askInField("meal prep for busy students");
      await waitFor(() => expect(requests("/api/threads/new")).toHaveLength(1));
      // The send still goes (the route makes its chat itself); its id is not known here.
      await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
      expect(await headerNamed("New chat")).toBeInTheDocument();
      await waitMs(30);
      expect(useShellStore.getState().threadTitleHint).toBeNull();
      expect(screen.queryByRole("heading", { level: 1, name: "meal prep for busy students" })).toBeNull();
      expect(useBoardStore.getState().activeThreadId).toBeNull();
    } finally {
      document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
    }
  });

  it("a long first message is cut back to its last whole word at once, and reads the same once the list holds the stored title", async () => {
    // The list answers with what the server has stored: nothing until the turn is in, then the
    // title it cut to 48 characters ("…meal pr"), which the header shows cut back to "…meal…".
    const stored = listAnswersStored();
    const chat = holdChat();
    threadFixture = emptyChat(); // a chat with nothing in it yet (Home): this is its first message
    await renderHome();
    const ask = "can you write me hooks for a video about meal prep for busy students";
    askInField(ask);
    expect(await headerNamed("can you write me hooks for a video about meal…")).toBeInTheDocument();

    // The turn is stored with its title; the fold reads the list again.
    stored.title = "can you write me hooks for a video about meal pr";
    threadFixture = {
      threadId: "t1",
      messages: [
        { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: ask } }], created_at: "2026-11-25T00:00:00.000Z" },
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Here are three." } }], created_at: "2026-11-25T00:00:00.000Z" },
      ],
      simSeals: {},
    };
    const lists = requests("/api/threads/list").length;
    await chat.push("token", { delta: "Here are three." });
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/list").length).toBeGreaterThan(lists));
    await waitMs(30);
    // The hint goes: what the header shows now is the list's stored title, and it reads the same.
    act(() => useShellStore.setState({ threadTitleHint: null }));
    expect(screen.getByRole("heading", { level: 1, name: "can you write me hooks for a video about meal…" })).toBeInTheDocument();
  });

  it("a skill's first message in an empty chat the list holds untitled names it", async () => {
    holdStream("/api/tools/hooks");
    untitled();
    threadFixture = emptyChat();
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Hooks" })); // Home's skill card
    askInField("gym myths for beginners");
    expect(await headerNamed("gym myths for beginners")).toBeInTheDocument();
    expect(useShellStore.getState().threadTitleHint).toEqual({ id: "t1", title: "gym myths for beginners" });
  });

  it("a send in a chat with history that the list holds untitled does not name it: its stored title comes with the list at the fold", async () => {
    // The server writes a chat's title once, from its first message. This chat's first message is
    // long stored (the list was not read since: a run stopped, a chat beyond the list's rows), so
    // the later send's words would name it wrong until the fold put the stored title back.
    const stored = listAnswersStored();
    const run = holdStream("/api/tools/hooks");
    await renderComposer();
    expect(await headerNamed("New chat")).toBeInTheDocument();
    fireEvent.click(pill("Hooks"));
    askInField("gym myths for beginners");
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await waitMs(30);
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "gym myths for beginners" })).toBeNull();

    // The fold reads the list again: the title the server stored from the first message.
    stored.title = "first ask";
    const hookBlock = (rank: number) => ({ props: { hookLine: `Gym myth number ${rank}`, rank, scrollQuote: "ok that is me" } });
    await run.push("stage", { name: "Generating", status: "done" });
    await run.push("content", { blocks: [hookBlock(1), hookBlock(2), hookBlock(3)] });
    await run.push("done", {});
    threadFixture = {
      ...historyThread(),
      messages: [
        ...historyThread().messages,
        { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "gym myths for beginners" } }], created_at: "2026-11-25T00:00:00.000Z" },
        { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Gym myth number 1" } }], created_at: "2026-11-25T00:00:00.000Z" },
      ],
    };
    await run.end();
    expect(await headerNamed("first ask")).toBeInTheDocument();
    expect(useShellStore.getState().threadTitleHint).toBeNull();
  });

  it("once per chat: after a Stop, the next message does not rename it (nothing was folded, the list still holds it untitled)", async () => {
    untitled();
    holdChat();
    threadFixture = emptyChat();
    await renderHome();
    askInField("meal prep for busy students");
    expect(await headerNamed("meal prep for busy students")).toBeInTheDocument();
    // Stopped before its first word: nothing is folded, so the list is not read again.
    await waitFor(() => expect(stopButton()).toBeEnabled());
    fireEvent.click(stopButton()!);
    await waitFor(() => expect(stopButton()).toBeNull());

    askInField("gym myths for beginners");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(2));
    await waitMs(30);
    expect(useShellStore.getState().threadTitleHint).toEqual({ id: "t1", title: "meal prep for busy students" });
    expect(screen.queryByRole("heading", { level: 1, name: "gym myths for beginners" })).toBeNull();
  });

  it("a bare link as the first message names nothing", async () => {
    holdStream("/api/tools/remix");
    untitled();
    threadFixture = emptyChat();
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Remix" })); // Home's skill card
    askInField("https://www.tiktok.com/@creator_one/video/7300000000000000001");
    await waitFor(() => expect(requests("/api/tools/remix")).toHaveLength(1));
    await waitMs(30);
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(await headerNamed("New chat")).toBeInTheDocument();
  });

  it("a chat that has a title is left alone", async () => {
    holdStream("/api/tools/hooks");
    answer("/api/threads/list", { threads: [{ id: "t1", title: "Meal prep for busy students", updated_at: "", created_at: "", pinned_at: null }] });
    await renderComposer();
    expect(await headerNamed("Meal prep for busy students")).toBeInTheDocument();
    fireEvent.click(pill("Hooks"));
    askInField("gym myths for beginners");
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await waitMs(30);
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Meal prep for busy students" })).toBeInTheDocument();
  });

  it("a chip tapped in a chat the list holds untitled does not name it: a chip sits under a turn, so its message is never the chat's first", async () => {
    holdChat();
    untitled();
    threadFixture = mealPrepThread("@nia.tests");
    await renderComposer();
    expect(await headerNamed("New chat")).toBeInTheDocument();
    const chip = (await screen.findAllByRole("button", { name: /^Follow up: / }))[0]!;
    fireEvent.click(chip);
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    const asked = String(bodyOf(requests("/api/tools/chat")[0]!).ask);
    expect(asked.length).toBeGreaterThan(0);
    await waitMs(30);
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: asked })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
  });
});

describe("thread feel (Task 4): the list of chats is read again once a run is in history (spec §5.1)", () => {
  /** The thread as the server holds it once the turn is stored. */
  const withTurn = (ask: string, answerText: string) => ({
    ...historyThread(),
    messages: [
      ...historyThread().messages,
      { id: "u2", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: ask } }], created_at: "2026-11-25T00:00:00.000Z" },
      { id: "m2", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: answerText } }], created_at: "2026-11-25T00:00:00.000Z" },
    ],
  });
  const lists = () => requests("/api/threads/list").length;

  it("a chat run: once it is folded, not while it streams", async () => {
    const chat = holdChat();
    await renderComposer();
    await waitFor(() => expect(lists()).toBeGreaterThan(0));
    await waitMs(30);
    const before = lists();
    askInField("what should I post next?");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await chat.push("token", { delta: "Post the gym myth one first." });
    await waitMs(30);
    expect(lists()).toBe(before);

    threadFixture = withTurn("what should I post next?", "Post the gym myth one first.");
    const opens = requests("/api/threads/open").length;
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opens));
    await waitFor(() => expect(lists()).toBe(before + 1));
  });

  it("a skill's run (Hooks): once it is folded", async () => {
    const run = holdStream("/api/tools/hooks");
    await renderComposer();
    await waitFor(() => expect(lists()).toBeGreaterThan(0));
    await waitMs(30);
    const before = lists();
    fireEvent.click(pill("Hooks"));
    askInField("gym myths");
    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    await run.push("stage", { name: "Generating", status: "done" });
    const hookBlock = (rank: number) => ({ props: { hookLine: `Gym myth number ${rank}`, rank, scrollQuote: "ok that is me" } });
    await run.push("content", { blocks: [hookBlock(1), hookBlock(2), hookBlock(3)] });
    await run.push("done", {});
    await waitMs(30);
    expect(lists()).toBe(before); // done, the stream still open: not folded yet

    threadFixture = withTurn("gym myths", "Gym myth number 1");
    await run.end();
    await waitFor(() => expect(lists()).toBe(before + 1));
  });

  it("a fold whose reload brings nothing reads nothing again", async () => {
    const chat = holdChat();
    await renderComposer();
    await waitFor(() => expect(lists()).toBeGreaterThan(0));
    await waitMs(30);
    const before = lists();
    askInField("what should I post next?");
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    threadFixture = { threadId: "t1", messages: [] }; // the reload finds nothing: no fold
    const opens = requests("/api/threads/open").length;
    await chat.push("token", { delta: "Post the gym myth one first." });
    await chat.push("done", {});
    await chat.end();
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(opens));
    await waitMs(50);
    expect(lists()).toBe(before);
  });
});

describe("thread feel (Task 4): a card's script button names its row (spec §4.7)", () => {
  it("Script hook 2 sends 'Write the script for hook 2.' with that hook as the anchor", async () => {
    const [h1, h2, h3] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);
    const seal = (n: number) => ({ fraction: `${n / 10}/10 stop`, scrollQuote: "", personas: [], population: population(n), at: "2026-11-21T00:00:00.000Z" });
    // Hook 2 leads by 5: no clear best, so the button names the row.
    threadFixture = mealPrepThread("@nia.tests", { [h1!.trim()]: seal(30), [h2!.trim()]: seal(35), [h3!.trim()]: seal(28) });
    holdChat(); // the run stays the live turn, its question in its bubble
    await renderComposer();
    fireEvent.click(await screen.findByRole("button", { name: "Script hook 2, 2 credits" }));
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/chat")[0]!)).toMatchObject({
      ask: "Write the script for hook 2.",
      skill: "script",
      anchor: h2,
    });
    expect(await screen.findByText("Write the script for hook 2.", { selector: "p" })).toBeInTheDocument();
  });

  it("Script the best names the best row too", async () => {
    const [h1, h2, h3] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);
    const seal = (n: number) => ({ fraction: `${n / 10}/10 stop`, scrollQuote: "", personas: [], population: population(n), at: "2026-11-21T00:00:00.000Z" });
    threadFixture = mealPrepThread("@nia.tests", { [h1!.trim()]: seal(20), [h2!.trim()]: seal(25), [h3!.trim()]: seal(60) });
    await renderComposer();
    fireEvent.click(await screen.findByRole("button", { name: "Script the best, 2 credits" }));
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/chat")[0]!)).toMatchObject({ ask: "Write the script for hook 3.", anchor: h3 });
  });
});
