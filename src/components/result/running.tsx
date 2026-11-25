"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { queryKeys } from "@/lib/queries/query-keys";
import { timecode } from "@/lib/result/format";
import { NO_PROGRESS, arrivedFrames, elapsedSeconds, frameOnScreen, type RunProgress } from "@/lib/result/run-progress";
import { runVideoOf } from "@/lib/result/run-video";
import { cn } from "@/lib/utils";
import { SHADOW } from "./player";
import { equalRing, RunningRing } from "./running-ring";
import { useRunStream } from "./use-run-stream";

/**
 * What the dev page and the tests hand the screen instead of the live run: the stream's progress,
 * the creator's own video (null for none), the seconds on the clock, and `arriving`, the number of
 * wedges drawn while the groups arrive (the dev page's picture of the arrival).
 */
export interface RunningPreview {
  progress?: RunProgress;
  video?: string | null;
  elapsed?: number;
  arriving?: number;
}

/**
 * The reference's two rings (the mock's `rn2Ring2`; `run2-ring2-boxes.json`): the radii and dots,
 * the clock's gap under the dots, and the picture's corner and shadow (the result's video tile:
 * `hero` for the small one, `desktop` for the large one). Which one is drawn depends on the room
 * the stage has, not on the device.
 */
const SMALL = { name: "small", R: 175, r1: 140, n: 400, clockGap: 20, corner: "rounded-xl", shadow: SHADOW.hero } as const;
const LARGE = { name: "large", R: 265, r1: 212, n: 800, clockGap: 28, corner: "rounded-3xl", shadow: SHADOW.desktop } as const;
type RingSize = typeof SMALL | typeof LARGE;

/** The clock's height: `text-4xl` (36) at a line height of 1. */
const CLOCK_PX = 36;
/** Room the figure keeps above and below it, and beside the large ring. */
const CLEAR = 24;
/** Room the small ring keeps on each side before the whole figure is scaled down. */
const GUTTER = 8;
/** Every run has ten viewer groups; the ring is laid out for them before the roster says so. */
const GROUPS_BEFORE_ROSTER = 10;
/** One wedge appears every 60 ms once the roster is in. */
const ARRIVAL_STEP_MS = 60;
/** The picture stays this far clear of the innermost dots. */
const PICTURE_CLEAR = 8;

type Box = { width: number; height: number };

/**
 * The ring for a stage: the large one where its box and the clock hanging under it fit with
 * `CLEAR` all round (the ring is centred, so the clock's side decides the height: 713 for ten
 * groups), else the small one, scaled down as a whole where the stage is narrower than its box
 * and two gutters.
 */
function figureFor(stage: Box, groups: number): { size: RingSize; scale: number } {
  const large = equalRing(groups, LARGE.r1, LARGE.R, LARGE.n).layout;
  const reach = Math.max(large.size / 2, LARGE.R + large.dotR + LARGE.clockGap + CLOCK_PX);
  if (stage.width >= large.size + 2 * CLEAR && stage.height >= 2 * (reach + CLEAR)) return { size: LARGE, scale: 1 };
  const box = equalRing(groups, SMALL.r1, SMALL.R, SMALL.n).layout.size;
  const room = stage.width - 2 * GUTTER;
  return { size: SMALL, scale: room < box ? Math.max(0, room) / box : 1 };
}

/** The stage's content box as it resizes; null until it is measured. */
function useStageBox(): [React.RefObject<HTMLDivElement | null>, Box | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry?.contentRect ?? { width: 0, height: 0 };
      if (width > 0 && height > 0) setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, box];
}

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
 * How many wedges are drawn: none before the roster; then one more every 60 ms up to `total`. A
 * roster that is there when the screen opens is drawn whole, and so is any with reduced motion.
 * Wedges once drawn stay drawn, also when the motion setting changes while the screen is open.
 */
function useArrival(total: number, reducedMotion: boolean): number {
  const [count, setCount] = useState(total);
  if (reducedMotion && count < total) setCount(total);
  const arrived = count >= total;
  useEffect(() => {
    if (reducedMotion || arrived) return;
    const timer = setInterval(() => setCount((c) => c + 1), ARRIVAL_STEP_MS);
    return () => clearInterval(timer);
  }, [reducedMotion, arrived]);
  return reducedMotion ? total : Math.min(count, total);
}

// A new frame fades in over the one before, once its image has loaded (not with reduced motion:
// the frames stand still then).
const FRAME_FADE = "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500";
const FRAME = "absolute inset-0 block h-full w-full object-cover";

