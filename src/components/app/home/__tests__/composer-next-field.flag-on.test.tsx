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
    // The plate's chrome: the slot that holds the room carries no box of its own.
    const slot = screen.getByTestId("audience-header-slot");
    expect(slot.parentElement?.className ?? "").not.toMatch(/rounded|border|bg-surface/);
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
  it("the room's sheet stays mounted without its legacy bar", async () => {
    await renderComposer();
    expect(screen.getByTestId("ambient-overview-sheet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open your audience" })).toBeNull();
  });

  it("a card's door still opens the room", async () => {
    threadFixture = seededThread();
    await renderComposer();
    fireEvent.click(await screen.findByText(/simulate with your audience/i));
    const panel = await screen.findByTestId("ambient-sheet-panel");
    expect(panel.parentElement).toBe(document.body);
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
    await screen.findByText(/simulate with your audience/i);

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
    await screen.findByText(/simulate with your audience/i);
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
    await screen.findByText(/simulate with your audience/i);
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
  /** A thread holding a script card: its "Test this script" hands the opener over as the brief. */
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
  const takeTheBrief = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Test the full script on the deeper SIM-1 Max pipeline" }));
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

  it("a video brought through the ＋ door does not clear the clip staged in the field (even after that clip's run failed)", async () => {
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

    // The room's ＋: a TikTok link brought through the door runs the same /api/analyze pipeline.
    fireEvent.click(await screen.findByText(/simulate with your audience/i));
    fireEvent.click(await screen.findByTestId("ambient-sim-door"));
    const door = within(await screen.findByTestId("sim-door-host"));
    fireEvent.click(door.getByText("Test a real video"));
    fireEvent.change(door.getByLabelText("Paste a TikTok link"), { target: { value: link } });
    fireEvent.click(door.getByText("Continue →"));
    fireEvent.click(door.getByText("Simulate"));

    const reloads = requests("/api/threads/open").length;
    await waitFor(() => expect(requests("/api/tools/test/card")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/test/card")[0]!)).toEqual({ analysisId: "run-1" });
    expect(bodyOf(requests("/api/analyze")[1]!)).toMatchObject({ input_mode: "tiktok_url", tiktok_url: link });
    await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(reloads));
    await settle();

    // The brought run sealed; the field's clip was never its input, so it is still staged.
    if (pill("Simulate").getAttribute("aria-pressed") !== "true") fireEvent.click(pill("Simulate"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1); // the link run uploaded nothing
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
