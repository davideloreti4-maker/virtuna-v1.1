"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { queryKeys } from "@/lib/queries/query-keys";
import { timecode } from "@/lib/result/format";
import { NO_PROGRESS, arrivedFrames, elapsedSeconds, type RunProgress } from "@/lib/result/run-progress";
import { forgetRunStill, rememberRunStill, runVideoOf } from "@/lib/result/run-video";
import { cn } from "@/lib/utils";
import {
  FirstCard,
  LineFrame,
  PHONE_COLUMN,
  PHONE_LINE_FALLBACK,
  PLOT_PX,
  ResultFrame,
  STRIP_GAP_PX,
  STRIP_TILE,
  stripHeight,
  UNDER_FIRST_LINE,
  UNDER_LINE,
  WIDE_LINE_FALLBACK,
  WideFrame,
  type Viewport,
  STRIP_CROP,
} from "./first-block";
import { RADIUS, SHADOW, TILE, TILE_CROP } from "./player";
import { useContentWidth } from "./use-content-width";
import { useRunStream } from "./use-run-stream";

/**
 * What the dev page and the tests hand the screen instead of the live run: the stream's progress,
 * the creator's own video (null for none) and the seconds on the clock.
 */
export interface RunningPreview {
  progress?: RunProgress;
  video?: string | null;
  elapsed?: number;
}

/**
 * Where frames come at all, the first is there within seconds of the start (1 to 12 were measured).
 * After this long without one (a run whose frame job does not deliver) the strip's tiles stop
 * shimmering: a shimmer would promise frames that are not coming.
 */
const FRAMES_DUE_S = 20;
/** The strip's tiles before the scenes are known: seven, as drawn; more once a frame names a later scene. */
const WAIT_TILES = 7;
/** More scenes than a run is cut into (4 to 19): a broken event cannot draw the strip as a comb of slivers. */
const MOST_TILES = 24;
/** Where the dotted base runs in the plot while the line is not known yet, as drawn. */
const WAIT_BASE_Y = 30;

// The wait's motion (keyframes `result-*` in globals.css). Every class is `motion-safe:`, and the parts
// that only move are not drawn at all with reduced motion: then nothing moves by itself.
/** A band of light down the tile, while it shows a still or nothing. */
const SWEEP = "motion-safe:animate-[result-sweep_2.8s_cubic-bezier(0.4,0,0.2,1)_infinite]";
/** A quiet band of light across the plot. */
const SCAN = "motion-safe:animate-[result-scan_2.2s_linear_infinite]";
/** An empty strip tile's shimmer. */
const SHIMMER = "motion-safe:animate-[result-shimmer_1.6s_ease-in-out_infinite]";
/** A strip tile's frame once its picture has loaded: a short fade and settle. */
const SETTLE = "motion-safe:animate-[result-settle_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both]";
/** The three dots after the words, blinking in turn (held dim through their delay, not lit). */
const BLINK = "motion-safe:animate-[result-blink_1.2s_ease-in-out_infinite_both]";
const BLINK_DELAYS = ["", "motion-safe:[animation-delay:200ms]", "motion-safe:[animation-delay:400ms]"] as const;

/** The time, read again every second while `ticking`. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

/**
 * The creator's own video: decoration that plays by itself, not the page's playhead, no controls, no
 * sound, nothing for a screen reader. With reduced motion it does not start by itself: its first frame
 * shows. The same when the browser will not start it (a phone saving power refuses even a muted
 * clip): the creator's clip stands still rather than being dropped. When it cannot play at all (a
 * revoked or expired address) the tile falls through to what comes next.
 */
