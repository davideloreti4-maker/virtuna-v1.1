/** @vitest-environment happy-dom */
/**
 * The shared playhead (plan Task 2): at rest at the clip's end; play starts from 0:00; seek and
 * step move it with or without a video; with a video attached it drives the video and follows it.
 * The provider and the video element are real (happy-dom's media element), nothing is stood in.
 */
import { afterEach, describe, expect, it } from "vitest";
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { audienceOf } from "@/lib/result/curve";
import type { ResultRow } from "@/lib/result/types";
import early from "@/lib/result/__tests__/fixtures/early.json";
import { PlayheadProvider, usePlayhead, type Playhead } from "../playhead";

const { scenes, clipS } = audienceOf(early as unknown as ResultRow)!;

let current: Playhead;
function Probe() {
  const playhead = usePlayhead();
  useEffect(() => {
    current = playhead;
  });
  return null;
}

function mount(withVideo: "none" | "source" | "empty" = "none") {
  let video: HTMLVideoElement | null = null;
  function Video() {
    const { attachVideo } = usePlayhead();
    return withVideo === "none" ? null : (
      <video
        ref={(el) => {
          video = el;
          attachVideo(el);
        }}
        src={withVideo === "source" ? "https://videos.test/clip.mp4" : undefined}
      />
    );
  }
  const view = render(
    <PlayheadProvider clipS={clipS} scenes={scenes}>
      <Video />
      <Probe />
    </PlayheadProvider>,
  );
  return { view, video: () => video! };
}

afterEach(() => {
  current = undefined as unknown as Playhead;
});

describe("without a video", () => {
  it("rests at the clip's end", () => {
    mount();
    expect(current.t).toBe(29);
    expect(current.playing).toBe(false);
    expect(current.resting).toBe(true);
    expect(current.canPlay).toBe(false);
  });

  it("play does nothing; seek and step still move the playhead", () => {
    mount();
    act(() => current.play());
    expect(current.playing).toBe(false);
    expect(current.t).toBe(29);

    act(() => current.seek(2.5));
    expect(current.t).toBe(2.5);
    expect(current.resting).toBe(false);

    act(() => current.step(1));
    expect(current.t).toBe(3);
    act(() => current.step(-1));
    expect(current.t).toBe(2);

    act(() => current.seek(40));
    expect(current.t).toBe(29);
    expect(current.resting).toBe(true);

    act(() => current.step(-1));
    expect(current.t).toBe(24);
    act(() => current.seek(-3));
    expect(current.t).toBe(0);
  });

  it("an element with no source does not count as a video", () => {
    mount("empty");
    expect(current.canPlay).toBe(false);
  });
});

describe("with a video", () => {
  it("can play once a video with a source is attached", () => {
    mount("source");
    expect(current.canPlay).toBe(true);
  });

  it("play from rest starts at 0:00 and plays the video", async () => {
    const { video } = mount("source");
    video().currentTime = 12;
    await act(async () => current.play());
    expect(current.playing).toBe(true);
    expect(current.resting).toBe(false);
    expect(current.t).toBe(0);
    expect(video().currentTime).toBe(0);
    expect(video().paused).toBe(false);
  });

  it("seek sets the video's time; pause stops both", async () => {
    const { video } = mount("source");
    act(() => current.seek(7));
    expect(video().currentTime).toBe(7);

    await act(async () => current.play());
    expect(current.t).toBe(7);
    expect(current.playing).toBe(true);

    act(() => current.pause());
    expect(current.playing).toBe(false);
    expect(video().paused).toBe(true);
    expect(current.t).toBe(7);
  });

  it("playFrom seeks, then plays", async () => {
    const { video } = mount("source");
    await act(async () => current.playFrom(3));
    expect(current.t).toBe(3);
    expect(video().currentTime).toBe(3);
    expect(current.playing).toBe(true);
  });

  it("toggle plays and pauses", async () => {
    mount("source");
    await act(async () => current.toggle());
    expect(current.playing).toBe(true);
    await act(async () => current.toggle());
    expect(current.playing).toBe(false);
  });

  it("when the video ends, the playhead goes back to rest", async () => {
    const { video } = mount("source");
    await act(async () => current.playFrom(24));
    act(() => {
      video().dispatchEvent(new Event("ended"));
    });
    expect(current.t).toBe(29);
    expect(current.playing).toBe(false);
    expect(current.resting).toBe(true);
  });

  it("a pause from the video itself (the system, another control) stops the playhead", async () => {
    const { video } = mount("source");
    await act(async () => current.playFrom(3));
    act(() => video().pause());
    expect(current.playing).toBe(false);
  });

  it("a play from the video itself (another control) starts the playhead where the video is", async () => {
    const { video } = mount("source");
    act(() => current.seek(7));
    await act(async () => {
      await video().play();
    });
    expect(current.playing).toBe(true);
    expect(current.t).toBe(7);
  });

  it("detaching the video stops play and makes it unplayable", async () => {
    const { view } = mount("source");
    await act(async () => current.playFrom(3));
    view.rerender(
      <PlayheadProvider clipS={clipS} scenes={scenes}>
        <Probe />
      </PlayheadProvider>,
    );
    expect(current.canPlay).toBe(false);
    expect(current.playing).toBe(false);
  });
});

describe("outside the provider", () => {
  it("usePlayhead says where it belongs", () => {
    expect(() => render(<Probe />)).toThrow(/PlayheadProvider/);
  });
});
