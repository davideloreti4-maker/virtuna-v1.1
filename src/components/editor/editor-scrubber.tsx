"use client";

import { useRef } from "react";
import { FPS } from "@/lib/edit";
import { timecode } from "@/lib/result/format";
import { cn } from "@/lib/utils";

/**
 * editor-scrubber.tsx — one scrubber (spec E8; plan 2026-11-24-editor-screens-a, Task 11; drawing `.scrub`): a 4 tall track, the
 * part played in ink, the playhead (14, ringed in the ground), a ring at each thing to check, and 7 under it where the playhead
 * is (in whole seconds gone by) and how long the film is. It is a slider of the film's frames, 44 tall to press; a press or a
 * drag seeks there. Its keys: the arrows a second, Page Up and Page Down five, Home and End the ends.
 *
 * The track is drawn 10 from the top of those 44, the drawing's space between the video and the track: the page lays the
 * scrubber directly under the video, with no gap and nothing over the video (ruling R23). The times are inside the 44 too.
 *
 * Over the black of the preview as it will be posted (plan 2026-11-25-editor-screens-b, Task 6) it is drawn in the tone of a
 * glyph over footage (`onFootage`): light in both themes, the track a faint one, the knob without the page's ring.
 */

/** The frame under a pointer at `x`, on a track from `left`, `width` wide; held to the track. */
export function frameAtPointer(x: number, left: number, width: number, frames: number): number {
  if (width <= 0 || frames <= 1) return 0;
  return Math.round(Math.min(1, Math.max(0, (x - left) / width)) * (frames - 1));
}

/** How far a key moves the playhead, in frames: a second, or five. */
const STEPS = new Map([["ArrowLeft", -FPS], ["ArrowDown", -FPS], ["ArrowRight", FPS], ["ArrowUp", FPS], ["PageDown", -5 * FPS], ["PageUp", 5 * FPS]]);

export interface ScrubberProps {
  frames: number;
  frame: number;
  /** The film frames of the things to check. */
  marks: readonly number[];
  disabled?: boolean;
  onSeek(frame: number): void;
  /** Drawn over the black of the preview: the track, the fill, the knob and the times in the footage glyph tone. */
  onFootage?: boolean;
}

/** The scrubber's tones: on the page's ground, and over footage (a glyph over footage, `text-action-foreground dark:text-foreground`). */
const TONES = {
  ground: { track: "bg-surface-sunken", ink: "bg-action", knob: "shadow-[0_0_0_3px_var(--color-background)]", times: "text-foreground-muted" },
  footage: { track: "bg-action-foreground/30 dark:bg-foreground/30", ink: "bg-action-foreground dark:bg-foreground", knob: "", times: "text-action-foreground/75 dark:text-foreground/75" },
};

export function EditorScrubber({ frames, frame, marks, disabled = false, onSeek, onFootage = false }: ScrubberProps) {
  const tone = TONES[onFootage ? "footage" : "ground"];
  const track = useRef<HTMLDivElement>(null);
  const last = Math.max(1, frames - 1);
  const held = (at: number) => Math.min(Math.max(at, 0), last);
  const share = (at: number) => `${(held(at) / last) * 100}%`;
  /** Where the playhead is, held to the film: a take that has ended stands one frame past its last. */
  const now = held(frame);
  /**
   * The film's length, and the time gone by: whole seconds, rounded down, so a cut standing half a second in reads 0:00 and
   * no second is said before it is full (ruling R30). At its last frame the film is at its end, and the two times agree.
   */
  const length = timecode(frames / FPS);
  const gone = now >= last ? length : timecode(Math.floor(now / FPS));
  const seekTo = (x: number) => {
    const box = track.current?.getBoundingClientRect();
    if (box) onSeek(frameAtPointer(x, box.left, box.width, frames));
  };
  return (
    <div data-part="scrubber" className="relative w-full select-none px-0.5">
      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={now}
        aria-valuetext={`${gone} of ${length}`}
        aria-disabled={disabled || undefined}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return; // the main button, a finger or a pen
          event.currentTarget.setPointerCapture?.(event.pointerId);
          seekTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!disabled && event.buttons === 1) seekTo(event.clientX);
        }}
        onKeyDown={(event) => {
          // Held with Alt, Ctrl or Cmd it is the browser's key (Back, Forward): left to it. Shift is no other key here.
          if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
          // From where the playhead is held to: a take played to its end stands one frame past the film's last.
          const step = STEPS.get(event.key);
          const to = event.key === "Home" ? 0 : event.key === "End" ? last : step === undefined ? null : now + step;
          if (to === null) return;
          event.preventDefault(); // the slider's key: the page does not scroll with it
          onSeek(held(to));
        }}
        className={cn("relative h-11 touch-none", disabled ? "cursor-default" : "cursor-pointer")}
      >
        <div data-part="track" className={cn("absolute inset-x-0 top-2.5 h-1 rounded-full", tone.track)}>
          <div data-part="fill" className={cn("absolute inset-y-0 left-0 rounded-full", tone.ink)} style={{ width: share(now) }} />
          {marks.map((mark, index) => (
            <span
              // Two things to check can sit on one frame.
              key={`${mark}-${index}`} data-part="mark" aria-hidden
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.7px] border-foreground-secondary bg-background"
              style={{ left: share(mark) }}
            />
          ))}
          <span data-part="knob" aria-hidden className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full", tone.ink, tone.knob)} style={{ left: share(now) }} />
        </div>
      </div>
      {/* 7 under the track, as drawn, and over the slider's lower part: a press there goes through to it. */}
      <div data-part="times" aria-hidden className={cn("pointer-events-none absolute inset-x-0.5 top-[21px] flex justify-between text-label tabular-nums", tone.times)}>
        <span>{gone}</span>
        <span>{length}</span>
      </div>
    </div>
  );
}