function RunVideo({ src, still, onFail }: { src: string; still: boolean; onFail: (src: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [refused, setRefused] = useState(false);
  const held = still || refused;
  useEffect(() => {
    if (held) return;
    const playing = ref.current?.play();
    if (!playing) return;
    playing.catch((error: unknown) => {
      const name = (error as { name?: string } | null)?.name;
      // An interrupted load is not a refusal.
      if (name === "AbortError") return;
      if (name === "NotAllowedError") setRefused(true);
      else onFail(src);
    });
  }, [src, held, onFail]);
  return (
    <video
      ref={ref}
      aria-hidden="true"
      // Held: `#t=0.001` makes Safari paint the first frame instead of a black box.
      src={held ? `${src}#t=0.001` : src}
      muted
      autoPlay={!held}
      preload={held ? "metadata" : undefined}
      loop
      playsInline
      onError={() => onFail(src)}
      className="block h-full w-full object-cover"
    />
  );
}

/**
 * A still filling the tile: the post's cover or a scene frame, drawn as the app draws a post's cover
 * (a plain image with an empty alt that reports a failed load), so a picture that cannot load falls
 * through to the next.
 */
function Still({ src, onFail }: { src: string; onFail: (src: string) => void }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a cover or a stored frame's address (it can expire); next/image has nothing to optimise
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      // A post's cover lives on the platform's host: it is asked for without saying where from.
      referrerPolicy="no-referrer"
      onError={() => onFail(src)}
      // The crop the result's player gives a frame: the picture does not shift when the result arrives.
      className={cn("absolute inset-0 block h-full w-full", TILE_CROP)}
    />
  );
}

/**
 * The tile where the result's video will stand, its size and corner. It shows the creator's own clip,
 * else the post's cover, else the first scene frame that arrived, else nothing (a sunken tile). A band
 * of light sweeps down it while it shows a still or nothing, never over the playing clip, and never
 * with reduced motion.
 */
const RunningTile = memo(function RunningTile({
  video,
  cover,
  frame,
  size,
  still,
  onFail,
}: {
  video: string | null;
  cover: string | null;
  frame: string | null;
  size: "hero" | "desktop";
  still: boolean;
  onFail: (src: string) => void;
}) {
  const shows = video ? "clip" : cover ? "cover" : frame ? "frame" : "none";
  return (
    <div data-result="running-picture" data-shows={shows} className={cn(TILE, "w-full")}>
      <div
        className={cn(
          "absolute inset-0 overflow-hidden bg-surface-sunken",
          RADIUS[size],
          shows === "none" ? "shadow-[inset_0_0_0_1px_var(--color-border)]" : SHADOW[size],
        )}
      >
        {video ? (
          <RunVideo key={video} src={video} still={still} onFail={onFail} />
        ) : cover ? (
          <Still key={cover} src={cover} onFail={onFail} />
        ) : frame ? (
          <Still key={frame} src={frame} onFail={onFail} />
        ) : null}
        {!video && !still && (
          // White over a picture, as the play mark on footage: a band of light whichever the theme.
          <span
            data-part="sweep"
            aria-hidden="true"
            className={cn(
              // Its resting place in the property the keyframes animate: a `translate` class would add to them.
              "pointer-events-none absolute inset-x-0 top-0 h-[38%] [transform:translateY(-106%)] bg-linear-to-b from-transparent via-white/20 to-transparent",
              SWEEP,
            )}
          />
        )}
      </div>
    </div>
  );
});

/**
 * Where the count will stand: the words, three dots in turn and the time since the start. It lays
 * itself out as the count does in the same box: in a box under 290 wide (a 320 phone) one line cannot
 * hold it, so there the time always stands under the words; from 290 on, one line.
 */
function BuildingLine({ elapsed }: { elapsed: number }) {
  return (
    <p data-part="building" className={UNDER_LINE}>
      <span className={cn("text-title font-[640] text-foreground", UNDER_FIRST_LINE)}>
        Building your 1,000 viewers
        <span data-part="dots" aria-hidden="true" className="ml-0.5 inline-flex gap-[3px]">
          {BLINK_DELAYS.map((delay, i) => (
            <i key={i} className={cn("block size-1 rounded-full bg-current", BLINK, delay)} />
          ))}
        </span>
      </span>
      {/* Not announced every second; the page's heading names the screen. */}
      <span data-result="running-clock" aria-hidden="true" className="text-ui text-foreground-secondary tabular-nums">
        {timecode(elapsed)}
      </span>
    </p>
  );
}

/** Where the line will be: a dotted base with a quiet band of light passing over it. */
function WaitPlot({ width, height, still }: { width: number; height: number; still: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden="true">
        <path
          data-part="base"
          d={`M0 ${WAIT_BASE_Y}H${width}`}
          fill="none"
          stroke="var(--color-foreground)"
          strokeOpacity={0.16}
          strokeWidth={2}
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
      </svg>
      {!still && (
        // The carrier is as wide as the plot and moves by its own width; the band rides its left edge.
        <span data-part="scan" aria-hidden="true" className={cn("absolute inset-0 [transform:translateX(-60px)]", SCAN)}>
          <i className="block h-full w-[60px] bg-linear-to-r from-transparent via-foreground/[0.07] to-transparent" />
        </span>
      )}
    </div>
  );
}

/**
 * One tile of the wait's strip: it shimmers while empty and takes its scene's frame once it has loaded.
 * Once a picture for its scene has loaded the tile stays filled: the same frame sent again under a
 * new address (the stream replays on a reconnect, and a stored picture is signed anew) does not hide
 * it and start over. A picture that cannot load leaves the tile empty and still: a shimmer would
 * promise a frame that is not coming.
 */
function WaitTile({ frame, still }: { frame: string | null; still: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const broken = frame !== null && failed === frame;
  const shown = frame !== null && loaded && !broken;
  return (
    <div
      data-tile=""
      data-filled={shown ? "" : undefined}
      data-failed={broken ? "" : undefined}
      className={cn("relative min-w-0 flex-1 overflow-hidden", STRIP_TILE)}
    >
      {!shown && !broken && !still && (
        // The card's own surface passing over the sunken tile: a shimmer in either theme, from tokens.
        <span
          data-part="shimmer"
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-linear-to-r from-transparent from-30% via-surface via-50% to-transparent to-70%",
            SHIMMER,
          )}
        />
      )}
      {frame && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address
        <img
          src={frame}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(frame);
          }}
          className={cn("absolute inset-0 block h-full w-full", STRIP_CROP, shown ? SETTLE : "opacity-0")}
        />
      )}
    </div>
  );
}

