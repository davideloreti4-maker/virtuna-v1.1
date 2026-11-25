/** @vitest-environment happy-dom */
/**
 * editor-stage.test.tsx — the video and its scrubber (plan 2026-11-24-editor-screens-a, Task 11; spec E8, E19): the device's own
 * copy plays at once before the cut; after it the real Player plays the edit with its controls off and ours over it; a tap plays
 * and pauses, the mute button mutes, the handle seeks; the film goes on playing through a seek; the one Player lasts through
 * every change of the edit; the scrubber seeks where it is pressed, with a ring at each thing to check. What happy-dom lacks as
 * a browser is stood in: fonts, the media element's play and pause, a box's size.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { filmFrames } from "@/lib/edit";
import { EditorScrubber, frameAtPointer } from "../editor-scrubber";
import { EditorStage, type StageHandle } from "../editor-stage";
import { ASSET, FIRST, changed } from "./views";

/** No captions: happy-dom loads no font to measure them with. */
const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);
const URLS = { [ASSET.id]: "https://media.test/preview.mp4" };
/** Where the Player keeps its volume, for the whole site. */
const KEPT_VOLUME = "remotion.volumePreference";

/** The names of the controls on the stage, in their order. */
const controls = () => screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
/** The Player's own element: another one if the Player was mounted again. */
const playerElement = () => document.querySelector(".__remotion-player");
/** Each name a control gave up from here on, in order: a name it had only for a moment is among them. */
function namesLeft(control: HTMLElement): () => (string | null)[] {
  const left: (string | null)[] = [];
  const read = (records: MutationRecord[]) => left.push(...records.map((record) => record.oldValue));
  const watch = new MutationObserver(read);
  watch.observe(control, { attributes: true, attributeFilter: ["aria-label"], attributeOldValue: true });
  return () => {
    read(watch.takeRecords());
    return left;
  };
}

class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
/**
 * What the Player says as it mounts in happy-dom, which is no browser: it has no canvas to draw the take on and no
 * AudioContext; and its note about its licence. True here, and not what is tested. Anything else it says is shown.
 */