/** One image of the picture: its address and the turn it was put on top in (its React key). */
type Layer = { turn: number; src: string };

/**
 * The frame of the moment. A new frame stays hidden until its image has loaded, then fades in;
 * the last frame that was showing stays under it meanwhile.
 *
 * Every frame put on top is a new image element (keyed by its turn, not by its address): a frame
 * that is due again while it still lies underneath (two frames taking turns) must load as a new
 * image, or no `load` would come and it would stay hidden. The image underneath keeps its element
 * (and its key), so it does not reload either.
 */
function Frames({ current }: { current: string }) {
  const [state, setState] = useState<{ top: Layer; loaded: boolean; under: Layer | null }>({
    top: { turn: 0, src: current },
    loaded: false,
    under: null,
  });
  let { top, loaded, under } = state;
  if (top.src !== current) {
    // The frame showing now (the top once loaded, else what was under it) goes under the new one.
    under = loaded ? top : under;
    top = { turn: top.turn + 1, src: current };
    loaded = false;
    setState({ top, loaded, under });
  }
  const turn = top.turn;
  return (
    <>
      {under && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address
        <img key={under.turn} data-frame="previous" src={under.src} alt="" draggable={false} className={FRAME} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address */}
      <img
        key={turn}
        data-frame="current"
        data-loaded={loaded ? "" : undefined}
        src={top.src}
        alt=""
        draggable={false}
        onLoad={() => setState((prev) => (prev.top.turn === turn && !prev.loaded ? { ...prev, loaded: true } : prev))}
        className={cn(FRAME, loaded ? FRAME_FADE : "opacity-0")}
      />
    </>
  );
}

/**
 * The creator's own video: decoration that plays by itself, not the page's playhead, no controls,
 * no sound. With reduced motion it does not start by itself: its first frame shows. When it cannot
 * play (a revoked or expired address, autoplay refused) the run is shown as one without a video.
 */
function RunVideo({ src, still, onFail }: { src: string; still: boolean; onFail: (src: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (still) return;
    const playing = ref.current?.play();
    if (!playing) return;
    playing.catch((error: unknown) => {
      // An interrupted load is not a refusal.
      if ((error as { name?: string } | null)?.name !== "AbortError") onFail(src);
    });
  }, [src, still, onFail]);
  return (
    <video
      ref={ref}
      // Still: `#t=0.001` makes Safari paint the first frame instead of a black box.
      src={still ? `${src}#t=0.001` : src}
      muted
      autoPlay={!still}
      preload={still ? "metadata" : undefined}
      loop
      playsInline
      onError={() => onFail(src)}
      className="block h-full w-full object-cover"
    />
  );
}

/** The 9:16 picture in the ring's middle: the creator's own video, or the frame of the moment. */
const Picture = memo(function Picture({
  video,
  frame,
  width,
  height,
  size,
  still,
  onVideoFailed,
}: {
  video: string | null;
  frame: string | null;
  width: number;
  height: number;
  size: RingSize;
  still: boolean;
  onVideoFailed: (src: string) => void;
}) {
  return (
    <div
      data-result="running-picture"
      className={cn(
        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-surface",
        size.shadow,
        size.corner,
      )}
      style={{ width, height }}
    >
      {video ? <RunVideo key={video} src={video} still={still} onFail={onVideoFailed} /> : frame && <Frames current={frame} />}
    </div>
  );
});

/**
 * The ring, the picture inscribed in it and the clock. The ring's box is the figure's box and is
 * centred in the stage with auto margins (so a stage too short for it scrolls from the top
 * instead of clipping it); the picture sits in its middle and the clock, under the ring, hangs
 * below the box without pushing it. Scaled as a whole on a stage narrower than the small ring.
 */
