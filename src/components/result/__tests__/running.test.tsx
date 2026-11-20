/** @vitest-environment happy-dom */
/**
 * The running screen (plan 2026-11-20 slice B, Task 3): the ring of the viewer groups, the picture
 * and the clock, from the run's own stream. Stood in for: the browser's EventSource (a small
 * working one that hands out named events, as in use-run-stream.test.tsx), the clock (fake
 * timers) and the user's motion setting (matchMedia). The screen, the stream hook, the reading of
 * the events, the ring layout and the query client are real. Layout does not run here, so the
 * stage's measured size comes from a stand-in ResizeObserver (default: the reference desktop's
 * content area, 1192 x 832), and the browser's autoplay answer from `play()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/queries/query-keys";
import { forgetRunVideos, rememberRunVideo } from "@/lib/result/run-video";
import { Running } from "../running";

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
const roster = { personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}`, label: `Group ${i}` })) };

const realMatchMedia = window.matchMedia;
type MediaListener = (event: { matches: boolean }) => void;
let mediaListeners: MediaListener[] = [];
/** The user's motion setting, as the browser reports it. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("no-preference") ? !reduce : reduce,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: MediaListener) => mediaListeners.push(listener),
    removeEventListener: (_type: string, listener: MediaListener) => {
      mediaListeners = mediaListeners.filter((l) => l !== listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
/** The user changes the setting while the screen is open (the hook listens to the no-preference query). */
function switchReducedMotion(reduce: boolean) {
  prefersReducedMotion(reduce);
  act(() => mediaListeners.forEach((listener) => listener({ matches: !reduce })));
}

/** The stage's measured content box, as a ResizeObserver reports it. */
let stageSize = { width: 1192, height: 832 };
class FakeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: { ...stageSize } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const renderRunning = (startedAt: number | null = Date.now()) =>
  render(<Running id="run-1" startedAt={startedAt} />, { wrapper });

const ring = (c: HTMLElement) => c.querySelector('[data-result="running-ring"]');
const wedges = (c: HTMLElement) => c.querySelectorAll("[data-wedge]");
const clock = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="running-clock"]');
const picture = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="running-picture"]');
/** The frame on top: the one shown (the one before it may still lie under it while it fades in). */
const shownFrame = (c: HTMLElement) => picture(c)?.querySelector<HTMLImageElement>('img[data-frame="current"]');

/** Lets the timers run as far as `ms`, inside React's act. */
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/**
 * The browser loading images, stood in for: an <img> fires `load` once for each address it is
 * given (a node that keeps its address does not load again).
 */
let loadedAs = new WeakMap<Element, string>();
function loadImages(c: HTMLElement) {
  for (const img of picture(c)?.querySelectorAll("img") ?? []) {
    const src = img.getAttribute("src") ?? "";
    if (loadedAs.get(img) === src) continue;
    loadedAs.set(img, src);
    fireEvent.load(img);
  }
}
/** The frame a viewer sees: the topmost image of the picture that is not held transparent. */
function visibleFrame(c: HTMLElement): string | null {
  const layers = [...(picture(c)?.querySelectorAll("img") ?? [])].filter((img) => !img.classList.contains("opacity-0"));
  return layers.at(-1)?.getAttribute("src") ?? null;
}
/** Frames 0 to n-1 arrive on the stream and their images load. */
function framesArrive(c: HTMLElement, n: number) {
  for (let i = 0; i < n; i++) {
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: i, keyframe_uri: `https://f/${i}.jpg` }));
  }
  loadImages(c);
}
/** The picture a viewer sees at 0, 3, 6, 9 s. */
function seenEveryThreeSeconds(c: HTMLElement, steps: number): Array<string | null> {
  const seen = [visibleFrame(c)];
  for (let i = 1; i < steps; i++) {
    wait(3000);
    loadImages(c);
    seen.push(visibleFrame(c));
  }
  return seen;
}

