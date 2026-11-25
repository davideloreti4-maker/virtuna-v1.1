"use client";

import type { PlayerRef } from "@remotion/player";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState, type MouseEvent } from "react";
import { SHELL_FOCUS } from "@/components/shell/nav-config";
import { EditPlayer } from "@/edit/player/EditPlayer";
import { FPS, type Edit } from "@/lib/edit";
import { cn } from "@/lib/utils";
import { MutedIcon, PlayIcon, SoundIcon } from "./editor-icons";

/**
 * editor-stage.tsx — the video (spec 2026-11-24-editor-screens-design.md §5.2, E8, E19; plan 2026-11-24-editor-screens-a,
 * Task 11). Before the cut the browser's own `<video>` plays the device's copy (or the take's preview once it is ready), so the
 * take plays at once; after it the Player plays the edit (`EditPlayer`, kit `/edit`), its own controls off. Ours sit over both:
 * a tap plays and pauses, a play button in the middle while paused, a mute button in the corner (32 drawn, 44 to tap).
 *
 * One Player for as long as there is a cut. It is the one `EditPlayer` at one place under the stage's one box, with no `key`
 * and nothing around it that depends on the edit, the addresses or the layout: a turn's new edit, a read that brings the same
 * edit as a new object, and a `className` for another width all go in as props to the Player that is mounted. It is mounted
 * once, when the first cut takes the take's place. No effect here depends on the edit, so the stage never moves the playhead
 * by itself: the page does, through the handle. The page keeps one stage mounted across a resize (its layout is CSS).
 *
 * A seek made while the film plays: the Player stops, seeks, and plays on by itself a moment later. To the creator it never
 * stopped, so the stage tells nobody of that pause and that play: the cover goes on offering Pause, and `onPlay` is not called
 * again. The pause is told after all where the Player does not play on: at the film's end, and when it is stopped meanwhile.
 *
 * Slice B (plan 2026-11-25-editor-screens-b, Task 5): the page asks whether the video plays (`playing`, as the cover reads it)
 * and is told each start and stop (`onPlayingChange`); a word may sit over the footage, top centre (`badge`: "Original" while
 * the take as it was shot is on the stage), and takes no tap.
 *
 * Slice B, Task 6: the preview as it will be posted promotes this very box, never a second Player (`frame`): placed by the
 * page's styles over the whole window, square-cornered, with no shadow and no mute button (the app's buttons are drawn where
 * it sits). A tap on the video still plays and pauses it. The preview has the sound's button among its own controls: the page
 * turns the sound off and on through the handle (`toggleMute`) and is told each change (`onMutedChange`), the same sound as
 * the stage's own button (ruling S10).
 */

export interface StageHandle {
  seek(frame: number): void;
  play(): void;
  pause(): void;
  /** The medium on the stage is playing, or plays on after a seek. */
  playing(): boolean;
  /** Turns the sound of the medium shown off, or back on whole: the stage's own mute button, pressed from elsewhere. */
  toggleMute(): void;
}

export interface StageProps {
  /** The edit shown; null before the first cut, when the take itself plays. */
  edit: Edit | null;
  /** The take's preview address by its id, for the Player. A new address makes the film load the take again. */
  urls: Record<string, string>;
  /** Before the cut: the device's own copy, or the take's preview once it is ready; null while there is neither. */
  source: string | null;
  poster: string | null;
  onFrame(frame: number): void;
  /** Before the cut: the take's length in frames once the browser has read it. */
  onFrames?(frames: number): void;
  /** It started playing, at a tap or at the page's word. Playing on after a seek is no start. */
  onPlay?(): void;
  /** Told when the medium shown starts or stops playing: each change once, as the controls show it. */
  onPlayingChange?(playing: boolean): void;
  /** Told when the medium shown loses its sound or has it back: each change once, as the mute button shows it. */
  onMutedChange?(muted: boolean): void;
  /** A word over the footage, top centre ("Original"); null for none. */
  badge?: string | null;
  /** Promoted to the preview: the stage's own box placed by these styles, square-cornered, no shadow, no mute button. Null in the page. */
  frame?: React.CSSProperties | null;
  className?: string;
}

/** What is on the stage: the take in the browser's own `<video>`, or the film in the Player. */
type Medium = "take" | "film";
/** What a medium last told of itself. */
interface Told {
  playing: boolean;
  muted: boolean;
}
const AT_REST: Record<Medium, Told> = { take: { playing: false, muted: false }, film: { playing: false, muted: false } };
const heard = (all: Record<Medium, Told>, { of, ...what }: { of: Medium } & Partial<Told>): Record<Medium, Told> => ({ ...all, [of]: { ...all[of], ...what } });

/** A control's glyph over footage: light on the scrim, in both themes. */
const OVER_FOOTAGE = "bg-scrim text-action-foreground dark:text-foreground";

/** A `play()` the browser held back (NotAllowedError), or one that a pause or another address stopped (AbortError): nothing to act on. */
const heldBack = (problem: unknown) => problem instanceof DOMException && (problem.name === "AbortError" || problem.name === "NotAllowedError");

