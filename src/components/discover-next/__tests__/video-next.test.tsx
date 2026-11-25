/** @vitest-environment happy-dom */

/**
 * VideoNext: a library video's page (spec 3.3; drawing frame 3). The real container, screen, desktop
 * header, Remix sheet, Save (over the app's saved-items hooks and a real QueryClient) and Remix (the
 * hand-off to a new chat, `remix-from`, and the shell's `newThreadAt`). Stand-ins only at the edges:
 * `fetch` (the saved list and its writes; a remix request would show there), the router, `matchMedia` (a
 * phone) and the build-time flag. Every handle, id and link is made up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { LibraryVideo } from "@/lib/discover-next/video";
import { takeRemixFrom } from "@/lib/thread-next/remix-from";
import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { SHADE_HEIGHT } from "../cover-look";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/feed/video/v1",
  useRouter: () => router,
}));

import { VideoNext, VideoNextLoading } from "../video-next";

// ─── Fixtures (made-up) ──────────────────────────────────────────────────────

const VIDEO_ID = "0b6f3c1e-8f2a-4c55-9d3e-2a7b1c4d5e6f";
const LINE = "I ran an experiment to see if the pool really smells of chlorine";
const LEAD = "The spoken hook sets up a question. The visual answers it at once.";
const REST = "Viewers stay to see the reveal. The ending loops back to the start.";

const VIDEO: LibraryVideo = {
  id: VIDEO_ID,
  coverUrl: "https://covers.example/nia.cooks/1.jpg",
  handle: "nia.cooks",
  spokenHook: LINE,
  niche: "education-science",
  platform: "tiktok",
  views: 25_000_000,
  postedAt: "2020-06-01T12:00:00Z",
  multiplier: 16,
  baselineLabel: "vs their average",
  proven: true,
  extreme: false,
  formats: [],
  videoUrl: "https://videos.example/nia.cooks/1",
  whyItWorks: `${LEAD} ${REST}`,
  beats: [
    { name: "Hypothesis", startSec: 0, endSec: 6 },
    { name: "Controlled setup", startSec: 6, endSec: 16 },
    { name: "The variable", startSec: 16, endSec: 24 },
    { name: "Control result", startSec: 24, endSec: 35 },
    { name: "The reveal", startSec: 35, endSec: 51 },
  ],
};

// ─── The server ──────────────────────────────────────────────────────────────

const REMIX_ROUTE = "/api/tools/remix/run";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let savedList: SavedItem[];
/** How many reads of the saved list fail before one answers. */
let listFailures: number;
/** How a save is answered (a status other than 201 refuses it). */
let saveStatus: number;
let onRemix: () => Promise<Response>;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === "/api/saved") {
    if (method === "POST") {
      if (saveStatus !== 201) return json({ error: "refused" }, saveStatus);
      const body = JSON.parse(String(init!.body)) as SavedItem;
      const row = { ...body, id: "sv-1", user_id: "u-1", project_id: null, created_at: "2026-11-25T10:00:00Z" } as SavedItem;
      savedList = [row, ...savedList];
      return json({ item: row }, 201);
    }
    if (method === "DELETE") {
      savedList = savedList.filter((row) => row.id !== url.searchParams.get("id"));
      return json({ success: true });
    }
    if (listFailures > 0) {
      listFailures -= 1;
      return json({}, 500);
    }
    return json({ items: savedList });
  }
  if (url.pathname === REMIX_ROUTE && method === "POST") return onRemix();
  return json({}, 404);
});

const remixCalls = () =>
  fetchMock.mock.calls
    .filter(([input]) => new URL(String(input), "http://localhost").pathname === REMIX_ROUTE)
    .map(([, init]) => ({ headers: init?.headers, body: JSON.parse(String(init!.body)) as unknown }));
const savedWrites = () =>
  fetchMock.mock.calls.filter(([input, init]) => new URL(String(input), "http://localhost").pathname === "/api/saved" && init?.method === "POST");

// ─── Rendering ───────────────────────────────────────────────────────────────

let client: QueryClient;