const realPlay = HTMLMediaElement.prototype.play;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") });
  loadedAs = new WeakMap();
  FakeEventSource.opened = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  stageSize = { width: 1192, height: 832 };
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  mediaListeners = [];
  prefersReducedMotion(false);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  HTMLMediaElement.prototype.play = realPlay;
  forgetRunVideos();
  client.clear();
});

describe("Running", () => {
  it("just opened: no wedge, the clock at 0:00 inside the ring, no picture, no other words", () => {
    const { container } = renderRunning();

    expect(ring(container)).not.toBeNull();
    expect(wedges(container)).toHaveLength(0);
    expect(clock(container)?.textContent).toBe("0:00");
    expect(clock(container)?.getAttribute("data-clock")).toBe("centre");
    expect(picture(container)).toBeNull();
    // The clock is not announced every second. The screen is named once, by the page's heading
    // ("Simulating", the shell's on the phone, ResultHeader's on desktop): no second announcement here.
    expect(clock(container)?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect((container.textContent ?? "").replace("0:00", "").trim()).toBe("");
  });

  it("the clock counts from the run's start", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    expect(clock(container)?.textContent).toBe("0:42");

    wait(1000);
    expect(clock(container)?.textContent).toBe("0:43");
  });

  it("the groups arrive one wedge at a time once the roster is in", () => {
    const { container } = renderRunning();

    act(() => stream().send("roster", roster));
    expect(wedges(container).length).toBeLessThan(10);

    wait(600);
    expect(wedges(container)).toHaveLength(10);
  });

  it("the wedges arrive farthest first, so no two of the first four touch", () => {
    const { container } = renderRunning();
    act(() => stream().send("roster", roster));

    wait(240);
    const drawn = [...wedges(container)].map((w) => Number(w.getAttribute("data-wedge"))).sort((a, b) => a - b);
    expect(drawn).toEqual([0, 2, 5, 7]);
    for (const a of drawn) {
      for (const b of drawn) {
        if (a !== b) expect(Math.min(Math.abs(a - b), 10 - Math.abs(a - b))).toBeGreaterThan(1);
      }
    }
  });

  it.each([8, 12])("a roster of %i groups draws that many wedges", (n) => {
    const { container } = renderRunning();
    act(() => stream().send("roster", { personas: Array.from({ length: n }, (_, i) => ({ archetype: `group-${i}` })) }));

    wait(60 * n);
    expect(wedges(container)).toHaveLength(n);
  });

  it("leaving in the middle of the arrival leaves no timer running", () => {
    const { unmount } = renderRunning();
    act(() => stream().send("roster", roster));
    wait(120);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("with reduced motion the groups are all there at once", () => {
    prefersReducedMotion(true);
    const { container } = renderRunning();

    act(() => stream().send("roster", roster));

    expect(wedges(container)).toHaveLength(10);
  });

  it("wedges once shown stay when the motion setting changes while the screen is open", () => {
    prefersReducedMotion(true);
    const { container } = renderRunning();
    act(() => stream().send("roster", roster));
    expect(wedges(container)).toHaveLength(10);

    switchReducedMotion(false);

    expect(wedges(container)).toHaveLength(10);
  });

  it("frames arrive: the picture shows them one after another and the clock moves under the ring", () => {
    const { container } = renderRunning();
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));

    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/0.jpg");
    expect(shownFrame(container)?.getAttribute("alt")).toBe("");
    expect(clock(container)?.getAttribute("data-clock")).toBe("below");

    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 1, keyframe_uri: "https://f/1.jpg" }));
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/0.jpg");

    wait(3000);
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/1.jpg");
  });

  it("two frames take turns: 0, 1, 0, 1 at 0, 3, 6 and 9 s", () => {
    const { container } = renderRunning();
    framesArrive(container, 2);

    expect(seenEveryThreeSeconds(container, 4)).toEqual(["https://f/0.jpg", "https://f/1.jpg", "https://f/0.jpg", "https://f/1.jpg"]);
  });

  it("one frame alone stays visible", () => {
    const { container } = renderRunning();
    framesArrive(container, 1);

    expect(seenEveryThreeSeconds(container, 3)).toEqual(["https://f/0.jpg", "https://f/0.jpg", "https://f/0.jpg"]);
  });

  it("three frames come back to the first at 9 s", () => {
    const { container } = renderRunning();
    framesArrive(container, 3);

    expect(seenEveryThreeSeconds(container, 4)).toEqual(["https://f/0.jpg", "https://f/1.jpg", "https://f/2.jpg", "https://f/0.jpg"]);
  });

  it("a new frame fades in only once its image has loaded, over the frame before it", () => {
    const { container } = renderRunning();
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 1, keyframe_uri: "https://f/1.jpg" }));
    fireEvent.load(shownFrame(container)!);
    expect(shownFrame(container)?.hasAttribute("data-loaded")).toBe(true);

    wait(3000);
    const next = shownFrame(container)!;
    expect(next.getAttribute("src")).toBe("https://f/1.jpg");
    // Not loaded yet: hidden, no fade started, the first frame still showing under it.
    expect(next.hasAttribute("data-loaded")).toBe(false);
    expect(next.className).not.toMatch(/fade-in/);
    expect(picture(container)?.querySelector('img[data-frame="previous"]')?.getAttribute("src")).toBe("https://f/0.jpg");

    fireEvent.load(next);
    expect(next.hasAttribute("data-loaded")).toBe(true);
    expect(next.className).toMatch(/motion-safe:fade-in/);
    expect(picture(container)?.querySelector('img[data-frame="previous"]')?.getAttribute("src")).toBe("https://f/0.jpg");
  });

  it("with reduced motion the first frame stays", () => {
    prefersReducedMotion(true);
    const { container } = renderRunning();
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 1, keyframe_uri: "https://f/1.jpg" }));

    wait(3000);
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/0.jpg");
  });

  it("a run this device started plays the creator's own video, muted and looping, frames or not", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();

    const video = picture(container)?.querySelector("video");
    expect(video?.getAttribute("src")).toBe("blob:x");
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(video?.hasAttribute("controls")).toBe(false);
    expect(clock(container)?.getAttribute("data-clock")).toBe("below");

    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    expect(picture(container)?.querySelector("img")).toBeNull();
  });

  it("with reduced motion the creator's video does not start by itself: its first frame shows", () => {
    prefersReducedMotion(true);
    const play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.play = play;
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();

    const video = picture(container)!.querySelector("video")!;
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("src")).toMatch(/^blob:x/);
    expect(video.muted).toBe(true);
    expect(play).not.toHaveBeenCalled();
  });

  it("a video that cannot play falls back to the frames", () => {
    rememberRunVideo("run-1", "blob:revoked");
    const { container } = renderRunning();
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));

    fireEvent.error(picture(container)!.querySelector("video")!);

    expect(picture(container)?.querySelector("video")).toBeNull();
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/0.jpg");
  });

  it("a video that cannot play, with no frame yet: no picture, the clock back in the centre", () => {
    rememberRunVideo("run-1", "blob:revoked");
    const { container } = renderRunning();
    expect(clock(container)?.getAttribute("data-clock")).toBe("below");

    fireEvent.error(picture(container)!.querySelector("video")!);

    expect(picture(container)).toBeNull();
    expect(clock(container)?.getAttribute("data-clock")).toBe("centre");
  });

  it("a video the browser will not autoplay falls back too", async () => {
    HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error("refused"), { name: "NotAllowedError" }));
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();

    await act(async () => {});

    expect(picture(container)).toBeNull();
    expect(clock(container)?.getAttribute("data-clock")).toBe("centre");
  });

  it("without a known start, or with one ahead of this device's clock, it counts from the screen's opening", () => {
    const unknown = renderRunning(null);
    wait(5000);
    expect(clock(unknown.container)?.textContent).toBe("0:05");
    unknown.unmount();

    const ahead = renderRunning(Date.now() + 60_000);
    wait(5000);
    expect(clock(ahead.container)?.textContent).toBe("0:05");
  });

  it("the frames turn without a known start too", () => {
    const { container } = renderRunning(null);
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 1, keyframe_uri: "https://f/1.jpg" }));

    wait(3000);
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/1.jpg");
  });

  it("a short stage (a 1366 x 768 laptop) takes the small ring and keeps the clock inside it", () => {
    stageSize = { width: 1118, height: 589 };
    const { container } = renderRunning();
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));

    const box = Number(ring(container)?.getAttribute("width"));
    expect(box).toBe(360);
    // The ring is centred in the stage; the clock (36 tall: text-4xl at leading 1) hangs under it.
    const clockBottom = (stageSize.height - box) / 2 + parseFloat(clock(container)!.style.top) + 36;
    expect(clockBottom).toBeLessThanOrEqual(stageSize.height);
  });

  it("a tall wide stage takes the large ring", () => {
    const { container } = renderRunning();
    expect(Number(ring(container)?.getAttribute("width"))).toBe(540);
  });

  it("a stage narrower than the small ring and its gutters scales the whole figure down", () => {
    stageSize = { width: 320, height: 797 };
    const { container } = renderRunning();

    const figure = container.querySelector<HTMLElement>("[data-running-figure]")!;
    expect(Number(ring(container)?.getAttribute("width"))).toBe(360);
    expect(figure.style.width).toBe("304px");
    expect(figure.firstElementChild?.getAttribute("style")).toMatch(/scale\(0\.84/);
  });

  it("the finish asks for the stored row again at once", () => {
    const key = queryKeys.analysis.detail("run-1");
    client.setQueryData(key, { id: "run-1" });
    renderRunning();
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    act(() => stream().send("complete"));

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("is ink and greys only, with no percent and no word but the clock", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    act(() => stream().send("roster", roster));
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    wait(600);

    expect(wedges(container)).toHaveLength(10);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/%/);
    expect(text.replace("0:42", "").trim()).toBe("");
    for (const el of container.querySelectorAll("*")) {
      const look = ["class", "fill", "stroke", "style"].map((name) => el.getAttribute(name) ?? "").join(" ");
      expect(look).not.toMatch(/below|accent|coral/);
    }
  });

  it("the dev page's preview replaces the stream, the remembered video and the clock", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = render(
      <Running
        id="run-1"
        startedAt={Date.now()}
        preview={{
          progress: { groups: roster.personas.map((p) => p.archetype), frames: ["https://f/0.jpg", null], done: false },
          video: null,
          elapsed: 42,
        }}
      />,
      { wrapper },
    );

    expect(FakeEventSource.opened).toHaveLength(0);
    // A roster that is there when the screen opens is drawn whole.
    expect(wedges(container)).toHaveLength(10);
    expect(clock(container)?.textContent).toBe("0:42");
    expect(shownFrame(container)?.getAttribute("src")).toBe("https://f/0.jpg");
    expect(picture(container)?.querySelector("video")).toBeNull();
  });

  it("the preview can hold the arrival at its first wedges, for the dev page's picture of it", () => {
    const { container } = render(
      <Running
        id="run-1"
        startedAt={Date.now()}
        preview={{ progress: { groups: roster.personas.map((p) => p.archetype), frames: [], done: false }, arriving: 4 }}
      />,
      { wrapper },
    );

    wait(600);
    const drawn = [...wedges(container)].map((w) => Number(w.getAttribute("data-wedge")));
    expect(drawn.sort((a, b) => a - b)).toEqual([0, 2, 5, 7]);
  });
});
