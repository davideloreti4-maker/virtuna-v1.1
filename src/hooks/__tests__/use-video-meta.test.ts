/** @vitest-environment happy-dom */

/**
 * `useVideoMeta` — a video's length and a still frame, read in the browser before upload.
 *
 * Stand-ins are browser APIs only: object URLs (happy-dom has no blob store), the video
 * element's media events (happy-dom never decodes media) and the 2D canvas (happy-dom draws
 * nothing). The hook itself runs for real.
 *
 * The revoke cases matter most: an object URL that is never revoked pins the whole file in
 * memory for the life of the tab, and a creator may pick several 200 MB takes in one session.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useVideoMeta } from "@/hooks/use-video-meta";

let created: string[];
let revoked: string[];
let videos: HTMLVideoElement[];

beforeEach(() => {
  created = [];
  revoked = [];
  videos = [];
  let n = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    const url = `blob:test/${++n}`;
    created.push(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
    revoked.push(url);
  });
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
    const el = realCreate(tag, opts);
    if (tag === "video") videos.push(el as HTMLVideoElement);
    return el;
  }) as typeof document.createElement);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** What the browser does once it has decoded enough of the file. */
function fireLoaded(video: HTMLVideoElement, duration: number) {
  Object.defineProperty(video, "duration", { value: duration, configurable: true });
  act(() => {
    video.onloadeddata?.(new Event("loadeddata"));
  });
}

function fireSeeked(video: HTMLVideoElement) {
  Object.defineProperty(video, "videoWidth", { value: 1080, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 1920, configurable: true });
  act(() => {
    video.onseeked?.(new Event("seeked"));
  });
}

const clip = () => new File(["x"], "clip.mp4", { type: "video/mp4" });

describe("useVideoMeta", () => {
  it("returns nulls for no file and makes no object URL", () => {
    const { result } = renderHook(() => useVideoMeta(null));
    expect(result.current).toEqual({ durationSec: null, thumbnail: null });
    expect(created).toEqual([]);
  });

  it("reads the duration once the video has loaded, then a frame once it has seeked", () => {
    const drawImage = vi.fn();
    // `getContext` is overloaded; the spy types it by its last (WebGPU) overload, hence `never`.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AA");

    // One File for the hook's whole life, as a component holding it in state passes it.
    const file = clip();
    const { result } = renderHook(() => useVideoMeta(file));
    expect(result.current).toEqual({ durationSec: null, thumbnail: null });

    const video = videos[0]!;
    expect(video.src).toBe(created[0]);

    fireLoaded(video, 12.5);
    expect(result.current.durationSec).toBe(12.5);
    // It seeks a little way in so the frame is not a black first frame.
    expect(video.currentTime).toBe(0.5);

    fireSeeked(video);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1080, 1920);
    expect(result.current).toEqual({ durationSec: 12.5, thumbnail: "data:image/jpeg;base64,AA" });
    expect(revoked).toContain(created[0]);
  });

  it("revokes its object URL on unmount", () => {
    const file = clip();
    const { unmount } = renderHook(() => useVideoMeta(file));
    expect(created).toHaveLength(1);
    expect(revoked).toEqual([]);

    unmount();
    expect(revoked).toContain(created[0]);
  });

  it("revokes the old URL when the file changes, and resets to nulls when it is cleared", () => {
    const { result, rerender } = renderHook(({ file }) => useVideoMeta(file), {
      initialProps: { file: clip() as File | null },
    });
    fireLoaded(videos[0]!, 30);
    expect(result.current.durationSec).toBe(30);

    rerender({ file: clip() });
    // The new file's length is not known yet: never show the old file's under the new one.
    expect(result.current).toEqual({ durationSec: null, thumbnail: null });
    expect(created).toHaveLength(2);
    expect(revoked).toContain(created[0]);
    expect(revoked).not.toContain(created[1]);

    rerender({ file: null });
    expect(revoked).toContain(created[1]);
    expect(result.current).toEqual({ durationSec: null, thumbnail: null });
  });
});