function renderVideo(props: React.ComponentProps<typeof VideoNext>) {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <VideoNext {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const saveButton = () => screen.getByRole("button", { name: "Save" });
const mainButton = () => screen.queryByRole("button", { name: "Remix this · 10 credits" });
const REMIX_TITLE = "What do you want to make from this?";
const REMIX_LIMIT = "Remix works with TikTok videos for now.";

const realHistoryLength = Object.getOwnPropertyDescriptor(window.history, "length");
const setHistoryLength = (value: number) => Object.defineProperty(window.history, "length", { configurable: true, get: () => value });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  savedList = [];
  listFailures = 0;
  saveStatus = 201;
  onRemix = async () => new Response("", { status: 200 });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  for (const fn of Object.values(router)) fn.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (realHistoryLength) Object.defineProperty(window.history, "length", realHistoryLength);
  else delete (window.history as { length?: number }).length;
  // A hand-off or a pointer left by one test must not reach the next.
  takeRemixFrom();
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  router.push.mockReset();
});

// ─── The page ────────────────────────────────────────────────────────────────

describe("VideoNext — the header", () => {
  it('is titled "Video": the desktop heading, and the phone\'s pushed header through the shell', () => {
    renderVideo({ video: VIDEO });
    expect(screen.getByRole("heading", { level: 1, name: "Video" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Video");
  });

  it("Back goes back in history to the grid as it was left; opened directly, to Discover", () => {
    setHistoryLength(3);
    const view = renderVideo({ video: VIDEO });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    view.unmount();

    setHistoryLength(1);
    renderVideo({ video: VIDEO });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/feed");
  });
});

describe("VideoNext — the cover", () => {
  it("carries the multiple and what it is measured against, the line as the heading, and the meta", () => {
    renderVideo({ video: VIDEO });
    expect(screen.getByRole("heading", { level: 2, name: LINE })).toBeInTheDocument();
    expect(screen.getByText("16× their average")).toBeInTheDocument();
    expect(screen.getByText("@nia.cooks · 25M views · TikTok · 2020")).toBeInTheDocument();
    expect(screen.queryByText("A small account makes this number shaky.")).toBeNull();
  });

  it("the shade under the words is the cards' one height, and a long unbroken line wraps instead of running out", () => {
    const { container } = renderVideo({ video: VIDEO });
    const shade = container.querySelector<HTMLElement>('[data-part="shade"]')!;
    expect(shade.style.height).toBe(SHADE_HEIGHT);
    expect(shade.style.background).toContain("linear-gradient");
    expect(screen.getByRole("heading", { level: 2, name: LINE }).className.split(/\s+/)).toContain("break-words");
  });

  it("past 100: more than 100×, and the quiet line under the cover", () => {
    renderVideo({ video: { ...VIDEO, multiplier: 100, extreme: true, baselineLabel: "vs followers" } });
    expect(screen.getByText("more than 100× their followers")).toBeInTheDocument();
    expect(screen.getByText("A small account makes this number shaky.")).toBeInTheDocument();
  });

  it("a video that is not proven says no multiple", () => {
    renderVideo({ video: { ...VIDEO, proven: false, multiplier: 1.4 } });
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("a line that is a placeholder is not shown; the heading names the video by its creator instead (for a screen reader)", () => {
    renderVideo({ video: { ...VIDEO, spokenHook: "[Product] changed my life" } });
    expect(screen.queryByText("[Product] changed my life")).toBeNull();
    const heading = screen.getByRole("heading", { level: 2, name: "Video by @nia.cooks" });
    expect(heading.className).toContain("sr-only");
  });

  it("the watch link opens the original in a new tab, named by its platform", () => {
    renderVideo({ video: VIDEO });
    const link = screen.getByRole("link", { name: "Watch on TikTok, opens in a new tab" });
    expect(link).toHaveAttribute("href", "https://videos.example/nia.cooks/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("another platform's name; a platform Maven does not name: Watch the original", () => {
    const view = renderVideo({ video: { ...VIDEO, platform: "instagram" } });
    expect(screen.getByRole("link", { name: "Watch on Instagram, opens in a new tab" })).toBeInTheDocument();
    view.unmount();
    renderVideo({ video: { ...VIDEO, platform: "vimeo" } });
    expect(screen.getByRole("link", { name: "Watch the original, opens in a new tab" })).toBeInTheDocument();
  });

  it("no web address: no watch link (and no Remix: there is nothing to hand on)", () => {
    renderVideo({ video: { ...VIDEO, videoUrl: "javascript:alert(1)" } });
    expect(screen.queryByRole("link", { name: /^Watch/ })).toBeNull();
    expect(mainButton()).toBeNull();
  });

  it("a cover that does not load is the neutral tile", () => {
    const { container } = renderVideo({ video: VIDEO });
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://covers.example/nia.cooks/1.jpg");
    expect(img).toHaveAttribute("alt", "");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-part="tile"]')).not.toBeNull();
  });

  it("no cover: the neutral tile", () => {
    const { container } = renderVideo({ video: { ...VIDEO, coverUrl: null } });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-part="tile"]')).not.toBeNull();
  });
});

describe("VideoNext — Save", () => {
  it("waits for the saved list, then saves the video as Library reads it, and shows it saved", async () => {
    renderVideo({ video: VIDEO });
    // Before the list is read: not offered as a choice yet (an unread list is not "not saved").
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-disabled"));
    expect(saveButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
    expect(savedWrites()).toHaveLength(1);
    expect(JSON.parse(String(savedWrites()[0]![1]!.body))).toMatchObject({ item_type: "outlier", ref_id: VIDEO_ID, thread_id: null, title: LINE });
  });

  it("a refused save says so, and the mark goes", async () => {
    saveStatus = 500;
    renderVideo({ video: VIDEO });
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-disabled"));
    fireEvent.click(saveButton());
    expect(await screen.findByText("Couldn't save this video.")).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "false"));
  });

  it("a saved list that cannot be read: Save stays a choice, and a press reads the list again", async () => {
    listFailures = 1;
    savedList = [
      {
        id: "sv-7",
        user_id: "u-1",
        item_type: "outlier",
        ref_id: VIDEO_ID,
        thread_id: null,
        project_id: null,
        title: LINE,
        snapshot: { caption: LINE },
        created_at: "2026-11-20T10:00:00Z",
      },
    ];
    const listReads = () => fetchMock.mock.calls.filter(([input, init]) => String(input) === "/api/saved" && (init?.method ?? "GET") === "GET").length;
    renderVideo({ video: VIDEO });
    await waitFor(() => expect(listReads()).toBe(1));
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-disabled"));
    expect(saveButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(saveButton());

    // The list is read again and the mark it holds shows; nothing is written by that press.
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
    expect(listReads()).toBe(2);
    expect(savedWrites()).toHaveLength(0);
  });

  it("a video saved before is marked saved, and a tap removes it", async () => {
    savedList = [
      {
        id: "sv-7",
        user_id: "u-1",
        item_type: "outlier",
        ref_id: VIDEO_ID,
        thread_id: null,
        project_id: null,
        title: LINE,
        snapshot: { caption: LINE },
        created_at: "2026-11-20T10:00:00Z",
      },
    ];
    renderVideo({ video: VIDEO });
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "false"));
    expect(fetchMock.mock.calls.some(([input, init]) => init?.method === "DELETE" && String(input).includes("id=sv-7"))).toBe(true);
  });
});

describe("VideoNext — why it works", () => {
  it("shows the first two sentences, and More opens the rest in place and goes", async () => {
    renderVideo({ video: VIDEO });
    expect(screen.getByRole("heading", { level: 2, name: "Why it works" })).toBeInTheDocument();
    expect(screen.getByText(LEAD, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(REST, { exact: false })).toBeNull();

    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);

    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    const rest = screen.getByText(REST);
    expect(rest).toBeInTheDocument();
    // The focus does not drop to the page with the button: it lands on what was opened.
    await waitFor(() => expect(rest).toHaveFocus());
  });

  it("two sentences or fewer: all of it, no More", () => {
    renderVideo({ video: { ...VIDEO, whyItWorks: LEAD } });
    expect(screen.getByText(LEAD)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("two long sentences: it opens on the first alone, and More opens the rest", () => {
    const first = `The spoken hook opens on a promise ${"that every viewer can picture before the first cut lands, ".repeat(2)}and it never lets go.`;
    const second = `The visual answers it at once ${"with the finished result held up to the camera for a full second, ".repeat(2)}so nobody scrolls away.`;
    renderVideo({ video: { ...VIDEO, whyItWorks: `${first} ${second}` } });
    expect(screen.getByText(first, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(second, { exact: false })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText(second)).toBeInTheDocument();
  });

  it("no text: no card at all", () => {
    renderVideo({ video: { ...VIDEO, whyItWorks: null } });
    expect(screen.queryByText("Why it works")).toBeNull();
  });
});

describe("VideoNext — how it's built", () => {
  const card = () => screen.getByRole("heading", { level: 2, name: "How it's built" }).closest('[data-part="built"]') as HTMLElement;

  it("the length at the right, one bar cut at the beats in proportion, and the beats numbered with their start", () => {
    renderVideo({ video: VIDEO });
    expect(within(card()).getByText("0:51")).toBeInTheDocument();

    const bar = card().querySelector('[data-part="bar"]')!;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    const segments = [...bar.children] as HTMLElement[];
    expect(segments.map((s) => Number(s.style.flexGrow).toFixed(4))).toEqual([6, 10, 8, 11, 16].map((n) => (n / 51).toFixed(4)));
    // The lighter beats in a tone that reads on a white card and on a dark one (the faint track did not).
    const tone = (s: HTMLElement) => s.className.split(/\s+/).find((c) => c.startsWith("bg-"));
    expect(segments.map(tone)).toEqual(["bg-foreground", "bg-foreground-muted", "bg-foreground", "bg-foreground-muted", "bg-foreground"]);

    const rows = within(within(card()).getByRole("list")).getAllByRole("listitem");
    // A beat's name wraps, even one long unbroken word, rather than pushing past the card at 320.
    expect(within(rows[0]!).getByText("Hypothesis").className.split(/\s+/)).toContain("break-words");
    expect(rows.map((row) => row.textContent)).toEqual([
      "1Hypothesis0:00",
      "2Controlled setup0:06",
      "3The variable0:16",
      "4Control result0:24",
      "5The reveal0:35",
    ]);
  });

  it("beats stored without times: listed, without the bar and the length", () => {
    renderVideo({ video: { ...VIDEO, beats: [{ name: "Hypothesis" }, { name: "The reveal", startSec: null, endSec: null }] } });
    expect(card().querySelector('[data-part="bar"]')).toBeNull();
    expect(within(card()).queryByText(/^\d+:\d\d$/)).toBeNull();
    expect(within(within(card()).getByRole("list")).getAllByRole("listitem").map((row) => row.textContent)).toEqual(["1Hypothesis", "2The reveal"]);
  });

  it("no stored beats: no card", () => {
    renderVideo({ video: { ...VIDEO, beats: [] } });
    expect(screen.queryByText("How it's built")).toBeNull();
  });
});

describe("VideoNext — Remix", () => {
  const openRemix = async () => {
    fireEvent.click(mainButton()!);
    return screen.findByRole("dialog", { name: REMIX_TITLE });
  };
  const brief = () => screen.getByRole("textbox", { name: REMIX_TITLE });

  it("the main button says the price, and opens the question first; nothing is sent until Remix", async () => {
    renderVideo({ video: VIDEO });
    expect(mainButton()).toHaveAttribute("aria-haspopup", "dialog");
    await openRemix();
    expect(remixCalls()).toEqual([]);
  });

  it("Remix leaves the video for a new chat and opens it: the link, its platform and the brief; nothing is sent from here", async () => {
    renderVideo({ video: VIDEO });
    await openRemix();
    fireEvent.change(brief(), { target: { value: "  for gym students  " } });
    fireEvent.click(screen.getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    expect(takeRemixFrom()).toEqual({ url: "https://videos.example/nia.cooks/1", platform: "tiktok", brief: "for gym students" });
    // A new chat: the pointer is the new-chat sentinel, no chat is active.
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    // Home's own Remix runs it (its walls, its billing): no request from Discover.
    expect(remixCalls()).toEqual([]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // While Home opens, the main button waits: a tap opens nothing and leaves nothing more.
    expect(mainButton()).toHaveAttribute("aria-disabled", "true");
    expect(mainButton()).toHaveAttribute("aria-busy", "true");
    fireEvent.click(mainButton()!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("from inside a chat, it is a new chat all the same", async () => {
    setActiveThreadCookie("t-open");
    useBoardStore.setState({ activeThreadId: "t-open" });
    renderVideo({ video: VIDEO });
    await openRemix();
    fireEvent.click(screen.getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
  });

  it("a blank brief is left as none", async () => {
    renderVideo({ video: VIDEO });
    await openRemix();
    fireEvent.click(screen.getByRole("button", { name: "Remix" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/home"));
    expect(takeRemixFrom()).toEqual({ url: "https://videos.example/nia.cooks/1", platform: "tiktok", brief: null });
  });

  it("a platform Remix does not work on (Instagram, YouTube: the engine reads TikTok links only; another): one quiet line in its place, no button; Save and the watch link stay", () => {
    for (const platform of ["instagram", "youtube", "vimeo"]) {
      const view = renderVideo({ video: { ...VIDEO, platform } });
      expect(mainButton(), platform).toBeNull();
      expect(screen.getByText(REMIX_LIMIT), platform).toBeInTheDocument();
      expect(saveButton(), platform).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Watch/ }), platform).toBeInTheDocument();
      view.unmount();
    }
  });

  it("a TikTok video: the button, and no line", () => {
    renderVideo({ video: VIDEO });
    expect(mainButton()).toBeInTheDocument();
    expect(screen.queryByText(REMIX_LIMIT)).toBeNull();
  });

  it("no original link at all: neither the button nor the line", () => {
    renderVideo({ video: { ...VIDEO, platform: "instagram", videoUrl: null } });
    expect(mainButton()).toBeNull();
    expect(screen.queryByText(REMIX_LIMIT)).toBeNull();
  });
});

describe("VideoNext — not in the library, or not read", () => {
  it("gone: the sentence and Back to Discover; no Save, no Remix", () => {
    renderVideo({ video: null });
    expect(screen.getByText("This video isn't in the library any more.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Discover" })).toHaveAttribute("href", "/feed");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(mainButton()).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Video" })).toBeInTheDocument();
    // Nothing is read for a video that is not there.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const savedAs = (snapshot: Record<string, unknown>, ref = VIDEO_ID): SavedItem =>
    ({
      id: "sv-9",
      user_id: "u-1",
      item_type: "outlier",
      ref_id: ref,
      thread_id: null,
      project_id: null,
      title: LINE,
      snapshot: { caption: LINE, ...snapshot },
      created_at: "2026-11-20T10:00:00Z",
    }) as SavedItem;

  it("gone, but saved: the original the saved row holds opens beside Back to Discover", async () => {
    savedList = [savedAs({ videoUrl: "https://videos.example/nia.cooks/1", platform: "tiktok" })];
    renderVideo({ video: null, id: VIDEO_ID });
    const watch = await screen.findByRole("link", { name: "Watch on TikTok, opens in a new tab" });
    expect(watch).toHaveAttribute("href", "https://videos.example/nia.cooks/1");
    expect(watch).toHaveAttribute("target", "_blank");
    expect(watch).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Back to Discover" })).toHaveAttribute("href", "/feed");
  });

  it("gone, saved from a platform it does not name: Watch the original", async () => {
    savedList = [savedAs({ videoUrl: "https://videos.example/x/1", platform: null })];
    renderVideo({ video: null, id: VIDEO_ID });
    expect(await screen.findByRole("link", { name: "Watch the original, opens in a new tab" })).toBeInTheDocument();
  });

  it("gone, and not saved, or saved with no web address: Back to Discover alone", async () => {
    renderVideo({ video: null, id: VIDEO_ID });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("link", { name: /^Watch/ })).toBeNull();
    cleanup();

    savedList = [savedAs({ videoUrl: "javascript:alert(1)" })];
    renderVideo({ video: null, id: VIDEO_ID });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByRole("link", { name: /^Watch/ })).toBeNull();
  });

  it("gone, with an id that is not a library video's: nothing is read", async () => {
    renderVideo({ video: null, id: "not-a-video" });
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the read failed: the sentence and Try again, which reads the page again", () => {
    renderVideo({ video: null, failed: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this video.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Back to Discover" })).toBeNull();
  });
});

describe("VideoNextLoading", () => {
  it("the page's outline: busy, titled, nothing sent", () => {
    const { container } = render(<VideoNextLoading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Video" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("Video");
  });
});
