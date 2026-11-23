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

// ── the network ──────────────────────────────────────────────────────────────
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
/** Keep the hooks stream open until it is aborted (the Stop case). */
let holdHooksOpen = false;
let threadFixture: unknown = { threadId: "t1", messages: [] };
let audiencesFixture: unknown[] = [];

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

async function renderComposer() {
  renderWithClient(<Composer />);
  return screen.findByTestId("thread-field");
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
  threadFixture = { threadId: "t1", messages: [] };
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

  it("the example chips' More opens the More sheet (the skills panel is gone)", async () => {
    await renderComposer();
    const chips = await screen.findByTestId("composer-chips-row");
    fireEvent.click(within(chips).getByRole("button", { name: /more/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Read a file");
    expect(screen.queryByTestId("skills-panel")).toBeNull();
  });

  it("`/` still opens the skill list, and picking one selects it", async () => {
    await renderComposer();
    fireEvent.change(text(), { target: { value: "/hoo" } });
    const menu = await screen.findByRole("menu", { name: "Skills" });
    expect(menu.parentElement).toBe(document.body);
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(pill("Hooks")).toHaveAttribute("aria-pressed", "true");
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
    threadFixture = seededThread(); // a thread, so no example chips sit above the field
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
      [/^Your account/, "Account", "Read your account"],
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
  it("the example chips sit inside the measured block, so the reserve is the measurement alone", async () => {
    const ro = stubResizeObserver();
    await renderComposer(); // an empty thread: the v8 example chips show
    const chips = await screen.findByTestId("composer-chips-row");
    expect(fieldBlock().contains(chips)).toBe(true);
    ro.report(150);
    const region = screen.getByTestId("composer-thread-region");
    await waitFor(() => expect(region.style.getPropertyValue("--field-reserve")).toBe("150px"));
  });

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
    ro.report(164);
    await waitFor(() => expect(region.style.getPropertyValue("--field-reserve")).toBe("164px"));
    expect(region.scrollTop).toBe(200);
  });

  it("the observer lives with the block: disconnected when it goes", async () => {
    const ro = stubResizeObserver();
    const { unmount } = renderWithClient(<Composer />);
    await screen.findByTestId("thread-field");
    const watcher = ro.block();
    unmount();
    expect(watcher.disconnected).toBe(true);
  });
});

describe("fix round 1: More's audience row", () => {
  const AUDIENCE_ID = "3f2a7c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";
  it("opens today's audience sheet, and a pick runs its path (persist + the thread pin)", async () => {
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

    const audienceSheet = await screen.findByTestId("audience-sheet");
    fireEvent.click(within(audienceSheet).getByRole("option", { name: /Gym beginners/ }));

    await waitFor(() => expect(requests("/api/settings/last-audience")).toHaveLength(1));
    expect(bodyOf(requests("/api/settings/last-audience")[0]!)).toEqual({ audienceId: AUDIENCE_ID });
    await waitFor(() => expect(requests("/api/threads/t1").filter((c) => c.init?.method === "PATCH")).toHaveLength(1));
    // More names the new audience.
    fireEvent.click(pill("More"));
    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Audience: Gym beginners" })).toBeInTheDocument();
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

  it("Your account armed from More reads \"Account · 5\"; More's row keeps \"Your account\"", async () => {
    await renderComposer();
    fireEvent.click(pill("More"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: /^Your account/ })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Your account/ }));
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
    const onThreadChange = vi.fn();
    renderWithClient(<Composer onThreadChange={onThreadChange} />);
    await screen.findByTestId("thread-field");
    expect(onThreadChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(send());
    await waitFor(() => expect(onThreadChange).toHaveBeenLastCalledWith(true));
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    expect(onThreadChange).toHaveBeenLastCalledWith(true);
  });

  it("an upload that fails before the run starts shows no turn: the error by the field, the clip still staged, the arrival layout", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    const onThreadChange = vi.fn();
    renderWithClient(<Composer onThreadChange={onThreadChange} />);
    await screen.findByTestId("thread-field");
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

    threadFixture = { threadId: "t2", messages: [] };
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
    await renderComposer();
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
  it("focus lands on the audience sheet's first option, not on More behind it", async () => {
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
    const audienceSheet = await screen.findByTestId("audience-sheet");
    // Radix hands focus back on a timer once More's layer is gone.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const first = within(audienceSheet).getAllByRole("option")[0]!;
    expect(document.activeElement).toBe(first);
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
    // Explore's own "Run Explore" starts its stream directly (not through the field's send, so
    // the send latch is not holding); the stream stays open until Stop.
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

/** One settled turn of history: a question and a plain answer. */
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
  it("the funnel's return (?claimed=1) toasts and opens no room: the example chips stay", async () => {
    window.history.replaceState({}, "", "/home?claimed=1");
    try {
      threadFixture = {
        threadId: "t1",
        messages: [],
        simSeals: { "analysis-1": { sealed: true, at: "2026-07-27T00:00:00.000Z", video: { analysisId: "analysis-1", craftScore: 77 } } },
      };
      await renderComposer();
      expect(await screen.findByText("Account linked")).toBeInTheDocument();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(screen.getByTestId("composer-chips-row")).toBeInTheDocument();
      expect(screen.queryByTestId("ambient-overview-sheet")).toBeNull();
    } finally {
      window.history.replaceState({}, "", "/home");
    }
  });

  it("the arrival's room line states the room; it is not a door to a room that is gone", async () => {
    await renderComposer();
    expect((await screen.findByTestId("arrival-room-line")).tagName).toBe("P");
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
    await renderComposer();
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
    const ask = await screen.findByText("Write the script from this hook.");
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
