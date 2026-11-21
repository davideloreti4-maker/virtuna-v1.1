/** @vitest-environment happy-dom */
/**
 * The video tile (plan Task 3, spec §5 "Player"): the video when its file is stored, else the frame
 * of the scene under the playhead, else a quiet tile with the clip's length. Real components, the
 * real playhead and happy-dom's media element; only the network (the signing endpoint) is stood in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { Player } from "../player";
import { FRAME_BASE, modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const SIGNED = "https://videos.test/clip.mp4";

function stubSign(status: 200 | 404) {
  const fetchMock = vi.fn(async (url: string) => {
    if (!String(url).startsWith("/api/videos/sign")) throw new Error(`unexpected request ${url}`);
    return status === 200
      ? new Response(JSON.stringify({ url: SIGNED }), { status: 200 })
      : new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

const tile = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-result="video"]')!;

describe("no file", () => {
  it("no frames either: a quiet tile with the clip's length, nothing to press", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    expect(tile(container)).toHaveTextContent("0:29");
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("video, img")).toBeNull();
  });

  it("with frames: the frame of the scene under the playhead (the first at rest)", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    const src = () => container.querySelector("img")!.getAttribute("src");
    expect(src()).toBe(`${FRAME_BASE}/0.jpg`);
    act(() => playhead.current.seek(8));
    expect(src()).toBe(`${FRAME_BASE}/3.jpg`);
    act(() => playhead.current.seek(2.5));
    expect(src()).toBe(`${FRAME_BASE}/1.jpg`);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sizes: 104 wide in the phone hero, the column on desktop, 62 in the compact player", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Player model={model} size="hero" />
        <Player model={model} size="desktop" />
        <Player model={model} size="compact" />
      </>,
    );
    const [hero, desk, compact] = [...container.querySelectorAll<HTMLElement>('[data-result="video"]')];
    expect(hero!.className).toMatch(/w-\[104px\]/);
    expect(hero!.className).toMatch(/aspect-\[9\/16\]/);
    expect(desk!.className).toMatch(/w-full/);
    expect(compact!.className).toMatch(/w-\[62px\]/);
  });
});

describe("with a file", () => {
  it("the video, registered with the playhead; tapping it plays and pauses; the mark shows while paused", async () => {
    stubSign(200);
    const model = modelOf(early, { frames: true, videoPath: "user-1/clip.mp4" });
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toContain(SIGNED);
    expect(video.muted).toBe(false);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("poster")).toBe(`${FRAME_BASE}/0.jpg`);
    await waitFor(() => expect(playhead.current.canPlay).toBe(true));

    const button = screen.getByRole("button", { name: "Play" });
    // The glass circle of the reference: blurred (an inline style, the only glass on the page).
    expect(button.querySelector('[data-part="mark"]')!.getAttribute("style")).toMatch(/blur\(14px\)/);
    await act(async () => fireEvent.click(button));
    expect(playhead.current.playing).toBe(true);
    expect(video.paused).toBe(false);
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause.querySelector('[data-part="mark"]')).toBeNull();
    await act(async () => fireEvent.click(pause));
    expect(playhead.current.playing).toBe(false);
  });

  it("back at rest the video shows its first frame", async () => {
    stubSign(200);
    const model = modelOf(early, { videoPath: "user-1/clip.mp4" });
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    await waitFor(() => expect(playhead.current?.canPlay).toBe(true));
    const video = container.querySelector("video")!;
    await act(async () => playhead.current.playFrom(24));
    // A browser at the end of a video: paused, a `pause` event, then `ended`.
    act(() => {
      video.currentTime = 29;
      video.pause();
      video.dispatchEvent(new Event("ended"));
    });
    expect(playhead.current.resting).toBe(true);
    expect(video.currentTime).toBe(0);
  });

  it("End while it plays lands at rest, even when the browser's `pause` event arrives after the rest frame", async () => {
    stubSign(200);
    const model = modelOf(early, { videoPath: "user-1/clip.mp4" });
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    await waitFor(() => expect(playhead.current?.canPlay).toBe(true));
    const video = container.querySelector("video")!;
    await act(async () => playhead.current.playFrom(5));
    expect(playhead.current.playing).toBe(true);

    act(() => playhead.current.seek(29));
    // A browser queues the `pause` event: it runs after the page went to rest and the video was
    // set back to its first frame (happy-dom fires it at once, so it is replayed here).
    act(() => {
      video.currentTime = 0;
      video.dispatchEvent(new Event("pause"));
    });
    expect(playhead.current.t).toBe(29);
    expect(playhead.current.resting).toBe(true);
    expect(video.currentTime).toBe(0);

    // From rest, play starts at 0:00.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(playhead.current.t).toBe(0);
    expect(playhead.current.playing).toBe(true);
  });

  it("desktop: only a play button on the video, there while it plays too", async () => {
    stubSign(200);
    const model = modelOf(early, { videoPath: "user-1/clip.mp4" });
    renderWithPlayhead(model, <Player model={model} size="desktop" />);
    await waitFor(() => expect(playhead.current?.canPlay).toBe(true));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(screen.getByRole("button", { name: "Pause" }).querySelector('[data-part="mark"]')).not.toBeNull();
  });

  it("the file is gone (404): the frame of the scene instead, nothing to press", async () => {
    const fetchMock = stubSign(404);
    const model = modelOf(early, { frames: true, videoPath: "user-1/gone.mp4" });
    const { container } = renderWithPlayhead(model, <Player model={model} size="hero" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the compact player shows the frame and drives the page's one video (it has none of its own)", async () => {
    stubSign(200);
    const model = modelOf(early, { frames: true, videoPath: "user-1/clip.mp4" });
    const { container } = renderWithPlayhead(
      model,
      <>
        <Player model={model} size="hero" />
        <Player model={model} size="compact" />
      </>,
    );
    await waitFor(() => expect(playhead.current?.canPlay).toBe(true));
    expect(container.querySelectorAll("video")).toHaveLength(1);
    const compact = container.querySelectorAll<HTMLElement>('[data-result="video"]')[1]!;
    expect(compact.querySelector("img")!.getAttribute("src")).toBe(`${FRAME_BASE}/0.jpg`);
    await act(async () => fireEvent.click(compact.querySelector("button")!));
    expect(playhead.current.playing).toBe(true);
    expect(container.querySelector("video")!.paused).toBe(false);
  });
});
