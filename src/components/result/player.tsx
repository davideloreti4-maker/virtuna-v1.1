"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sceneIndexAt } from "@/lib/result/curve";
import { timecode } from "@/lib/result/format";
import type { Scene, VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { runStillOf } from "@/lib/result/run-video";
import { usePlayhead } from "./playhead";
import { useSignedVideo } from "./use-signed-video";

type Size = "hero" | "desktop" | "compact";

/** The mock's own play and pause glyphs (`I.play`, `I.pause`), filled. */
function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />
    </svg>
  );
}

function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" />
      <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" />
    </svg>
  );
}

/** The 9:16 tile's box: the result's video, the wait's picture, the loading frame's empty tile. */
export const TILE = "relative aspect-[9/16] shrink-0";
/** How a still is cropped in the tile (a scene's frame, and the picture the running screen showed). */
export const TILE_CROP = "object-cover object-[50%_10%]";
/**
 * The tile's width. The hero's is the first card's tile box (`FirstCard`: 53% of the card's inside,
 * 140 to 200) and the desktop's its column, so both fill their box; the compact player's is its own.
 */
const BOX: Record<Size, string> = {
  hero: "w-full",
  desktop: "w-full",
  compact: "w-[62px]",
};
/** The tile's corner; the running screen's tile has the same. */
export const RADIUS: Record<Size, string> = {
  hero: "rounded-2xl",
  desktop: "rounded-3xl",
  compact: "rounded-lg",
};
/**
 * The mock's `.player` / `.vcard` shadows, in tokens: a hairline and a drop in the scrim tone. The
 * running screen's tile uses them too (`hero` on a phone, `desktop` on a wide window).
 */
export const SHADOW: Record<Size, string> = {
  hero: "shadow-[0_0_0_1px_var(--color-border),0_10px_22px_-10px_var(--color-scrim)]",
  desktop: "shadow-[0_0_0_1px_var(--color-border),0_18px_40px_-20px_var(--color-scrim)]",
  compact: "shadow-[0_0_0_1px_var(--color-border),0_10px_22px_-10px_var(--color-scrim)]",
};
type MarkSize = Size | "moment";

/**
 * The round mark: 46 in the hero (glyph 16), 44 on desktop (15), 30 in the compact player and on
 * the moment's frame (11).
 */
const MARK: Record<MarkSize, string> = {
  hero: "size-[46px] [&>svg]:size-4",
  desktop: "size-11 [&>svg]:size-[15px]",
  compact: "size-[30px] [&>svg]:size-[11px]",
  moment: "size-[30px] [&>svg]:size-[11px]",
};

/**
 * Glass, as an inline style: Lightning CSS strips `backdrop-filter` from classes. Allowed only for
 * controls that float on a video (docs/DESIGN-SYSTEM.md, "Next look: elevation"), and on this page
 * only here (the result guard).
 */
const GLASS: React.CSSProperties = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" };

/**
 * The play mark on footage, in one place. On the video (hero, desktop corner, compact frame) it is
 * the mock's glass circle (`.pplay`, `.vcard .pb2`): white at a quarter, a white hairline inside,
 * blurred, with a white glyph. On the moment's small frame it is the mock's `.mom-t i`: a light
 * shade under a small white glyph, no glass.
 */
export function PlayMark({ size, playing = false }: { size: MarkSize; playing?: boolean }) {
  const glass = size !== "moment";
  return (
    <span
      data-part="mark"
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-full text-white",
        glass ? "bg-white/25 ring-1 ring-white/30 ring-inset" : "bg-black/[0.42]",
        MARK[size],
      )}
      style={glass ? GLASS : undefined}
    >
      {playing ? <PauseGlyph /> : <PlayGlyph className="translate-x-px" />}
    </span>
  );
}

/** The still to show at a time: the scene's own frame, else the nearest earlier one, else any; null without frames. */
function frameAt(scenes: readonly Scene[], index: number): string | null {
  for (let i = index; i >= 0; i--) if (scenes[i]?.frame) return scenes[i]!.frame;
  return scenes.find((scene) => scene.frame)?.frame ?? null;
}

/**
 * A media fragment so a phone shows the first frame of a paused video (iOS draws nothing for
 * `preload="metadata"` without one).
 */
