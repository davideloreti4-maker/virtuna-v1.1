"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { isResting, restingAt, stepScene, type PlayheadState } from "@/lib/result/playhead";
import type { Scene } from "@/lib/result/types";

/**
 * The one playhead of the result page. The video, the line, the moment and the three panels read
 * and move it through `usePlayhead()`.
 *
 * At rest it sits at the clip's end (the gauge is the number). Pressing play starts from 0:00.
 * While playing, `t` follows the video's `currentTime` once per animation frame; when the video
 * ends it goes back to rest. Without a video (the file is gone) play does nothing, and seek and
 * step still move `t`, so the line still scrubs.
 */
export interface Playhead {
  /** Seconds, 0 to the clip's length. */
  t: number;
  playing: boolean;
  /** Not playing, at the clip's end. */
  resting: boolean;
  /** A video element with a source is attached. */
  canPlay: boolean;
  /** From rest it starts at 0:00. Does nothing without a video. */
  play(): void;
  pause(): void;
  toggle(): void;
  /** Moves the playhead (clamped to the clip) and the attached video. The clip's end is rest. */
  seek(t: number): void;
  /** Seek, then play when there is a video. */
  playFrom(t: number): void;
  /** One scene left or right (`stepScene`). */
  step(dir: -1 | 1): void;
  /** Give the playhead the page's video element, or null when it goes away. Stable. */
  attachVideo(el: HTMLVideoElement | null): void;
}

const PlayheadContext = createContext<Playhead | null>(null);

function hasSource(video: HTMLVideoElement | null): boolean {
  return !!video && !!(video.currentSrc || video.getAttribute("src") || video.querySelector("source[src]"));
}

export function PlayheadProvider({
  clipS,
  scenes,
  children,
}: {
  clipS: number;
  scenes: readonly Scene[];
  children: React.ReactNode;
}): React.JSX.Element {
  const [state, setState] = useState<PlayheadState>(() => restingAt(clipS));
  // The latest state, for callbacks that run between renders (events, animation frames).
  const stateRef = useRef(state);
  const commit = useCallback((next: PlayheadState) => {
    const prev = stateRef.current;
    if (prev.t === next.t && prev.playing === next.playing) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // A video's source can arrive after it is attached (the signed address loads); its media
  // events re-render the provider so `canPlay` is read again.
  const [, sourceChanged] = useReducer((n: number) => n + 1, 0);

  const clamp = useCallback((t: number) => Math.min(clipS, Math.max(0, Number.isFinite(t) ? t : 0)), [clipS]);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideo(el);
  }, []);

  // A detached video cannot keep playing.
  useEffect(() => {
    if (!video && stateRef.current.playing) commit({ t: stateRef.current.t, playing: false });
  }, [video, commit]);

  // Follow the video's own events: a play or pause from the system or another control, the end.
  useEffect(() => {
    if (!video) return;
    const onPlay = () => commit({ t: clamp(video.currentTime), playing: true });
    const onPause = () => {
      // A browser queues `pause`. After End (or a drag past the end) while playing, it arrives
      // when the page is already at rest and the video was set back to its first frame: it must
      // not move the playhead to 0:00.
      if (video.ended || isResting(stateRef.current, clipS)) return;
      commit({ t: clamp(video.currentTime), playing: false });
    };
    const onEnded = () => commit(restingAt(clipS));
    const sourceEvents = ["loadstart", "emptied", "loadedmetadata"] as const;
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    for (const name of sourceEvents) video.addEventListener(name, sourceChanged);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      for (const name of sourceEvents) video.removeEventListener(name, sourceChanged);
    };
  }, [video, clipS, clamp, commit]);

  // While playing, t follows the video once per animation frame.
  useEffect(() => {
    if (!state.playing || !video) return;
    let frame = requestAnimationFrame(function tick() {
      commit({ t: clamp(video.currentTime), playing: true });
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [state.playing, video, clamp, commit]);

  const pause = useCallback(() => {
    const el = videoRef.current;
    if (el && !el.paused) el.pause();
    commit({ t: stateRef.current.t, playing: false });
  }, [commit]);

  const play = useCallback(() => {
    const el = videoRef.current;
    if (!el || !hasSource(el)) return;
    let t = stateRef.current.t;
    if (t >= clipS) {
      t = 0;
      el.currentTime = 0;
    }
    commit({ t, playing: true });
    const started = el.play();
    // Refused (autoplay rules, a broken file): the playhead stops where it is.
    if (started && typeof started.catch === "function") {
      started.catch(() => commit({ t: stateRef.current.t, playing: false }));
    }
  }, [clipS, commit]);

  const seek = useCallback(
    (to: number) => {
      const t = clamp(to);
      const el = videoRef.current;
      // The clip's end is rest: not playing.
      const rest = t >= clipS;
      if (el) {
        if (rest && !el.paused) el.pause();
        el.currentTime = t;
      }
      commit(rest ? restingAt(clipS) : { t, playing: stateRef.current.playing });
    },
    [clipS, clamp, commit],
  );

  const playFrom = useCallback(
    (t: number) => {
      seek(t);
      if (hasSource(videoRef.current)) play();
    },
    [seek, play],
  );

  const toggle = useCallback(() => (stateRef.current.playing ? pause() : play()), [pause, play]);

  const step = useCallback(
    (dir: -1 | 1) => seek(stepScene(scenes, stateRef.current.t, dir, clipS)),
    [scenes, clipS, seek],
  );

  const canPlay = hasSource(video);
  const value = useMemo<Playhead>(
    () => ({
      t: state.t,
      playing: state.playing,
      resting: isResting(state, clipS),
      canPlay,
      play,
      pause,
      toggle,
      seek,
      playFrom,
      step,
      attachVideo,
    }),
    [state, clipS, canPlay, play, pause, toggle, seek, playFrom, step, attachVideo],
  );

  return <PlayheadContext.Provider value={value}>{children}</PlayheadContext.Provider>;
}

export function usePlayhead(): Playhead {
  const playhead = useContext(PlayheadContext);
  if (!playhead) throw new Error("usePlayhead() must be used inside <PlayheadProvider>");
  return playhead;
}
