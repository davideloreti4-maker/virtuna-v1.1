/** @vitest-environment happy-dom */
/**
 * The running screen: the result's first block building itself, drawn by
 * the result's own layout parts. Stood in for: the browser's EventSource (a small working one that
 * hands out named events), the clock (fake timers), the user's motion setting (matchMedia), the
 * window's width (`innerWidth`), images loading (`load` and `error` events) and the browser's
 * autoplay answer (`play()`). The screen, the stream hook, the reading of the events, the layout parts,
 * the result's own parts (for the comparison) and the query client are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import { queryKeys } from "@/lib/queries/query-keys";
import { forgetRunVideos, rememberRunVideo, runStillOf } from "@/lib/result/run-video";
import { Running } from "../running";
import { VideoResult } from "../video-result";
import { modelOf, renderWithPlayhead } from "./hero-harness";

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static readonly CLOSED = 2;
  static opened: FakeEventSource[] = [];
  readyState = 1;
  private listeners = new Map<string, Set<Listener>>();
  constructor(public url: string) {
    FakeEventSource.opened.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  send(type: string, data?: unknown) {
    const text = JSON.stringify(data ?? {});
    for (const listener of this.listeners.get(type) ?? []) listener({ data: text } as MessageEvent);
  }
}

const stream = () => FakeEventSource.opened.at(-1)!;
const COVER = "https://p.test/cover.jpg";
const sendFrame = (i: number) =>
  act(() => stream().send("filmstrip_segment_ready", { segment_idx: i, keyframe_uri: `https://f/${i}.jpg` }));
const sendCover = () =>
  act(() => stream().send("source", { cover_url: COVER, handle: "nia.tests", views: 1200, video_url: null }));

const realMatchMedia = window.matchMedia;
/** The user's motion setting, as the browser reports it. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("no-preference") ? !reduce : reduce,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const renderRunning = (startedAt: number | null = Date.now()) =>
  render(<Running id="run-1" startedAt={startedAt} />, { wrapper });

const q = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector);
const card = (c: HTMLElement) => q(c, '[data-result="running"]');
const picture = (c: HTMLElement) => q(c, '[data-result="running-picture"]')!;
const shows = (c: HTMLElement) => picture(c).getAttribute("data-shows");
const clock = (c: HTMLElement) => q(c, '[data-result="running-clock"]')!;
const tiles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-result="running-strip"] [data-tile]')];
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const realPlay = HTMLMediaElement.prototype.play;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") });
  FakeEventSource.opened = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  prefersReducedMotion(false);
  setWidth(393);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  HTMLMediaElement.prototype.play = realPlay;
  setWidth(realWidth);
  forgetRunVideos();
  client.clear();
});

describe("on a phone: the first card building itself", () => {
  it("just opened: an empty tile with a band of light, the words and the clock, the dotted base with its band, seven empty tiles; nothing else", () => {
    const { container } = renderRunning();
    expect(card(container)).not.toBeNull();
    expect(shows(container)).toBe("none");
    expect(picture(container).querySelector("img, video")).toBeNull();
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();
    expect(q(container, '[data-part="building"]')!.firstElementChild!.textContent).toBe("Building your 1,000 viewers");
    const dots = q(container, '[data-part="dots"]')!;
    expect(dots.children).toHaveLength(3);
    expect(dots.getAttribute("aria-hidden")).toBe("true");
    expect(clock(container).textContent).toBe("0:00");
    // Not announced every second; the page's heading names the screen.
    expect(clock(container).getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
    expect(q(container, '[data-part="base"]')!.getAttribute("stroke-dasharray")).toBe("1 6");
    expect(q(container, '[data-part="scan"]')).not.toBeNull();
    expect(tiles(container)).toHaveLength(7);
    for (const tile of tiles(container)) {
      expect(tile.querySelector("img")).toBeNull();
      expect(tile.querySelector('[data-part="shimmer"]')).not.toBeNull();
    }
    // The two times' row keeps its place and shows nothing.
    expect(q(card(container)!, '[data-part="times"]')!.textContent).toBe("");
    // No count, no line, no percent: the words are the wait's and the clock's only.
    expect(container.querySelector('[data-result="count"], [data-result="curve"], [data-result="strip"]')).toBeNull();
    expect(container.textContent).toBe("Building your 1,000 viewers0:00");
    // Nothing under the card.
    expect(card(container)!.nextElementSibling).toBeNull();
  });

  it("the words and the clock lay out as the count does: one line from a box of 290, the clock under the words in a narrower one", () => {
    const { container, unmount } = renderRunning();
    const building = q(container, '[data-part="building"]')!;
    const classes = building.className.split(/\s+/);
    // Narrow box (a 320 phone): always two lines, so the box is as tall while it waits as it will be.
    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-col", "items-center"]));
    expect(classes).not.toContain("flex-wrap");
    // From 290: one line, on one baseline, centred.
    expect(classes).toEqual(
      expect.arrayContaining(["@min-[290px]:flex-row", "@min-[290px]:items-baseline", "@min-[290px]:justify-center"]),
    );
    // Measured against the box under the tile (the count's box), not the window.
    expect(building.parentElement!.getAttribute("data-part")).toBe("under");
    expect(building.parentElement!.className.split(/\s+/)).toContain("@container");
    // The words first, the clock second.
    expect(building.lastElementChild).toBe(clock(container));
    const waited = building.className;
    unmount();

    // The count that takes its place lays out the same way, class for class.
    const model = modelOf(early, { frames: true });
    const result = renderWithPlayhead(model, <VideoResult model={model} />);
    expect(q(result.container, '[data-result="count"]')!.className).toBe(waited);
  });

  it("the clock counts from the run's start", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    expect(clock(container).textContent).toBe("0:42");
    wait(1000);
    expect(clock(container).textContent).toBe("0:43");
  });

  it("without a known start, or with one ahead of this device's clock, it counts from the screen's opening", () => {
    const unknown = renderRunning(null);
    wait(5000);
    expect(clock(unknown.container).textContent).toBe("0:05");
    unknown.unmount();

    const ahead = renderRunning(Date.now() + 60_000);
    wait(5000);
    expect(clock(ahead.container).textContent).toBe("0:05");
  });

  it("the strip fills as the frames arrive: each at its scene, hidden until its picture loaded, then a short fade and settle", () => {
    const { container } = renderRunning();
    sendFrame(2);
    const third = tiles(container)[2]!;
    const img = third.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://f/2.jpg");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.className).toMatch(/\bopacity-0\b/);
    expect(third.hasAttribute("data-filled")).toBe(false);
    expect(third.querySelector('[data-part="shimmer"]')).not.toBeNull();

    fireEvent.load(img);
    expect(third.hasAttribute("data-filled")).toBe(true);
    expect(img.className).toContain("motion-safe:animate-[result-settle_");
    expect(img.className).not.toMatch(/\bopacity-0\b/);
    expect(third.querySelector('[data-part="shimmer"]')).toBeNull();
    for (const i of [0, 1, 3, 4, 5, 6]) expect(tiles(container)[i]!.querySelector("img")).toBeNull();
  });

  it("a frame of a later scene adds tiles up to it", () => {
    const { container } = renderRunning();
    sendFrame(8);
    expect(tiles(container)).toHaveLength(9);
    expect(q(container, '[data-result="running-strip"]')!.getAttribute("data-tiles")).toBe("9");
    expect(tiles(container)[8]!.querySelector("img")!.getAttribute("src")).toBe("https://f/8.jpg");
  });

  it("a broken event cannot draw the strip as a comb: never more tiles than a run has scenes", () => {
    const { container } = renderRunning();
    sendFrame(40);
    expect(tiles(container)).toHaveLength(24);
    expect(q(container, '[data-result="running-strip"]')!.getAttribute("data-tiles")).toBe("24");
  });

  it("a strip frame that cannot load: its tile settles empty and still, without the shimmer's promise", () => {
    const { container } = renderRunning();
    sendFrame(2);
    const third = () => tiles(container)[2]!;
    fireEvent.error(third().querySelector("img")!);
    expect(third().querySelector("img")).toBeNull();
    expect(third().querySelector('[data-part="shimmer"]')).toBeNull();
    expect(third().hasAttribute("data-filled")).toBe(false);
    expect(third().hasAttribute("data-failed")).toBe(true);
    // The other tiles still wait.
    expect(tiles(container)[3]!.querySelector('[data-part="shimmer"]')).not.toBeNull();

    // The same scene under another address (a reconnect signs it anew) gets its chance.
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 2, keyframe_uri: "https://f/2.jpg?sig=b" }));
    expect(third().hasAttribute("data-failed")).toBe(false);
    fireEvent.load(third().querySelector("img")!);
    expect(third().hasAttribute("data-filled")).toBe(true);
  });

  it("a filled tile stays filled when its scene's frame comes again under a new address", () => {
    const { container } = renderRunning();
    sendFrame(2);
    const third = () => tiles(container)[2]!;
    fireEvent.load(third().querySelector("img")!);
    expect(third().hasAttribute("data-filled")).toBe(true);

    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 2, keyframe_uri: "https://f/2.jpg?sig=b" }));
    const img = third().querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://f/2.jpg?sig=b");
    expect(third().hasAttribute("data-filled")).toBe(true);
    expect(img.className).not.toMatch(/\bopacity-0\b/);
    expect(third().querySelector('[data-part="shimmer"]')).toBeNull();
  });

  it("the strip's tiles are equal and 3 apart, the strip 38 tall on a phone", () => {
    const { container } = renderRunning();
    const strip = q(container, '[data-result="running-strip"]')!;
    expect(strip.style.height).toBe("38px");
    expect(strip.style.gap).toBe("3px");
    for (const tile of tiles(container)) expect(tile.className).toMatch(/\bflex-1\b/);
  });

  it("the tile with no clip and no cover: the first frame that arrived, in scene order; a band of light sweeps down it", () => {
    const { container } = renderRunning();
    sendFrame(3);
    sendFrame(1);
    expect(shows(container)).toBe("frame");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe("https://f/1.jpg");
    expect(picture(container).querySelector("img")!.getAttribute("alt")).toBe("");
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();
  });

  it("a link run: the post's cover once the stream names it, before any frame; a cover that cannot load falls through to the frame", () => {
    const { container } = renderRunning();
    sendFrame(0);
    sendCover();
    expect(shows(container)).toBe("cover");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe(COVER);
    // The platform's host is not told which site asks.
    expect(picture(container).querySelector("img")!.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();

    fireEvent.error(picture(container).querySelector("img")!);
    expect(shows(container)).toBe("frame");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe("https://f/0.jpg");
  });

  it("remembers the run's picture for the result's player: the cover, else the first frame; under the creator's clip the first frame", () => {
    const view = renderRunning();
    expect(runStillOf("run-1")).toBeNull();
    sendFrame(3);
    expect(runStillOf("run-1")).toBe("https://f/3.jpg");
    sendFrame(0);
    expect(runStillOf("run-1")).toBe("https://f/0.jpg");
    sendCover();
    expect(runStillOf("run-1")).toBe(COVER);
    // A cover that cannot load is not what the result should stand on.
    fireEvent.error(picture(view.container).querySelector("img")!);
    expect(runStillOf("run-1")).toBe("https://f/0.jpg");
    view.unmount();

    forgetRunVideos();
    rememberRunVideo("run-1", "blob:clip-1");
    const withClip = renderRunning();
    expect(shows(withClip.container)).toBe("clip");
    sendFrame(0);
    expect(runStillOf("run-1")).toBe("https://f/0.jpg");
  });

  it("a run this tab started from a file: the creator's own clip, muted, looping, no controls, ahead of a cover or frames; no band over it", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();
    const video = picture(container).querySelector("video")!;
    expect(shows(container)).toBe("clip");
    expect(video.getAttribute("src")).toBe("blob:x");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(false);
    expect(q(picture(container), '[data-part="sweep"]')).toBeNull();

    sendCover();
    sendFrame(0);
    expect(shows(container)).toBe("clip");
    expect(picture(container).querySelector("img")).toBeNull();
  });

  it("a clip that cannot play falls through to the cover, and a cover that cannot load to the frame", () => {
    rememberRunVideo("run-1", "blob:revoked");
    const { container } = renderRunning();
    sendFrame(0);
    sendCover();
    fireEvent.error(picture(container).querySelector("video")!);
    expect(shows(container)).toBe("cover");
    fireEvent.error(picture(container).querySelector("img")!);
    expect(shows(container)).toBe("frame");
  });

  it("a clip the browser will not start by itself (a phone saving power) stands on its first frame, and is not dropped", async () => {
    HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error("refused"), { name: "NotAllowedError" }));
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();
    sendFrame(0);

    await act(async () => {});

    expect(shows(container)).toBe("clip");
    const video = picture(container).querySelector("video")!;
    expect(video.getAttribute("src")).toBe("blob:x#t=0.001");
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("preload")).toBe("metadata");
  });

  it("a clip that cannot play at all falls through", async () => {
    HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error("no source"), { name: "NotSupportedError" }));
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();

    await act(async () => {});

    expect(shows(container)).toBe("none");
    expect(picture(container).querySelector("video")).toBeNull();
  });

  it("the creator's clip is decoration: a screen reader does not meet an unnamed video", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();
    expect(picture(container).querySelector("video")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("a cover that cannot load, with nothing else to show: no picture is kept for the result", () => {
    const { container } = renderRunning();
    sendCover();
    expect(runStillOf("run-1")).toBe(COVER);
    fireEvent.error(picture(container).querySelector("img")!);
    expect(shows(container)).toBe("none");
    expect(runStillOf("run-1")).toBeNull();
  });

  it("no frame within the time frames take: the strip's tiles stop shimmering; the plot's band goes on", () => {
    const { container } = renderRunning(Date.now() - 19_000);
    expect(tiles(container).every((tile) => tile.querySelector('[data-part="shimmer"]') !== null)).toBe(true);
    wait(1000);
    expect(clock(container).textContent).toBe("0:20");
    expect(tiles(container).some((tile) => tile.querySelector('[data-part="shimmer"]') !== null)).toBe(false);
    expect(q(container, '[data-part="scan"]')).not.toBeNull();
  });

  it("with a frame in, the empty tiles go on shimmering however long the run takes", () => {
    const { container } = renderRunning(Date.now() - 40_000);
    sendFrame(0);
    fireEvent.load(tiles(container)[0]!.querySelector("img")!);
    expect(tiles(container)[0]!.querySelector('[data-part="shimmer"]')).toBeNull();
    expect(tiles(container)[3]!.querySelector('[data-part="shimmer"]')).not.toBeNull();
  });

  it("with reduced motion: the clip does not start by itself (its first frame shows), and nothing else moves", () => {
    prefersReducedMotion(true);
    const play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.play = play;
    rememberRunVideo("run-1", "blob:x");
    const withClip = renderRunning();
    const video = picture(withClip.container).querySelector("video")!;
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("src")).toMatch(/^blob:x/);
    expect(video.muted).toBe(true);
    expect(play).not.toHaveBeenCalled();
    for (const name of ["sweep", "scan", "shimmer"]) expect(q(withClip.container, `[data-part="${name}"]`)).toBeNull();
    withClip.unmount();

    forgetRunVideos();
    const still = renderRunning();
    expect(shows(still.container)).toBe("none");
    expect(q(still.container, '[data-part="sweep"]')).toBeNull();
  });

  it("every motion is motion-safe", () => {
    const { container } = renderRunning();
    const animated = [...container.querySelectorAll("[class*='animate-']")];
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) {
      for (const name of el.getAttribute("class")!.split(/\s+/).filter((c) => c.includes("animate-"))) {
        expect(name).toMatch(/^motion-safe:animate-\[result-/);
      }
    }
  });

  it("the roster is read and drawn nowhere", () => {
    const { container } = renderRunning();
    const before = container.innerHTML;
    act(() => stream().send("roster", { personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}` })) }));
    expect(container.innerHTML).toBe(before);
    expect(container.querySelector("[data-wedge], [data-result='running-ring']")).toBeNull();
  });

  it("the finish asks for the stored row again at once", () => {
    const key = queryKeys.analysis.detail("run-1");
    client.setQueryData(key, { id: "run-1" });
    renderRunning();
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    act(() => stream().send("complete"));

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("is ink and greys only, with no percent", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    sendFrame(0);
    sendCover();
    expect(container.textContent).not.toMatch(/%/);
    for (const el of container.querySelectorAll("*")) {
      const look = ["class", "fill", "stroke", "style"].map((name) => el.getAttribute(name) ?? "").join(" ");
      expect(look).not.toMatch(/below|accent|coral/);
    }
  });

  it("leaving leaves no timer running", () => {
    const { unmount } = renderRunning();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the dev page's preview replaces the stream, the remembered video and the clock", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = render(
      <Running
        id="run-1"
        startedAt={Date.now()}
        preview={{ progress: { groups: null, frames: ["https://f/0.jpg", null], cover: null, done: false }, video: null, elapsed: 42 }}
      />,
      { wrapper },
    );
    expect(FakeEventSource.opened).toHaveLength(0);
    expect(clock(container).textContent).toBe("0:42");
    expect(shows(container)).toBe("frame");
    expect(tiles(container)[0]!.querySelector("img")!.getAttribute("src")).toBe("https://f/0.jpg");
    expect(picture(container).querySelector("video")).toBeNull();
  });

  it("the preview's cover", () => {
    const { container } = render(
      <Running id="run-1" startedAt={Date.now()} preview={{ progress: { groups: null, frames: [], cover: COVER, done: false }, elapsed: 0 }} />,
      { wrapper },
    );
    expect(shows(container)).toBe("cover");
  });
});

describe("on a wide window", () => {
  it("the result's two columns: the large tile with the words under it; the sentence's empty card, the line's card with the base, the band and the strip; no tabs, no panel", () => {
    setWidth(1440);
    const { container } = renderRunning();
    const root = card(container)!;
    const column = q(root, '[data-part="tile-column"]')!;
    expect(column.firstElementChild).toBe(picture(container));
    expect(picture(container).firstElementChild!.className).toMatch(/\brounded-3xl\b/);
    expect(q(column, '[data-part="building"]')).not.toBeNull();
    const sentence = q(root, '[data-result="sentence-card"]')!;
    expect(sentence.children).toHaveLength(0);
    expect(sentence.className).toContain("min-h-[158px]");
    const lineCard = q(root, '[data-part="line-card"]')!;
    expect(q(lineCard, '[data-part="base"]')).not.toBeNull();
    expect(q(lineCard, '[data-part="scan"]')).not.toBeNull();
    expect(q(lineCard, '[data-part="plot"]')!.style.height).toBe("104px");
    expect(q(lineCard, '[data-result="running-strip"]')!.style.height).toBe("46px");
    expect(container.querySelector('[role="tablist"], [role="tabpanel"]')).toBeNull();
    expect(q(root, '[data-part="after"]')).toBeNull();
  });
});

describe("the wait and the result share their boxes", () => {
  const PHONE_BOXES = ["tile-box", "under", "line-box", "line-frame", "plot", "strip-slot", "times"];
  const WIDE_BOXES = ["tile-column", "under", "line-card", "line-frame", "plot", "strip-slot", "times"];
  const boxesOf = (root: Element, names: string[]) =>
    names.map((name) => {
      const el = root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
      return [name, el.className, el.getAttribute("style")];
    });

  it("on a phone: the first card's boxes are the result's, class for class and size for size", () => {
    const wait = renderRunning();
    const waitCard = card(wait.container)!;
    const waited = {
      card: waitCard.className,
      boxes: boxesOf(waitCard, PHONE_BOXES),
      tile: picture(wait.container).className,
      strip: q(waitCard, '[data-result="running-strip"]')!.style.height,
    };
    wait.unmount();

    const model = modelOf(early, { frames: true });
    const result = renderWithPlayhead(model, <VideoResult model={model} />);
    const hero = q(result.container, '[data-result="hero"]')!;
    expect(hero.className).toBe(waited.card);
    expect(boxesOf(hero, PHONE_BOXES)).toEqual(waited.boxes);
    expect(q(hero, '[data-result="video"]')!.className).toBe(waited.tile);
    expect(q(hero, '[data-result="strip"]')!.style.height).toBe(waited.strip);
  });

  it("on a wide window: the columns, the sentence's card and the line's card are the result's", () => {
    setWidth(1440);
    const wait = renderRunning();
    const root = card(wait.container)!;
    const waited = {
      grid: q(root, '[data-part="tile-column"]')!.parentElement!.className,
      sentence: q(root, '[data-result="sentence-card"]')!.className,
      boxes: boxesOf(root, WIDE_BOXES),
      tile: picture(wait.container).className,
    };
    wait.unmount();

    const model = modelOf(early, { frames: true });
    const result = renderWithPlayhead(model, <VideoResult model={model} />);
    const column = q(result.container, '[data-part="tile-column"]')!;
    expect(column.parentElement!.className).toBe(waited.grid);
    expect(q(result.container, '[data-result="sentence-card"]')!.className).toBe(waited.sentence);
    expect(boxesOf(column.parentElement!.parentElement!, WIDE_BOXES)).toEqual(waited.boxes);
    expect(q(column, '[data-result="video"]')!.className).toBe(waited.tile);
  });
});
