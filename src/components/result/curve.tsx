"use client";

import { memo, useId, useMemo, useRef } from "react";
import { sceneEndShareAt, sceneIndexAt } from "@/lib/result/curve";
import { timecode } from "@/lib/result/format";
import type { VideoModel } from "@/lib/result/types";
import { LineFrame, stripHeight } from "./first-block";
import { LAND } from "./landing";
import { usePlayhead } from "./playhead";
import { SceneStrip } from "./scene-strip";

/** The line's y for a share still watching: 4 from the top at 100%, 4 from the bottom at 0%. */
export function lineY(pct: number, height: number): number {
  return 4 + (1 - pct / 100) * (height - 8);
}

const f = (n: number) => n.toFixed(1);

/**
 * A polyline with its corners rounded (radius 4): `M p0`, then per corner `L a Q corner b`, then
 * `L pn`. The mock's `rpoly`. The corners are the points themselves, so the line still passes
 * through every stored value.
 */
function roundedPolyline(P: ReadonlyArray<readonly [number, number]>, r = 4): string {
  let d = `M${f(P[0]![0])} ${f(P[0]![1])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const [x0, y0] = P[i - 1]!;
    const [x1, y1] = P[i]!;
    const [x2, y2] = P[i + 1]!;
    const l1 = Math.hypot(x1 - x0, y1 - y0);
    const l2 = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (!(k > 0)) {
      d += `L${f(x1)} ${f(y1)}`;
      continue;
    }
    d +=
      `L${f(x1 - ((x1 - x0) / l1) * k)} ${f(y1 - ((y1 - y0) / l1) * k)}` +
      `Q${f(x1)} ${f(y1)} ${f(x1 + ((x2 - x1) / l2) * k)} ${f(y1 + ((y2 - y1) / l2) * k)}`;
  }
  const [xe, ye] = P[P.length - 1]!;
  return `${d}L${f(xe)} ${f(ye)}`;
}

/** Everything about the line that does not move with the playhead. */
function geometryOf(model: VideoModel, width: number, height: number) {
  const { clipS, scenes, points } = model.audience;
  const x = (t: number) => (t / clipS) * width;
  const line = roundedPolyline(points.map(([t, pct]) => [x(t), lineY(pct, height)] as const));
  const end = x(points[points.length - 1]![0]);
  const base = height - 4;
  const named = model.verdict.scene == null ? null : (scenes[model.verdict.scene] ?? null);
  let loss: { band: { x: number; width: number }; clip: { x: number; width: number } } | null = null;
  if (named) {
    const a = x(named.t0);
    const b = x(named.t1);
    const bandWidth = Math.max(8, b - a);
    // The coral stroke covers the scene's own stretch; at either end of the clip it reaches past the
    // round cap.
    const clipA = a - (named.t0 <= 0 ? 6 : 0);
    const clipB = b + (named.t1 >= clipS ? 6 : 0);
    loss = { band: { x: a - (bandWidth - (b - a)) / 2, width: bandWidth }, clip: { x: clipA, width: clipB - clipA } };
  }
  return {
    line,
    fill: `${line}L${f(end)} ${base}L0 ${base}Z`,
    base,
    ticks: scenes.slice(1).map((scene) => f(x(scene.t0))),
    loss,
  };
}

type Geometry = ReturnType<typeof geometryOf>;

/** The still part of the line: base, fill, the named scene's band, ticks, the line, its coral. */
const CurveArt = memo(function CurveArt({
  geo,
  width,
  height,
  enter,
}: {
  geo: Geometry;
  width: number;
  height: number;
  enter: boolean;
}) {
  const clipId = useId();
  // The landing (landing.tsx): the line draws itself as a dash as long as the path, its coral and band
  // come in after it starts, the fill and the ticks after that.
  const land = (part: keyof typeof LAND) => (enter ? LAND[part] : undefined);
  return (
    <g>
      {geo.loss && (
        <defs>
          <clipPath id={clipId}>
            <rect x={f(geo.loss.clip.x)} y={-6} width={f(geo.loss.clip.width)} height={height + 12} />
          </clipPath>
        </defs>
      )}
      <path d={`M0 ${geo.base}H${width}`} stroke="var(--color-border)" />
      {/* The band sits under the fill: the soft fill still shows where the line is above it. */}
      {geo.loss && (
        <rect
          data-part="band"
          x={f(geo.loss.band.x)}
          y={0}
          width={f(geo.loss.band.width)}
          height={geo.base}
          rx={3}
          fill="var(--color-below-soft)"
          className={land("coral")}
        />
      )}
      <path data-part="fill" d={geo.fill} fill="var(--color-surface-sunken)" className={land("fill")} />
      {geo.ticks.map((x, i) => (
        <path
          key={i}
          data-part="tick"
          d={`M${x} ${geo.base}v-5`}
          stroke="var(--color-foreground-muted)"
          strokeWidth={1}
          className={land("fill")}
        />
      ))}
      <path
        data-part="line"
        d={geo.line}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={land("draw")}
        {...(enter ? { pathLength: 1, strokeDasharray: 1 } : {})}
      />
      {geo.loss && (
        <path
          data-part="loss"
          d={geo.line}
          fill="none"
          stroke="var(--color-below)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${clipId})`}
          className={land("coral")}
        />
      )}
    </g>
  );
});

/** A touch moves this far sideways (and more sideways than down) before it drags the playhead. */
const TOUCH_SLOP = 6;

/** The slider's box: a drag moves sideways, the page still scrolls up and down. */
const GRAB = "cursor-ew-resize touch-pan-y select-none";