const SAID_OF_HAPPY_DOM = ["MediaPlayer initialization failed", "AudioContext is not supported", "required to obtain a license to use Remotion"];
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
});
beforeEach(() => {
  vi.stubGlobal("FontFace", NoFontFace);
  vi.stubGlobal("fetch", async () => new Response(new ArrayBuffer(8)));
  for (const level of ["error", "warn"] as const) {
    const say = console[level].bind(console);
    vi.spyOn(console, level).mockImplementation((...told: unknown[]) => (told.some((one) => SAID_OF_HAPPY_DOM.some((known) => String(one).includes(known))) ? undefined : say(...told)));
  }
});
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(KEPT_VOLUME);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the stage before the cut", () => {
  const POSTER = "https://media.test/poster.jpg";
  const take = (source: string | null, handle?: React.Ref<StageHandle>) => <EditorStage ref={handle} edit={null} urls={{}} source={source} poster={POSTER} onFrame={() => {}} />;

  it("plays the device's own copy at once, with our controls over it", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const onFrame = vi.fn();
    const onFrames = vi.fn();
    render(<EditorStage edit={null} urls={{}} source="blob:local/1" poster={null} onFrame={onFrame} onFrames={onFrames} />);
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("src", "blob:local/1");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalled();
    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    Object.defineProperty(video, "duration", { configurable: true, value: 12.7 });
    fireEvent.loadedMetadata(video);
    expect(onFrames).toHaveBeenCalledWith(381);
    Object.defineProperty(video, "currentTime", { configurable: true, value: 2 });
    fireEvent.timeUpdate(video);
    expect(onFrame).toHaveBeenLastCalledWith(60);
  });

  it("shows the take's picture, and no control, while there is nothing to play", () => {
    render(<EditorStage edit={null} urls={{}} source={null} poster="https://media.test/poster.jpg" onFrame={() => {}} />);
    expect(document.querySelector("img")).toHaveAttribute("src", "https://media.test/poster.jpg");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Play again when the take is loaded from another address while it plays", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { rerender } = render(<EditorStage edit={null} urls={{}} source="blob:local/1" poster={null} onFrame={() => {}} />);
    const video = document.querySelector("video")!;
    fireEvent.play(video);
    expect(controls()).toEqual(["Pause", "Mute"]);
    // A browser that loads another address stops the element and tells it `emptied`, never `pause`.
    rerender(<EditorStage edit={null} urls={{}} source="https://media.test/preview.mp4" poster={null} onFrame={() => {}} />);
    expect(document.querySelector("video")).toBe(video);
    fireEvent.emptied(video);
    expect(controls()).toEqual(["Play", "Mute"]);
  });

  it("offers Play again when the take has played to its end", () => {
    render(take("blob:local/1"));
    const video = document.querySelector("video")!;
    fireEvent.play(video);
    expect(controls()).toEqual(["Pause", "Mute"]);
    fireEvent.ended(video);
    expect(controls()).toEqual(["Play", "Mute"]);
  });

  it("seeks, plays and pauses the take at the page's word", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const handle = createRef<StageHandle>();
    render(take("blob:local/1", handle));
    handle.current!.seek(60);
    expect(document.querySelector("video")!.currentTime).toBe(2);
    handle.current!.play();
    expect(play).toHaveBeenCalledTimes(1);
    handle.current!.pause();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("tells no length while the browser has none to give", () => {
    const onFrames = vi.fn();
    render(<EditorStage edit={null} urls={{}} source="blob:local/1" poster={null} onFrame={() => {}} onFrames={onFrames} />);
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { configurable: true, value: Infinity });
    fireEvent.loadedMetadata(video);
    expect(onFrames).not.toHaveBeenCalled();
  });

  it("starts another take at rest, its sound as the creator left it", () => {
    const { rerender } = render(take("blob:local/1"));
    const first = document.querySelector("video")!;
    fireEvent.play(first);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(controls()).toEqual(["Pause", "Unmute"]);
    rerender(take(null));
    expect(screen.queryByRole("button")).toBeNull();
    rerender(take("blob:local/2"));
    const second = document.querySelector("video")!;
    expect(second).not.toBe(first);
    expect(controls()).toEqual(["Play", "Unmute"]);
    expect(second.muted).toBe(true);
  });

  it("shows the take's picture, and no control, for an address this browser cannot play; another address is tried", () => {
    const { rerender } = render(take("blob:local/1"));
    fireEvent.error(document.querySelector("video")!);
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toHaveAttribute("src", POSTER);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(take("https://media.test/preview.mp4"));
    expect(document.querySelector("video")).toHaveAttribute("src", "https://media.test/preview.mp4");
    expect(controls()).toEqual(["Play", "Mute"]);
  });

  it("takes a refused play for what it is: nothing when the browser held it back, no take when it cannot play it", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(new DOMException("held back", "NotAllowedError"));
    render(take("blob:local/1"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(controls()).toEqual(["Play", "Mute"]);
    play.mockRejectedValueOnce(new DOMException("no decoder", "NotSupportedError"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the stage after the cut", () => {
  it("plays the edit in the Player with its controls off and ours over it; it seeks and mutes", async () => {
    const handle = createRef<StageHandle>();
    const onFrame = vi.fn();
    render(<EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={onFrame} />);
    expect(controls()).toEqual(["Play", "Mute"]);
    await act(async () => handle.current!.seek(30));
    expect(onFrame).toHaveBeenLastCalledWith(30);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mute" })));
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("plays and pauses at a tap, and at the page's word", async () => {
    const handle = createRef<StageHandle>();
    const onPlay = vi.fn();
    render(<EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} onPlay={onPlay} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(controls()).toEqual(["Pause", "Mute"]);
    expect(onPlay).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pause" })));
    expect(controls()).toEqual(["Play", "Mute"]);
    await act(async () => handle.current!.play());
    expect(controls()).toEqual(["Pause", "Mute"]);
    expect(onPlay).toHaveBeenCalledTimes(2);
    await act(async () => handle.current!.pause());
    expect(controls()).toEqual(["Play", "Mute"]);
  });

  describe("a seek made while it plays (the Player stops to seek, then plays on by itself)", () => {
    /** The film playing, started by a tap. */
    function playing() {
      const handle = createRef<StageHandle>();
      const onPlay = vi.fn();
      const onFrame = vi.fn();
      render(<EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={onFrame} onPlay={onPlay} />);
      const cover = screen.getByRole("button", { name: "Play" });
      return { stage: () => handle.current!, onPlay, onFrame, cover, left: namesLeft(cover) };
    }
    /** What stands once everything the Player still had to do is done. */
    const settled = () => act(async () => new Promise<void>((done) => setTimeout(done, 20)));

    it("goes on playing to the creator: the cover never offers Play, and it started once", async () => {
      const { stage, onPlay, onFrame, cover, left } = playing();
      await act(async () => fireEvent.click(cover));
      await act(async () => stage().seek(40));
      await act(async () => stage().seek(60));
      await settled();
      expect(onFrame).toHaveBeenCalledWith(40);
      expect(onFrame).toHaveBeenCalledWith(60);
      expect(controls()).toEqual(["Pause", "Mute"]);
      expect(left()).toEqual(["Play"]); // it gave up "Play" at the tap, and never "Pause"
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("stops at the film's end, where the Player does not play on", async () => {
      const { stage, onPlay, cover } = playing();
      await act(async () => fireEvent.click(cover));
      await act(async () => stage().seek(filmFrames(QUIET) - 1));
      await settled();
      expect(controls()).toEqual(["Play", "Mute"]);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("stops at the film's end, also when the seek there comes before the Player has played on from another", async () => {
      const { stage, onPlay, cover } = playing();
      await act(async () => fireEvent.click(cover));
      // A fast drag to the right end while it plays.
      await act(async () => {
        stage().seek(40);
        stage().seek(filmFrames(QUIET) - 1);
      });
      await settled();
      expect(controls()).toEqual(["Play", "Mute"]); // and it did not start over from the film's first frame
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("stops at the page's word given with the seek", async () => {
      const { stage, onPlay, cover } = playing();
      await act(async () => fireEvent.click(cover));
      await act(async () => {
        stage().seek(40);
        stage().pause();
      });
      await settled();
      expect(controls()).toEqual(["Play", "Mute"]);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("stops at a tap that comes before the Player has played on", async () => {
      const { stage, onPlay, cover } = playing();
      await act(async () => fireEvent.click(cover));
      await act(async () => {
        stage().seek(40);
        fireEvent.click(cover);
      });
      await settled();
      expect(controls()).toEqual(["Play", "Mute"]);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("plays on at the page's word given with the seek, and the next tap stops it for good", async () => {
      const { stage, onPlay, cover, left } = playing();
      await act(async () => fireEvent.click(cover));
      await act(async () => {
        stage().seek(40);
        stage().play();
      });
      await settled();
      expect(controls()).toEqual(["Pause", "Mute"]);
      expect(left()).toEqual(["Play"]);
      expect(onPlay).toHaveBeenCalledTimes(1);
      await act(async () => fireEvent.click(cover));
      await settled();
      expect(controls()).toEqual(["Play", "Mute"]);
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  it("stops for good at the film's end, also after a seek and the page's word to play", async () => {
    const handle = createRef<StageHandle>();
    const onPlay = vi.fn();
    render(<EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} onPlay={onPlay} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    // Four frames from the end, which it plays through here as in a browser.
    await act(async () => {
      handle.current!.seek(filmFrames(QUIET) - 4);
      handle.current!.play();
    });
    await waitFor(() => expect(controls()).toEqual(["Play", "Mute"]), { timeout: 3000 });
    await act(async () => new Promise<void>((done) => setTimeout(done, 50)));
    expect(controls()).toEqual(["Play", "Mute"]); // and it did not start again by itself
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("says whether it plays, playing on through a seek, and tells each start and stop once", async () => {
    const handle = createRef<StageHandle>();
    const onPlayingChange = vi.fn();
    render(<EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} onPlayingChange={onPlayingChange} />);
    expect(handle.current!.playing()).toBe(false);
    await act(async () => handle.current!.play());
    expect(handle.current!.playing()).toBe(true);
    // The Player stops to seek and plays on by itself: to the page it never stopped.
    await act(async () => handle.current!.seek(40));
    expect(handle.current!.playing()).toBe(true);
    await act(async () => new Promise<void>((done) => setTimeout(done, 20)));
    expect(handle.current!.playing()).toBe(true);
    await act(async () => handle.current!.pause());
    expect(handle.current!.playing()).toBe(false);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(handle.current!.playing()).toBe(true);
    expect(onPlayingChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("tells the take's start, and its stop when the cut takes its place", async () => {
    const onPlayingChange = vi.fn();
    const stage = (edit: typeof QUIET | null) => <EditorStage edit={edit} urls={URLS} source="blob:local/1" poster={null} onFrame={() => {}} onPlayingChange={onPlayingChange} />;
    const { rerender } = render(stage(null));
    fireEvent.play(document.querySelector("video")!);
    expect(onPlayingChange.mock.calls).toEqual([[true]]);
    await act(async () => rerender(stage(QUIET)));
    expect(onPlayingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("puts a word over the footage, top centre, that takes no tap, on the one Player", async () => {
    const stage = (badge: string | null) => <EditorStage edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} badge={badge} />;
    const { rerender } = render(stage(null));
    const mounted = playerElement();
    const box = document.getElementById("edit-stage")!;
    expect(within(box).queryByText("Original")).toBeNull();
    await act(async () => rerender(stage("Original")));
    const badge = within(box).getByText("Original");
    expect(badge).toHaveClass("pointer-events-none", "absolute", "top-3", "left-1/2", "h-[26px]", "rounded-full", "bg-scrim", "text-label");
    expect(controls()).toEqual(["Play", "Mute"]);
    expect(playerElement()).toBe(mounted);
    await act(async () => rerender(stage(null)));
    expect(within(box).queryByText("Original")).toBeNull();
    expect(playerElement()).toBe(mounted);
  });

  it("is promoted to the preview by a frame: placed by its styles, square, no shadow, no mute button, on the one Player", async () => {
    const handle = createRef<StageHandle>();
    const onFrame = vi.fn();
    const FRAME = { position: "fixed", left: -20, top: 0, width: 433, height: 770, zIndex: 400, clipPath: "inset(0px 20px 0px 20px)" } as const;
    const stage = (frame: React.CSSProperties | null) => <EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={onFrame} frame={frame} className="h-[var(--stage-h)]" />;
    const { rerender } = render(stage(null));
    const mounted = playerElement();
    const box = document.getElementById("edit-stage")!;
    expect(box).toHaveClass("rounded-[22px]", "shadow-[var(--shadow-float)]", "h-[var(--stage-h)]");
    expect(box.getAttribute("style")).toBeNull();

    await act(async () => rerender(stage(FRAME)));
    expect(document.getElementById("edit-stage")).toBe(box);
    expect(box.style.position).toBe("fixed");
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(["-20px", "0px", "433px", "770px"]);
    expect(box.style.zIndex).toBe("400");
    expect(box.style.clipPath).toBe("inset(0px 20px 0px 20px)");
    expect(box).toHaveClass("rounded-none", "shadow-none");
    expect(box).not.toHaveClass("rounded-[22px]");
    expect(box).not.toHaveClass("shadow-[var(--shadow-float)]");
    expect(controls()).toEqual(["Play"]);
    expect(playerElement()).toBe(mounted);
    // A tap plays and pauses as anywhere, and the page's handle still seeks the one Player.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(controls()).toEqual(["Pause"]);
    await act(async () => handle.current!.seek(30));
    expect(onFrame).toHaveBeenLastCalledWith(30);

    // Back in the page as it was: no styles of its own, its corners, its shadow and its mute button.
    await act(async () => rerender(stage(null)));
    expect(document.getElementById("edit-stage")).toBe(box);
    expect(box.style.position).toBe("");
    expect(box.style.clipPath).toBe("");
    expect(box).toHaveClass("rounded-[22px]", "shadow-[var(--shadow-float)]");
    expect(controls()).toEqual(["Pause", "Mute"]);
    expect(playerElement()).toBe(mounted);
  });

  it("turns its sound off and on at the page's word, and tells each change once, also with its own button hidden", async () => {
    const handle = createRef<StageHandle>();
    const onMutedChange = vi.fn();
    const stage = (frame: React.CSSProperties | null) => <EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} onMutedChange={onMutedChange} frame={frame} />;
    const { rerender } = render(stage(null));
    expect(onMutedChange).not.toHaveBeenCalled();
    await act(async () => rerender(stage({ position: "fixed" })));
    await act(async () => handle.current!.toggleMute());
    expect(onMutedChange.mock.calls).toEqual([[true]]);
    await act(async () => handle.current!.toggleMute());
    expect(onMutedChange.mock.calls).toEqual([[true], [false]]);
    expect(window.localStorage.getItem(KEPT_VOLUME)).toBe("1");
    // The same sound as the stage's own button: back in the page it reads as the preview left it.
    await act(async () => handle.current!.toggleMute());
    await act(async () => rerender(stage(null)));
    expect(controls()).toEqual(["Play", "Unmute"]);
  });

  it("tells a film that starts with no sound as muted", async () => {
    window.localStorage.setItem(KEPT_VOLUME, "0");
    const onMutedChange = vi.fn();
    render(<EditorStage edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} onMutedChange={onMutedChange} />);
    await waitFor(() => expect(onMutedChange.mock.calls).toEqual([[true]]));
  });

  it("tells a frame to the callback it holds, also one handed in as the frame changes", async () => {
    const handle = createRef<StageHandle>();
    const first = vi.fn();
    const second = vi.fn();
    const stage = (onFrame: (frame: number) => void) => <EditorStage ref={handle} edit={QUIET} urls={URLS} source={null} poster={null} onFrame={onFrame} />;
    const { rerender } = render(stage(first));
    await act(async () => {
      handle.current!.seek(30);
      rerender(stage(second));
    });
    expect(second).toHaveBeenLastCalledWith(30);
    expect(first).not.toHaveBeenCalled();
  });

  it("says so when the film starts with no sound, and one press gives the whole sound back", async () => {
    // The Player's own slider, on a page that shows it, can leave the site's volume at nothing.
    window.localStorage.setItem(KEPT_VOLUME, "0");
    render(<EditorStage edit={QUIET} urls={URLS} source={null} poster={null} onFrame={() => {}} />);
    expect(controls()).toEqual(["Play", "Unmute"]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unmute" })));
    expect(controls()).toEqual(["Play", "Mute"]);
    expect(window.localStorage.getItem(KEPT_VOLUME)).toBe("1");
  });

  it("keeps the one Player through a turn's new edit and through a read that brings the same edit again", async () => {
    const handle = createRef<StageHandle>();
    const onFrame = vi.fn();
    const stage = (edit: typeof QUIET, className: string, urls: Record<string, string> = URLS) => <EditorStage ref={handle} edit={edit} urls={urls} source={null} poster={null} onFrame={onFrame} className={className} />;
    const { rerender } = render(stage(QUIET, "w-[254px]"));
    const mounted = playerElement();
    expect(mounted).not.toBeNull();
    await act(async () => handle.current!.seek(30));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mute" })));

    // A turn, and another width: a shorter film. The same Player takes it as new props; where it stood and its sound are as they were.
    const shorter = changed(QUIET, [{ op: "shot.trim", id: QUIET.shots[0]!.id, endMs: 8000 }]);
    expect(filmFrames(shorter)).toBeLessThan(filmFrames(QUIET));
    await act(async () => rerender(stage(shorter, "w-[348px]")));
    expect(document.getElementById("edit-stage")).toHaveClass("w-[348px]");
    expect(playerElement()).toBe(mounted);
    expect(controls()).toEqual(["Play", "Unmute"]);
    // It still stands at 30: a seek to 30 moves nothing, where a Player mounted again would go there from 0.
    onFrame.mockClear();
    await act(async () => handle.current!.seek(30));
    expect(onFrame).not.toHaveBeenCalled();
    await act(async () => handle.current!.seek(45));
    expect(onFrame).toHaveBeenLastCalledWith(45);

    // A read: the same edit and the same address as new objects. Nothing moves and nothing is mounted again.
    onFrame.mockClear();
    await act(async () => rerender(stage(structuredClone(shorter), "w-[348px]", { ...URLS })));
    expect(playerElement()).toBe(mounted);
    expect(onFrame).not.toHaveBeenCalled();
    expect(controls()).toEqual(["Play", "Unmute"]);
    await act(async () => handle.current!.seek(50));
    expect(onFrame).toHaveBeenLastCalledWith(50);
  });

  it("stands still, its sound as the creator left it, when the cut takes the place of a take that was playing", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const stage = (edit: typeof QUIET | null) => <EditorStage edit={edit} urls={URLS} source="blob:local/1" poster={null} onFrame={() => {}} />;
    const { rerender } = render(stage(null));
    const video = document.querySelector("video")!;
    fireEvent.play(video);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(video.muted).toBe(true);
    expect(controls()).toEqual(["Pause", "Unmute"]);

    await act(async () => rerender(stage(QUIET)));
    expect(video.isConnected).toBe(false);
    expect(controls()).toEqual(["Play", "Unmute"]);
    // One press gives the sound back: it was the Player itself that had none.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unmute" })));
    expect(controls()).toEqual(["Play", "Mute"]);
  });
});

describe("the scrubber", () => {
  const BOX = { left: 10, width: 380, top: 0, height: 44, right: 390, bottom: 44, x: 10, y: 0, toJSON: () => ({}) } as DOMRect;

  it("is a slider of the film's frames that seeks where it is pressed, with a ring at each thing to check", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[30, 200]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    expect(slider).toHaveAttribute("aria-valuenow", "60");
    expect(slider).toHaveAttribute("aria-valuemax", "380");
    expect(slider).toHaveAttribute("aria-valuetext", "0:02 of 0:13");
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(2);
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(BOX);
    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(190);
  });

  it("says the time gone by in whole seconds, never one that is still to come, and the film's length at its end", () => {
    const said = (frames: number, frame: number) => {
      const { unmount } = render(<EditorScrubber frames={frames} frame={frame} marks={[]} onSeek={() => {}} />);
      const text = screen.getByRole("slider", { name: "Playhead" }).getAttribute("aria-valuetext");
      const [now, length] = [...document.querySelectorAll("[data-part=scrubber] > [aria-hidden] > span")].map((time) => time.textContent);
      unmount();
      expect(text).toBe(`${now} of ${length}`);
      return text;
    };
    // A cut standing half a second in (ruling R30), and up to the frame before a second is full.
    expect(said(381, 15)).toBe("0:00 of 0:13");
    expect(said(381, 29)).toBe("0:00 of 0:13");
    expect(said(381, 30)).toBe("0:01 of 0:13");
    expect(said(381, 379)).toBe("0:12 of 0:13");
    // At its last frame the film is at its end, and the two times agree: also for a film of whole seconds (11.0 s).
    expect(said(381, 380)).toBe("0:13 of 0:13");
    expect(said(330, 328)).toBe("0:10 of 0:11");
    expect(said(330, 329)).toBe("0:11 of 0:11");
  });

  it("follows a drag, and only while it is pressed", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={0} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(BOX);
    fireEvent.pointerMove(slider, { clientX: 100, buttons: 0, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.pointerDown(slider, { clientX: 100, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 300, buttons: 1, pointerId: 1 });
    expect(onSeek.mock.calls).toEqual([[90], [290]]);
  });

  it("seeks at the main button only", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={0} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(BOX);
    fireEvent.pointerDown(slider, { clientX: 200, button: 2, buttons: 2, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 300, buttons: 2, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("seeks nowhere while it rests", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} disabled onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    expect(slider).toHaveAttribute("aria-disabled", "true");
    expect(slider).toHaveAttribute("tabindex", "-1");
    fireEvent.pointerDown(slider, { clientX: 200, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 300, buttons: 1, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("holds what it says to the film: a take that ended stands one frame past its last", () => {
    render(<EditorScrubber frames={381} frame={381} marks={[]} onSeek={() => {}} />);
    expect(screen.getByRole("slider", { name: "Playhead" })).toHaveAttribute("aria-valuenow", "380");
  });

  it("draws a ring for each of two things to check on one frame", () => {
    render(<EditorScrubber frames={381} frame={0} marks={[30, 30, 200]} onSeek={() => {}} />);
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(3);
    expect(console.error).not.toHaveBeenCalled(); // React has nothing to say of their keys
  });

  it("is drawn in the footage's glyph tone over the black of the preview, and seeks as in the page", () => {
    const onSeek = vi.fn();
    const scrubber = (onFootage?: boolean) => <EditorScrubber frames={381} frame={60} marks={[]} onSeek={onSeek} onFootage={onFootage} />;
    const part = (name: string) => document.querySelector(`[data-part=scrubber] [data-part=${name}]`);
    const { rerender } = render(scrubber());
    expect(part("track")).toHaveClass("bg-surface-sunken");
    expect(part("fill")).toHaveClass("bg-action");
    expect(part("knob")).toHaveClass("bg-action", "shadow-[0_0_0_3px_var(--color-background)]");
    expect(part("times")).toHaveClass("text-foreground-muted");

    rerender(scrubber(true));
    expect(part("track")).toHaveClass("bg-action-foreground/30", "dark:bg-foreground/30");
    expect(part("track")).not.toHaveClass("bg-surface-sunken");
    for (const name of ["fill", "knob"]) {
      expect(part(name)).toHaveClass("bg-action-foreground", "dark:bg-foreground");
      expect(part(name)).not.toHaveClass("bg-action");
    }
    expect(part("knob")).not.toHaveClass("shadow-[0_0_0_3px_var(--color-background)]");
    expect(part("times")).toHaveClass("text-action-foreground/75", "dark:text-foreground/75");
    expect(part("times")).not.toHaveClass("text-foreground-muted");
    const slider = screen.getByRole("slider", { name: "Playhead" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(90);
  });

  it("reads the frame under a pointer, held to the track", () => {
    expect(frameAtPointer(10, 10, 380, 381)).toBe(0);
    expect(frameAtPointer(390, 10, 380, 381)).toBe(380);
    expect(frameAtPointer(999, 10, 380, 381)).toBe(380);
    expect(frameAtPointer(5, 0, 0, 381)).toBe(0);
  });
});
