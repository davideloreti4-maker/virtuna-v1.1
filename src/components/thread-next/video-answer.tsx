"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Gauge } from "@/components/result/gauge";
import { useSimulationRow } from "@/hooks/queries/use-simulation-row";
import { resultHref } from "@/lib/result/href";
import type { ResultState, VideoModel } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import type { VideoTestCardBlock } from "@/lib/tools/profile-blocks";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerPrimary, PROSE } from "./answer-card";
import { arcPath } from "./answer-gauge";
import { ExpandIcon } from "./answer-icons";
import { MiniCurve } from "./mini-curve";

/**
 * The video card, done (spec §4.5; drawing `.scratch/next-look/part3/answers/answers.html`,
 * `axVideoDone`, `axVideoDoneDesk`, `.ax-vc`, `.tq-rt`, `.ax-vd*`, `.tq-cv`, `.tq-say`): what a
 * video simulation found, read from the SAME model as `/simulation/[id]` (`useSimulationRow` →
 * `videoStateOf`), so the card and the page cannot disagree.
 *
 * - The result: the thumbnail; the result page's gauge (`Gauge`, 140, `headlineOf`: "watch to the
 *   end"); the still mini line (`MiniCurve`) with the named scene banded in coral; the sentence
 *   (`verdictOf`); the one primary "Open simulation" (free, a link, the arrow).
 * - While the row loads or the run is still in flight: the thumbnail and the gauge's track with
 *   no number, and the primary.
 * - No audience, a run that stalled, a row that cannot be read: the thumbnail and the primary.
 *
 * Phone (`.ax-vc`): the thumbnail 96 on the left and the gauge centred in the rest, 10 apart; the
 * line the card's width × 72, 12 under; the sentence 16 / 660 (drawn 16.5) 12 under; the primary
 * 12 under. Desk (`.ax-vd`, from 768 wide): the picture 120 on the left, 28 to a column holding the
 * gauge and the sentence (18 / 660, drawn 19) 22 apart, and the line (its width × 64) at the
 * column's foot; the primary 20 under.
 *
 * Both are ONE tree placed on a grid by the `md:` breakpoint, so the first paint is already the
 * right one at any width (a media-query hook answers only after mount, and the card would jump from
 * the phone layout to the desk one). Phone: columns 96 · rest, rows picture+gauge / line / sentence.
 * Desk: columns 120 · gauge · rest, rows gauge+sentence / line, the picture down both rows (its
 * height sets the second row, so the line sits at the picture's foot as drawn). The line is drawn
 * to the box CSS gives it, measured before paint.
 *
 * The thumbnail: the first scene frame the run stored, else the card's first filmstrip frame,
 * else a plain tile (stored frame addresses expire; one that fails to load leaves the tile). The
 * gauge's track is the thread's stronger `--color-gauge-track`, as drawn (the drawing's answers
 * re-value `--track` for every gauge).
 */

const GAUGE_SIZE = 140;

/** The big gauge's arc at a size, as the result page's `Gauge` draws it: stroke 13, 10 inside the box. */
export function bigArc(size: number) {
  const stroke = 13;
  const m = size / 2;
  const r = m - stroke / 2 - 10;
  return { stroke, m, r, d: arcPath(m, r, 135, 405), height: Math.round(size * 0.88) };
}

/** The picture of the video: a frame, or a plain tile. Decorative: the turn above shows the video. */
export function VideoThumb({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <div
      data-part="thumb"
      aria-hidden
      className={cn(
        "relative aspect-[9/16] shrink-0 overflow-hidden rounded-xl bg-surface-sunken shadow-[0_0_0_1px_var(--color-border),0_10px_22px_-10px_var(--color-scrim)]",
        className,
      )}
    >
      {show && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address (or a frame drawn in the browser); next/image has nothing to optimise
        <img src={src} alt="" onError={() => setFailed(src)} className="block size-full object-cover object-[50%_10%]" />
      )}
    </div>
  );
}

/**
 * A label in two lines of about equal length ("watch to" / "the end"): at 140 one line runs into
 * the arc. One word stays one line.
 */