/**
 * The still-watching line (the mock's `scrub` and `scr2`): 100% at 0:00, one point at the end of
 * each scene joined by straight lines (corners rounded 4), a soft fill under it, ticks at the scene
 * borders, the named scene in coral on a band at least 8 wide. `width` is the plot's width; `height`
 * the plot's (100 on the phone, 104 on desktop, 50 in the compact player).
 *
 * The playhead: at rest a dot at the clip's end and nothing else. While it moves, a vertical line at
 * the playhead's time, and one stored value shown twice as one thing: a dot on the line at the END of
 * the scene under the playhead, and above it a chip naming that point ("71% · 0:03"). While the video
 * runs through a scene the dot and chip stay at that scene's end; they move on when the playhead
 * crosses the border. The plot (and the strip under it) is a slider: drag or tap to seek, arrows step
 * by scene, Home to 0:00, End to rest.
 *
 * With `strip`, the scenes' frames under it (`SceneStrip`) when any scene has one: 38 tall, 46 on a
 * line wider than 400. Drawn through `LineFrame`, the frame the running screen keeps the line's place in.
 */
export function Curve({
  model,
  width,
  height,
  strip,
  mirror = false,
  enter = false,
}: {
  model: VideoModel;
  width: number;
  height: number;
  strip: boolean;
  /**
   * A copy of the page's line (the compact player while it is pinned): it follows the playhead and
   * pointer drags still seek, but it is not a second slider: hidden from assistive tech and not a
   * tab stop. The hero's (or desktop's) line is the one control.
   */
  mirror?: boolean;
  /**
   * The landing: the line draws itself, then its coral and its band, its fill and ticks, and its strip
   * come in (landing.tsx). Off by default; only the page's own line lands.
   */
  enter?: boolean;
}) {
  const { t, resting, seek, step } = usePlayhead();
  const { clipS, points } = model.audience;
  const geo = useMemo(() => geometryOf(model, width, height), [model, width, height]);
  const showStrip = useMemo(() => strip && model.audience.scenes.some((scene) => scene.frame), [strip, model]);

  const plotRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; touch: boolean; x: number; y: number; active: boolean } | null>(null);

  const seekAt = (clientX: number) => {
    const left = plotRef.current?.getBoundingClientRect().left ?? 0;
    seek(Math.min(1, Math.max(0, (clientX - left) / width)) * clipS);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const touch = event.pointerType === "touch";
    if (!touch && event.button !== 0) return;
    drag.current = { id: event.pointerId, touch, x: event.clientX, y: event.clientY, active: !touch };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // A mouse or pen seeks at once; a touch waits: it may be the start of a scroll.
    if (!touch) seekAt(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.active) {
      const dx = Math.abs(event.clientX - current.x);
      const dy = Math.abs(event.clientY - current.y);
      if (dx < TOUCH_SLOP || dx <= dy) return;
      current.active = true;
    }
    seekAt(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    // A tap: a touch that did not travel.
    if (current.touch && !current.active) {
      const moved = Math.hypot(event.clientX - current.x, event.clientY - current.y);
      if (moved < TOUCH_SLOP) seekAt(event.clientX);
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The slider pattern: up and right are forward, down and left back.
    if (event.key === "ArrowRight" || event.key === "ArrowUp") step(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") step(-1);
    else if (event.key === "Home") seek(0);
    else if (event.key === "End") seek(clipS);
    else return;
    event.preventDefault();
  };

  // The playhead's own time: the vertical line.
  const px = (t / clipS) * width;
  // The point the chip names: the end of the scene under the playhead, at its stored value (the
  // clip's end at rest). The dot sits there and the chip above it.
  const stored = sceneEndShareAt(model.audience, t);
  const end = points[sceneIndexAt(model.audience.scenes, t) + 1]!;
  const dotX = (end[0] / clipS) * width;
  const dotY = lineY(end[1], height);
  const valueText = `${timecode(stored.at)}, ${stored.pct}% still watching`;

  // Pointer drags seek on the slider and on its copy (the compact player's) alike.
  const pointer = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture: onPointerCancel,
  };
  const box: React.HTMLAttributes<HTMLDivElement> = mirror
    ? { "aria-hidden": true, ...pointer, className: GRAB }
    : {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Still watching",
        "aria-valuemin": 0,
        "aria-valuemax": clipS,
        "aria-valuenow": Math.round(t * 10) / 10,
        "aria-valuetext": valueText,
        onKeyDown,
        ...pointer,
        className: GRAB,
      };

  return (
    <LineFrame
      width={width}
      height={height}
      box={box}
      plotRef={plotRef}
      plotName="curve"
      plot={
        <>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="pointer-events-none block overflow-visible"
            aria-hidden
          >
            <CurveArt geo={geo} width={width} height={height} enter={enter} />
            {!resting && (
              <path
                data-part="playhead"
                d={`M${f(px)} 0V${height}`}
                stroke="var(--color-foreground)"
                strokeWidth={1.5}
              />
            )}
            <circle
              data-part="dot"
              // Landing: the dot waits for the line that is drawing itself towards it.
              className={enter ? LAND.dot : undefined}
              cx={f(dotX)}
              cy={f(dotY)}
              r={4.5}
              fill="var(--color-foreground)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </svg>
          {!resting && (
            <span
              data-part="readout"
              className="pointer-events-none absolute -top-[26px] h-[22px] -translate-x-1/2 whitespace-nowrap rounded-md bg-action px-2 text-label font-bold leading-[22px] text-action-foreground tabular-nums"
              style={{ left: Math.max(34, Math.min(width - 34, dotX)) }}
            >
              {stored.pct}% · {timecode(stored.at)}
            </span>
          )}
        </>
      }
      strip={showStrip ? <SceneStrip model={model} width={width} height={stripHeight(width)} /> : null}
      stripClassName={enter ? LAND.strip : undefined}
      times={[timecode(0), timecode(clipS)]}
    />
  );
}