/**
 * The strip while the scenes are not known: equal tiles, seven or as many as the latest frame names
 * (never more than a run has scenes), each filled with its scene's frame as it arrives.
 */
function WaitStrip({ frames, width, still }: { frames: ReadonlyArray<string | null>; width: number; still: boolean }) {
  const count = Math.min(MOST_TILES, Math.max(WAIT_TILES, frames.length));
  return (
    <div
      data-result="running-strip"
      data-tiles={count}
      className="flex"
      style={{ width, height: stripHeight(width), gap: STRIP_GAP_PX }}
    >
      {Array.from({ length: count }, (_, i) => (
        <WaitTile key={i} frame={frames[i] ?? null} still={still} />
      ))}
    </div>
  );
}

/** The line's place in the result's own frame: the plot waiting, the strip filling, the times' row empty. */
function WaitLine({
  width,
  height,
  frames,
  still,
  stripStill,
}: {
  width: number;
  height: number;
  frames: ReadonlyArray<string | null>;
  still: boolean;
  /** The strip's tiles stand still (reduced motion, or no frame is coming). */
  stripStill: boolean;
}) {
  return (
    <LineFrame
      width={width}
      height={height}
      plot={<WaitPlot width={width} height={height} still={still} />}
      strip={<WaitStrip frames={frames} width={width} still={stripStill} />}
      times={null}
    />
  );
}

interface WaitParts {
  tile: React.ReactNode;
  under: React.ReactNode;
  frames: ReadonlyArray<string | null>;
  still: boolean;
  stripStill: boolean;
}

/** Phone: the first card, nothing under it. */
function PhoneWait({ tile, under, frames, still, stripStill }: WaitParts) {
  const [cardRef, width] = useContentWidth<HTMLDivElement>(PHONE_LINE_FALLBACK);
  return (
    <div className={PHONE_COLUMN}>
      <FirstCard
        name="running"
        cardRef={cardRef}
        tile={tile}
        under={under}
        line={<WaitLine width={width} height={PLOT_PX.phone} frames={frames} still={still} stripStill={stripStill} />}
      />
    </div>
  );
}

/** Wide window: the result's two columns; the sentence's card empty, no tabs, no panel. */
function WideWait({ tile, under, frames, still, stripStill }: WaitParts) {
  const [lineCard, width] = useContentWidth<HTMLDivElement>(WIDE_LINE_FALLBACK);
  return (
    <WideFrame
      name="running"
      tile={tile}
      under={under}
      first={null}
      lineCardRef={lineCard}
      line={<WaitLine width={width} height={PLOT_PX.wide} frames={frames} still={still} stripStill={stripStill} />}
    />
  );
}