const withFirstFrame = (src: string) => (src.includes("#") ? src : `${src}#t=0.001`);

/**
 * The video tile, 9:16 (the mock's `.player`, `rplayer`, `vframe`, `.vcard`).
 *
 * - With a stored file ("hero", "desktop"): a `<video>` registered with the playhead. Tapping the
 *   tile plays and pauses. Phone: a round play mark while paused. Desktop: only a play button, at
 *   the lower left, there while it plays too. At rest it shows the first frame.
 * - Without a file (or while it signs, or when it is gone): the frame of the scene under the
 *   playhead (the first at rest); without frames too, a quiet tile with the clip's length and no
 *   play mark.
 * - When this tab watched the run, the picture its running screen showed lies under all of that, so
 *   the tile is never empty while the result's own video or frame loads.
 * - "compact" (the scrolled phone player) never holds a video of its own: the page has one video,
 *   in the hero. It shows the frame under the playhead and, when that video can play, a mark that
 *   plays and pauses it.
 */
export function Player({ model, size }: { model: VideoModel; size: Size }) {
  const { t, resting, playing, canPlay, toggle, attachVideo } = usePlayhead();
  const scenes = model.audience.scenes;
  const ownsVideo = size !== "compact";
  const { src, status } = useSignedVideo(ownsVideo ? model.videoPath : null);
  const playable = ownsVideo && status === "ready" && !!src;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      attachVideo(el);
    },
    [attachVideo],
  );

  // At rest the video shows its first frame (after it ends, or after End on the line).
  useEffect(() => {
    const el = videoRef.current;
    if (resting && el && el.paused && el.currentTime !== 0) el.currentTime = 0;
  }, [resting, playable]);

  const frame = frameAt(scenes, resting ? 0 : sceneIndexAt(scenes, t));
  const poster = frameAt(scenes, 0);
  // The picture the running screen showed for this run, when this tab watched it. The tile stands on
  // it until its own video or frame has painted, so a result that arrives never shows an empty tile.
  const remembered = ownsVideo ? runStillOf(model.id) : null;
  const [underFailed, setUnderFailed] = useState<string | null>(null);
  const under = remembered !== null && remembered !== underFailed ? remembered : null;
  const pressable = playable || (size === "compact" && canPlay);
  const showMark = pressable && (size === "desktop" || !playing);

  return (
    <div data-result="video" className={cn(TILE, BOX[size])}>
      <div
        className={cn(
          "absolute inset-0 overflow-hidden bg-surface-sunken",
          RADIUS[size],
          playable || frame || under ? SHADOW[size] : "shadow-[inset_0_0_0_1px_var(--color-border)]",
        )}
      >
        {under && (
          // eslint-disable-next-line @next/next/no-img-element -- the cover or frame the running screen showed
          <img
            data-part="under"
            src={under}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            // A picture that cannot load (a cover the platform refuses) is no ground to stand on.
            onError={() => setUnderFailed(remembered)}
            className={cn("absolute inset-0 block h-full w-full", TILE_CROP)}
          />
        )}
        {playable ? (
          // `relative`: above the picture it stands on, which shows through until the video has a frame.
          <video
            ref={setVideo}
            src={withFirstFrame(src)}
            poster={poster ?? undefined}
            playsInline
            preload="metadata"
            className="relative block h-full w-full object-cover"
          />
        ) : frame ? (
          // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address
          <img src={frame} alt="" draggable={false} className={cn("relative block h-full w-full", TILE_CROP)} />
        ) : under ? null : (
          <span className="flex h-full items-center justify-center text-meta font-[560] text-foreground-muted tabular-nums">
            {timecode(model.clipS)}
          </span>
        )}
        {size === "desktop" && (playable || frame) && (
          // The mock's shade under the controls, so the button reads on a light frame.
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-linear-to-t from-scrim to-transparent" />
        )}
      </div>
      {pressable && (
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
          className={cn(
            "absolute inset-0 flex cursor-pointer",
            RADIUS[size],
            size === "desktop" ? "items-end justify-start px-5 pb-[18px]" : "items-center justify-center",
          )}
        >
          {showMark && <PlayMark size={size} playing={playing} />}
        </button>
      )}
    </div>
  );
}