export const EditorStage = forwardRef<StageHandle, StageProps>(function EditorStage({ edit, urls, source, poster, onFrame, onFrames, onPlay, onPlayingChange, onMutedChange, badge = null, frame = null, className }, handle) {
  const player = useRef<PlayerRef>(null);
  const video = useRef<HTMLVideoElement>(null);
  // The controls say what the medium on the stage told of itself. Each is heard apart: the film starts standing still, and
  // is not said to play because the take did.
  const [told, tell] = useReducer(heard, AT_REST);
  /** The address this browser could not play: the take's picture stands in for it, with no control. */
  const [unplayable, setUnplayable] = useState<string | null>(null);
  const cut = edit !== null;
  const { playing, muted } = told[cut ? "film" : "take"];
  /** The take's address, while it can be played. */
  const take = source !== unplayable ? source : null;

  // The Player's stop to seek (see above). `seeking` is up for the length of the stage's own seek, inside which the Player
  // tells its pause; `playsOn` from that pause until the Player has played on, or is stopped.
  const seeking = useRef(false);
  const playsOn = useRef(false);

  // Stops the film, by the Player's own `pause` and never its `toggle`: only `pause` calls off its playing on after a seek.
  const stopFilm = useCallback(() => {
    if (playsOn.current) {
      playsOn.current = false;
      tell({ of: "film", playing: false }); // the Player told of this pause when it stopped to seek, and will not again
    }
    player.current?.pause();
  }, []);
  // Plays the take. A refusal that is not the browser holding it back means this address cannot be played here.
  const playTake = useCallback((element: HTMLVideoElement) => {
    const address = element.getAttribute("src");
    void element.play().catch((problem: unknown) => {
      if (!heldBack(problem)) setUnplayable(address);
    });
  }, []);

  const toggleMute = useCallback(() => {
    const now = player.current;
    if (now) {
      // The Player tells of its sound itself (`mutechange`).
      if (now.isMuted()) {
        now.unmute();
        // No control here sets a volume, so the sound comes back whole: a volume of nothing, kept by the Player from its
        // own slider on another page of the site, is no sound either.
        now.setVolume(1);
      } else now.mute();
      return;
    }
    const element = video.current;
    if (!element) return;
    element.muted = !element.muted;
    tell({ of: "take", muted: element.muted });
  }, []);

  useImperativeHandle(handle, () => ({
    seek: (frame) => {
      const now = player.current;
      if (now) {
        seeking.current = true;
        try {
          now.seekTo(frame);
        } finally {
          seeking.current = false;
        }
      } else if (video.current) video.current.currentTime = frame / FPS;
    },
    play: () => {
      const now = player.current;
      if (now) {
        if (!playsOn.current) now.play(); // after a seek it plays on by itself
      } else if (video.current) playTake(video.current);
    },
    pause: () => {
      stopFilm();
      video.current?.pause();
    },
    // As the cover reads it: the film stopped only to seek plays on.
    playing: () => {
      const now = player.current;
      if (now) return now.isPlaying() || playsOn.current;
      return video.current !== null && !video.current.paused;
    },
    toggleMute,
  }), [stopFilm, playTake, toggleMute]);

  // The Player's own events, from the moment it is mounted (the first cut) for as long as it is. Listened to once, with the
  // page's callbacks read as they are when an event comes: the Player tells a frame from an effect of its own, which runs
  // before any of the stage's, so listeners taken off and put on again for a new function would miss that frame. (Kept in
  // a ref, not `useEffectEvent`: under `forwardRef`, React 19.2.3 leaves that one bound to the first render's function.)
  const callbacks = useRef({ onFrame, onPlay, onPlayingChange, onMutedChange });
  useLayoutEffect(() => {
    callbacks.current = { onFrame, onPlay, onPlayingChange, onMutedChange };
  });

  // Whether the medium shown plays, told to the page as the controls show it: once a change, so a seek made while the film
  // plays tells nothing, and the take that stops for the cut tells its stop.
  const toldPlaying = useRef(false);
  useEffect(() => {
    if (playing === toldPlaying.current) return;
    toldPlaying.current = playing;
    callbacks.current.onPlayingChange?.(playing);
  }, [playing]);
  // Whether it has its sound, told the same way.
  const toldMuted = useRef(false);
  useEffect(() => {
    if (muted === toldMuted.current) return;
    toldMuted.current = muted;
    callbacks.current.onMutedChange?.(muted);
  }, [muted]);
  useEffect(() => {
    const now = player.current;
    if (!now) return;
    // It may start with no sound (the Player keeps its volume for the whole site), and has told so before anyone listened.
    tell({ of: "film", muted: now.isMuted() });
    const moved = (event: { detail: { frame: number } }) => callbacks.current.onFrame(event.detail.frame);
    const played = () => {
      if (playsOn.current) {
        playsOn.current = false;
        return;
      }
      tell({ of: "film", playing: true });
      callbacks.current.onPlay?.();
    };
    const paused = () => {
      if (seeking.current) playsOn.current = true;
      else tell({ of: "film", playing: false });
    };
    // A seek to the film's end: the Player stops there and says so. It is stopped by the stage as well: a seek that came
    // just before this one may have left it about to play on, and from the last frame that is from the first again.
    const ended = () => {
      if (playsOn.current) stopFilm();
    };
    const muting = (event: { detail: { isMuted: boolean } }) => tell({ of: "film", muted: event.detail.isMuted });
    now.addEventListener("frameupdate", moved);
    now.addEventListener("play", played);
    now.addEventListener("pause", paused);
    now.addEventListener("ended", ended);
    now.addEventListener("mutechange", muting);
    return () => {
      now.removeEventListener("frameupdate", moved);
      now.removeEventListener("play", played);
      now.removeEventListener("pause", paused);
      now.removeEventListener("ended", ended);
      now.removeEventListener("mutechange", muting);
      playsOn.current = false;
    };
  }, [cut, stopFilm]);

  // The sound stays off across the first cut when the creator turned it off on the take.
  const takeMuted = told.take.muted;
  useEffect(() => {
    if (cut && takeMuted) player.current?.mute();
  }, [cut, takeMuted]);

  // The take's element, and the take at rest again when it goes away: another element starts paused.
  const takeElement = useCallback((element: HTMLVideoElement | null) => {
    video.current = element;
    return () => {
      video.current = null;
      tell({ of: "take", playing: false });
    };
  }, []);

  const toggle = (event: MouseEvent) => {
    const now = player.current;
    if (now) {
      if (now.isPlaying() || playsOn.current) stopFilm();
      else now.play(event); // the tap itself, which the Player asks for to start its sound
      return;
    }
    const element = video.current;
    if (!element) return;
    if (element.paused) playTake(element);
    else element.pause();
  };
  const playable = cut || take !== null;

  // The stage's own ground is black in both themes, a video's ground (ruling R26): the one colour named outright here.
  return (
    <div
      id="edit-stage" data-part="stage" data-cut={cut || undefined} style={frame ?? undefined}
      className={cn("relative aspect-[9/16] overflow-hidden bg-black", frame === null ? "rounded-[22px] shadow-[var(--shadow-float)]" : "rounded-none shadow-none", className)}
    >
      {cut ? (
        <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} controls={false} spaceKeyToPlayOrPause={false} style={{ height: "100%" }} />
      ) : take !== null ? (
        <video
          ref={takeElement} src={take} poster={poster ?? undefined} playsInline preload="metadata"
          // The sound as the creator left it, also for another take's element.
          muted={takeMuted}
          onTimeUpdate={(event) => onFrame(Math.round(event.currentTarget.currentTime * FPS))}
          onLoadedMetadata={(event) => {
            const seconds = event.currentTarget.duration;
            if (Number.isFinite(seconds)) onFrames?.(Math.round(seconds * FPS));
          }}
          onPlay={() => {
            tell({ of: "take", playing: true });
            onPlay?.();
          }}
          onPause={() => tell({ of: "take", playing: false })}
          onEnded={() => tell({ of: "take", playing: false })}
          // Another address: the browser stops the element and tells it `emptied`, never `pause`.
          onEmptied={() => tell({ of: "take", playing: false })}
          onVolumeChange={(event) => tell({ of: "take", muted: event.currentTarget.muted })}
          onError={(event) => setUnplayable(event.currentTarget.getAttribute("src"))}
          className="size-full object-cover"
        />
      ) : poster !== null ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed address of the creator's own poster, not an image of the app's
        <img src={poster} alt="" className="size-full object-cover" />
      ) : null}
      {playable && (
        <>
          {/* The keyboard's ring is drawn inside it (`SHELL_FOCUS`), along the stage's corners: outside, the stage would clip it. */}
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className={cn("absolute inset-0 z-[1] flex items-center justify-center rounded-[inherit]", SHELL_FOCUS)}>
            {!playing && (
              <span aria-hidden className={cn("flex size-[58px] items-center justify-center rounded-full [&_svg]:ml-[3px] [&_svg]:size-[26px]", OVER_FOOTAGE)}>
                <PlayIcon />
              </span>
            )}
          </button>
          {/* Placed by a wrapper: on touch `.tap-44` sets `position: relative` from unlayered CSS. */}
          {frame === null && (
            <span className="absolute bottom-2.5 right-2.5 z-[2]">
              <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className={cn("tap-44 flex size-8 items-center justify-center rounded-full [&_svg]:size-4", OVER_FOOTAGE)}>
                {muted ? <MutedIcon aria-hidden /> : <SoundIcon aria-hidden />}
              </button>
            </span>
          )}
        </>
      )}
      {/* Over the footage and through to it: a tap on the word plays and pauses as anywhere on the video. */}
      {badge !== null && (
        <span data-part="badge" className={cn("pointer-events-none absolute left-1/2 top-3 z-[2] flex h-[26px] -translate-x-1/2 items-center whitespace-nowrap rounded-full px-[11px] text-label font-[600]", OVER_FOOTAGE)}>
          {badge}
        </span>
      )}
    </div>
  );
});