/** The screen itself, from what is known about the run so far. */
function RunningScreen({
  id,
  progress,
  video: givenVideo,
  startedAt,
  elapsed: fixedElapsed,
  viewport,
}: {
  id: string;
  progress: RunProgress;
  video: string | null;
  startedAt: number | null;
  elapsed?: number;
  viewport?: Viewport;
}) {
  const measured = useIsMobileHydrated();
  const { isMobile, hydrated } = viewport ?? measured;
  const still = usePrefersReducedMotion();

  const [openedAt] = useState(() => Date.now());
  const now = useNow(fixedElapsed === undefined);
  // A start this device does not know, or one ahead of its clock, counts from the screen's opening.
  const origin = startedAt !== null && startedAt <= openedAt ? startedAt : openedAt;
  const elapsed = fixedElapsed ?? elapsedSeconds(origin, now);

  // What failed to load falls through to the next: the clip, the cover, the first frame, nothing.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const onFail = useCallback(
    (src: string) => setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src))),
    [],
  );
  const usable = (src: string | null) => (src !== null && !failed.has(src) ? src : null);
  const arrived = arrivedFrames(progress);
  const usableCover = usable(progress.cover);
  const firstFrame = arrived.find((src) => !failed.has(src)) ?? null;
  const video = usable(givenVideo);
  const cover = video ? null : usableCover;
  const frame = video || cover ? null : firstFrame;

  // The still of this run (what the tile shows, or under the creator's clip the first frame that
  // arrived): the result's player stands on it when the result takes this screen's place.
  const picture = usableCover ?? firstFrame;
  useEffect(() => {
    if (picture) rememberRunStill(id, picture);
    // What was remembered could not load, and nothing else has come: no picture to stand on.
    else forgetRunStill(id);
  }, [id, picture]);

  // Before the viewport is measured: the result's empty frame, so the clip mounts once, in its layout.
  if (!hydrated) return <ResultFrame />;

  const parts: WaitParts = {
    tile: (
      <RunningTile
        video={video}
        cover={cover}
        frame={frame}
        size={isMobile ? "hero" : "desktop"}
        still={still}
        onFail={onFail}
      />
    ),
    under: <BuildingLine elapsed={elapsed} />,
    frames: progress.frames,
    still,
    stripStill: still || (elapsed >= FRAMES_DUE_S && arrived.length === 0),
  };
  return isMobile ? <PhoneWait {...parts} /> : <WideWait {...parts} />;
}

/** The live run: its own stream; at the finish the stored row is asked for at once. */
function LiveRunning({ id, startedAt, viewport }: { id: string; startedAt: number | null; viewport?: Viewport }) {
  const client = useQueryClient();
  const progress = useRunStream(id, () => {
    void client.invalidateQueries({ queryKey: queryKeys.analysis.detail(id) });
  });
  return <RunningScreen id={id} progress={progress} video={runVideoOf(id)} startedAt={startedAt} viewport={viewport} />;
}

/**
 * A video simulation still in flight: the result's first block building
 * itself, drawn by the result's own layout parts (`first-block.tsx`), so the result takes its place
 * without a jump. The tile shows the creator's own clip (a run this tab started from a file), else the
 * post's cover once the stream names it, else the first scene frame that arrived, else nothing; under
 * it "Building your 1,000 viewers" and the time since the start; where the line will be, a dotted base
 * with a band of light passing; the strip's tiles fill with the scenes' frames as they arrive. No
 * count, no line, no percent: the stream carries none. The roster is read, not drawn. The row keeps
 * polling (useSimulationRow); the stream's finish asks for it at once, and the page turns into the
 * result.
 *
 * `preview` is for the dev page and tests only: it replaces the stream, the remembered video and the
 * clock.
 */
export function Running({
  id,
  startedAt,
  preview,
  viewport,
}: {
  id: string;
  startedAt: number | null;
  preview?: RunningPreview;
  /** The page's measurement of the window; measured here when the screen is drawn on its own. */
  viewport?: Viewport;
}) {
  if (!preview) return <LiveRunning id={id} startedAt={startedAt} viewport={viewport} />;
  return (
    <RunningScreen
      id={id}
      progress={preview.progress ?? NO_PROGRESS}
      video={preview.video ?? null}
      startedAt={startedAt}
      elapsed={preview.elapsed}
      viewport={viewport}
    />
  );
}