export function twoLines(label: string): string[] {
  const words = label.trim().split(/\s+/);
  if (words.length < 2) return [label.trim()];
  let best = 1;
  let bestLength = Infinity;
  for (let k = 1; k < words.length; k++) {
    const longer = Math.max(words.slice(0, k).join(" ").length, words.slice(k).join(" ").length);
    if (longer < bestLength) {
      bestLength = longer;
      best = k;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** The gauge with its number, the thread's stronger track, the label in two lines. */
function BigGauge({ model }: { model: VideoModel }) {
  return (
    <div className="shrink-0 [--color-track:var(--color-gauge-track)]">
      <Gauge headline={model.headline} size={GAUGE_SIZE} lines={twoLines(model.headline.label)} />
    </div>
  );
}

/** The gauge's track alone: the run's number is not there yet. */
function TrackOnly({ label }: { label: string }) {
  const { stroke, d, height } = bigArc(GAUGE_SIZE);
  return (
    <div data-part="track-only" role="img" aria-label={label} className="shrink-0" style={{ width: GAUGE_SIZE, height }}>
      <svg aria-hidden width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`} className="block overflow-visible">
        <path d={d} fill="none" stroke="var(--color-gauge-track)" strokeWidth={stroke} strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** The phone's line before it is measured (393 wide: the card's 329 × 72). */
const CURVE_FALLBACK = { width: 329, height: 72 };

/**
 * The size CSS gives a box, measured before the browser paints (a layout effect) and followed as it
 * resizes: the line is drawn to it, 329 × 72 on a phone, 532 × 64 on a desk.
 */
function useBoxSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = Math.floor(el.clientWidth);
      const height = Math.floor(el.clientHeight);
      if (width > 0 && height > 0) setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** The line, drawn to the box it gets. */
function CurveBox({ model, className }: { model: VideoModel; className?: string }) {
  const [ref, size] = useBoxSize<HTMLDivElement>(CURVE_FALLBACK);
  const band = model.moment ? { t0: model.moment.t0, t1: model.moment.t1 } : null;
  return (
    <div ref={ref} data-part="curve-box" className={className}>
      <MiniCurve points={model.audience.points} clipS={model.clipS} band={band} width={size.width} height={size.height} />
    </div>
  );
}

export function VideoAnswerView({ state, posterUrl, href }: { state: ResultState; posterUrl: string | null; href: string }) {
  const model = state.kind === "result" ? state.model : null;
  const pending = state.kind === "loading" || state.kind === "running";
  const dial = model ? <BigGauge model={model} /> : pending ? <TrackOnly label={state.kind === "loading" ? "Loading" : "Simulating"} /> : null;

  return (
    <AnswerCard>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-2.5 pt-2.5 md:grid-cols-[120px_auto_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start md:gap-x-0">
        <VideoThumb src={posterUrl} className="col-start-1 row-start-1 w-24 md:row-[1/3] md:w-[120px]" />
        {dial && (
          <div data-part="dial" className="col-start-2 row-start-1 justify-self-center md:ml-7 md:justify-self-start">
            {dial}
          </div>
        )}
        {model && (
          <>
            <CurveBox
              model={model}
              className="col-[1/3] row-start-2 mt-3 h-[72px] md:col-[2/4] md:row-start-2 md:ml-7 md:mt-2 md:h-16 md:self-end"
            />
            <p
              data-part="say"
              className={cn(
                "col-[1/3] row-start-3 mt-3 text-title font-[660] leading-[21px] tracking-[-0.016em] text-foreground",
                "md:col-[3/4] md:row-start-1 md:ml-[22px] md:mt-0 md:self-center md:text-subhead",
                PROSE,
              )}
            >
              {model.verdict.sentence}
            </p>
          </>
        )}
      </div>
      <div className="mt-3 md:mt-5">
        <AnswerPrimary icon={<ExpandIcon size={20} aria-hidden className="shrink-0" />} label="Open simulation" href={href} trailingArrow />
      </div>
    </AnswerCard>
  );
}

/**
 * The thumbnail's address: the first scene frame the run stored, else `fallback` (the card's first
 * filmstrip frame), else none.
 */
export function posterOf(state: ResultState, fallback: string | null): string | null {
  const frame = state.kind === "result" ? state.model.audience.scenes.find((scene) => scene.frame)?.frame : null;
  return frame ?? fallback;
}

/** A `video-test-card` in the thread: its run's stored row, read as the result page reads it. */
export function VideoAnswer({ block }: { block: VideoTestCardBlock }) {
  const id = block.props.analysisId;
  const { row, notFound } = useSimulationRow(id);
  const state: ResultState = notFound ? { kind: "stalled", id } : videoStateOf(row);
  const poster = posterOf(state, block.props.filmstrip?.[0]?.keyframeUrl ?? null);
  return <VideoAnswerView state={state} posterUrl={poster} href={resultHref(id)} />;
}