function Figure({
  stage,
  groups,
  shown,
  video,
  frame,
  elapsed,
  still,
  onVideoFailed,
}: {
  stage: Box;
  groups: number;
  shown: number;
  video: string | null;
  frame: string | null;
  elapsed: number;
  still: boolean;
  onVideoFailed: (src: string) => void;
}) {
  const { size, scale } = figureFor(stage, groups);
  const { R, r1, n } = size;
  const { layout, innerRow } = equalRing(groups, r1, R, n);
  const box = layout.size;
  // The mock's tile: its half diagonal reaches to 8 clear of the innermost dots; 9:16.
  const halfDiagonal = innerRow - layout.dotR - PICTURE_CLEAR;
  const width = (2 * halfDiagonal * 9) / Math.sqrt(9 * 9 + 16 * 16);
  const height = (width * 16) / 9;
  const pictured = video != null || frame != null;

  return (
    <div
      data-running-figure=""
      data-ring={size.name}
      className="relative m-auto shrink-0"
      style={{ width: box * scale, height: box * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: box, height: box, ...(scale < 1 ? { transform: `scale(${scale})` } : null) }}
      >
        <RunningRing groups={groups} shown={shown} r1={r1} R={R} n={n} />
        {pictured && (
          <Picture
            video={video}
            frame={frame}
            width={width}
            height={height}
            size={size}
            still={still}
            onVideoFailed={onVideoFailed}
          />
        )}
        <p
          data-result="running-clock"
          data-clock={pictured ? "below" : "centre"}
          // Not announced every second; the page's heading names the screen.
          aria-hidden="true"
          className={cn(
            "absolute left-1/2 block -translate-x-1/2 whitespace-nowrap text-4xl font-bold leading-none tracking-[-0.04em] text-foreground tabular-nums",
            !pictured && "top-1/2 -translate-y-1/2",
          )}
          style={pictured ? { top: box / 2 + R + layout.dotR + size.clockGap } : undefined}
        >
          {timecode(elapsed)}
        </p>
      </div>
    </div>
  );
}

/** The screen itself, from what is known about the run so far. */
function RunningScreen({
  progress,
  video: givenVideo,
  startedAt,
  elapsed: fixedElapsed,
  arriving,
}: {
  progress: RunProgress;
  video: string | null;
  startedAt: number | null;
  elapsed?: number;
  arriving?: number;
}) {
  const [stageRef, stage] = useStageBox();
  const reducedMotion = usePrefersReducedMotion();

  const [openedAt] = useState(() => Date.now());
  const now = useNow(fixedElapsed === undefined);
  // A start this device does not know, or one ahead of its clock, counts from the screen's opening.
  const origin = startedAt !== null && startedAt <= openedAt ? startedAt : openedAt;
  const elapsed = fixedElapsed ?? elapsedSeconds(origin, now);

  const groups = progress.groups?.length ?? 0;
  const arrival = useArrival(groups, reducedMotion);
  const shown = arriving ?? arrival;

  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const onVideoFailed = useCallback((src: string) => setFailedVideo(src), []);
  const video = givenVideo !== null && givenVideo !== failedVideo ? givenVideo : null;
  const frame = video ? null : frameOnScreen(arrivedFrames(progress), elapsed, { still: reducedMotion });

  return (
    // What the shell leaves under the header: the page lays the stage out as its last flex child.
    // On the phone 9 under the header's band (as the result's first card) down to the bottom's
    // safe area; on desktop the content area under the header row.
    <div
      ref={stageRef}
      className="flex flex-1 pb-[env(safe-area-inset-bottom)] pt-[9px] md:pb-0 md:pt-0"
    >
      {stage && (
        <Figure
          stage={stage}
          groups={groups || GROUPS_BEFORE_ROSTER}
          shown={shown}
          video={video}
          frame={frame}
          elapsed={elapsed}
          still={reducedMotion}
          onVideoFailed={onVideoFailed}
        />
      )}
    </div>
  );
}

/** The live run: its own stream; at the finish the stored row is asked for at once. */
function LiveRunning({ id, startedAt }: { id: string; startedAt: number | null }) {
  const client = useQueryClient();
  const progress = useRunStream(id, () => {
    void client.invalidateQueries({ queryKey: queryKeys.analysis.detail(id) });
  });
  return <RunningScreen progress={progress} video={runVideoOf(id)} startedAt={startedAt} />;
}

/**
 * A video simulation still in flight (spec section 7; the mock's `look=ring2`): three things only,
 * the ring of the run's viewer groups, the picture in its middle (the creator's own video when this
 * device started the run, else the scene frames as they arrive) and the time since the start. No
 * stage, no percent, no estimate. The row keeps polling (useSimulationRow); the stream's finish
 * asks for it at once, and the page turns into the result.
 *
 * `preview` is for the dev page and tests only: it replaces the stream, the remembered video and
 * the clock.
 */
export function Running({ id, startedAt, preview }: { id: string; startedAt: number | null; preview?: RunningPreview }) {
  if (!preview) return <LiveRunning id={id} startedAt={startedAt} />;
  return (
    <RunningScreen
      progress={preview.progress ?? NO_PROGRESS}
      video={preview.video ?? null}
      startedAt={startedAt}
      elapsed={preview.elapsed}
      arriving={preview.arriving}
    />
  );
}
