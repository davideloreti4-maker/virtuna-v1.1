"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useState } from "react";

import { circles } from "@/components/result/audience-ring";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { creditCost } from "@/lib/pricing";
import { ringDots, type RingLayout } from "@/lib/result/ring-layout";
import { cn } from "@/lib/utils";

import { creditsLabel } from "./answer-card";
import { ChevronIcon } from "./field-icons";

/**
 * The small gauge (spec §3 rule 4; drawing `.scratch/next-look/part3/answers/answers.html`, `mg()`
 * as `axG`, `axG0`, `axGw` and `axGrun`): the product's signature on everything that can be
 * simulated as text. Four states:
 *
 * - empty: the track and the pulse glyph. Not simulated; a tap simulates (1 credit). The one state
 *   that is a control, named after the text it simulates.
 * - waiting: the track alone, dimmed. Queued behind another run; not a control.
 * - running: the audience ring in small, half lit (`rl(s, 52)`), turning slowly. Not with reduced
 *   motion: then it stands still.
 * - done: the ink arc and the number, "would stop to watch". With its result page (`href`, step 2) it
 *   is ONE link around the same picture, named "Open the result: <text>" and described by the number
 *   (the name replaces the content, so the number is read as the description). Without one, not a
 *   control. A score that lands while the creator watches draws and counts up (`useCountUp`).
 *
 * Geometry as drawn, for any size (46 in a pack row, 30 in a script or remix slot): a 270° arc
 * from 135°, stroke 9.8% of the size, 1.5 inside the box; no tick (no "usual"). The track is
 * `--color-gauge-track`, stronger than the result page's `--color-track` so a thin arc still reads
 * as a gauge (drawing review 2026-11-21). The number is drawn in the SVG (its sizes sit outside
 * the type roles), on the baseline the drawing's centred line puts it.
 */

export type GaugeState =
  | { kind: "empty" }
  | { kind: "waiting" }
  | { kind: "running" }
  | { kind: "done"; value: number };

/** A gauge's name carries at most this many characters of the text it simulates. */
const NAME_CHARS = 60;

/** Inter's ascent and content area per em: the baseline of a line centred on the gauge. */
const ASCENT = 0.96875;
const CONTENT = 1.2109;

export function clipName(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= NAME_CHARS ? t : `${t.slice(0, NAME_CHARS - 1).trimEnd()}…`;
}

/** A simulated text's number in words: the done gauge's name, and a result link's description. */
export function stopWords(value: number): string {
  return `${Math.round(value)}% would stop to watch`;
}

/** An arc on a circle, clockwise from `a0` to `a1` degrees (0° points right). The drawing's `arcP`. */
export function arcPath(m: number, r: number, a0: number, a1: number): string {
  const at = (a: number) => [m + r * Math.cos((a * Math.PI) / 180), m + r * Math.sin((a * Math.PI) / 180)] as const;
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** The drawing's `mg()` measures for a size. */
function measures(size: number) {
  const stroke = +(size * 0.098).toFixed(1);
  const m = size / 2;
  const r = m - stroke / 2 - 1.5;
  return { stroke, m, d: arcPath(m, r, 135, 405) };
}

/** The pulse glyph (the drawing's `I.sims`), 24 viewBox. Also the "Simulate all" icon. */
export function PulseGlyph({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3.5 12h3l2.2-6 3.6 12 2.4-8 1.4 2h4.4" />
    </svg>
  );
}

function Track({ size }: { size: number }) {
  const { stroke, d } = measures(size);
  return <path data-part="track" d={d} fill="none" stroke="var(--color-gauge-track)" strokeWidth={stroke} strokeLinecap="round" />;
}

// ─── Running: the audience ring in small ─────────────────────────────────────

/**
 * The drawing's ring groups (`G10`): ten wedges by their share of the audience. The running ring
 * shows no data; these only give it the ring's shape.
 */
const SHARES = [16, 14, 12, 12, 9, 9, 8, 7, 7, 6];
/** How much of the ring is lit (`rl(s, 52)`), counted round from 12 o'clock. */
const LIT_PERCENT = 52;

interface SmallRing {
  layout: RingLayout;
  dotR: number;
  lit: string;
  pale: string;
}

const smallRings = new Map<number, SmallRing>();

/** `ring({ r1: s/4, R: s/2 - 0.5, n: 120, gap: 7, pad: 1, dot: 0.33, lit: fillTo(52) })`, laid out once per size. */
function smallRing(size: number): SmallRing {
  let ring = smallRings.get(size);
  if (ring) return ring;
  const layout = ringDots(
    SHARES.map((weight, i) => ({ group: String(i) as Archetype, weight, present: true })),
    { r1: size * 0.25, R: size / 2 - 0.5, n: 120, gapDeg: 7, pad: 1 },
  );
  const dotR = +(layout.pitch * 0.33).toFixed(2);
  let before = 0;
  const lit: string[] = [];
  const pale: string[] = [];
  layout.wedges.forEach((wedge, i) => {
    const share = SHARES[i]!;
    const part = Math.max(0, Math.min(1, (LIT_PERCENT - before) / share));
    before += share;
    const on = Math.round(part * wedge.dots.length);
    if (on > 0) lit.push(circles(wedge.dots.slice(0, on), dotR));
    if (on < wedge.dots.length) pale.push(circles(wedge.dots.slice(on), dotR));
  });
  ring = { layout, dotR, lit: lit.join(""), pale: pale.join("") };
  smallRings.set(size, ring);
  return ring;
}

function RunningRing({ size }: { size: number }) {
  const { layout, lit, pale } = smallRing(size);
  return (
    <svg
      aria-hidden
      data-part="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${layout.size} ${layout.size}`}
      className="block motion-safe:animate-[spin_2.4s_linear_infinite]"
    >
      <path data-part="dots" d={pale} fill="var(--color-foreground)" opacity={0.13} />
      <path data-part="dots" d={lit} fill="var(--color-foreground)" />
    </svg>
  );
}

// ─── A score that lands while watched ────────────────────────────────────────

/** How long the arc draws and the number counts (thread feel §4.4); `.gauge-draw` in globals.css matches. */
const COUNT_MS = 700;

/** The curve `--ease-out` (cubic-bezier(0.215, 0.61, 0.355, 1)) stands for, so the number keeps pace with the arc. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** No `matchMedia` (or reduced motion asked for): at rest. */
function motionAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Thread feel §4.4: a gauge the creator is looking at that turns done from running or waiting draws
 * its arc from nothing and counts its number up from 0, both in 700 ms. A gauge drawn done (a stored
 * score, a reload, a seal that came with no run in view) is at rest, and so is every gauge with
 * reduced motion. Only the drawn number moves: the name, `data-value` and what a screen reader hears
 * are the final value from the first frame.
 *
 * The previous kind is kept in state and compared while rendering (React's way to remember a prop),
 * not in a ref read during render, so the render stays pure and the first frame drawn done is
 * already the count's start. `before` seeds it for a gauge mounted new at the moment its score
 * lands (`shownBefore`, from `GaugeSlot`). `progress` is the share of the count drawn, 1 at rest;
 * `drawing` ends with the count.
 */
function useCountUp(kind: GaugeState["kind"], before: GaugeState["kind"] = kind): { drawing: boolean; progress: number } {
  const [seen, setSeen] = useState(before);
  const [drawing, setDrawing] = useState(false);
  const [progress, setProgress] = useState(1);
  if (kind !== seen) {
    const fresh = kind === "done" && (seen === "running" || seen === "waiting") && motionAllowed();
    setSeen(kind);
    setDrawing(fresh);
    setProgress(fresh ? 0 : 1);
  }
  // In a layout effect, so the clock starts with the frame that first shows the count.
  useLayoutEffect(() => {
    if (!drawing) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick() {
      const share = Math.min(1, (performance.now() - start) / COUNT_MS);
      setProgress(share);
      if (share < 1) frame = requestAnimationFrame(tick);
      // The count has ended: the draw class goes with it. A pack row gets its result link when the
      // queue ends, so its picture becomes a new element; with the class still on, the CSS draw
      // would play again from an empty arc under a number that stands still.
      else setDrawing(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [drawing]);
  return { drawing, progress };
}

// ─── The gauge ───────────────────────────────────────────────────────────────

export function SmallGauge({
  state,
  size = 46,
  label,
  onSimulate,
  href,
  words,
  shownBefore,
}: {
  state: GaugeState;
  size?: number;
  /** The text the gauge simulates: it names the empty gauge's button (and a done gauge's link). */
  label: string;
  onSimulate?: () => void;
  /** A simulated gauge's result page (step 2): the gauge becomes a link to it. */
  href?: string | null;
  /** A done gauge's number in words, when it measures something other than a text's stop
   *  ("38% watch to the end" for a video, in Library). Default: `stopWords(value)`. */
  words?: string;
  /** What its slot showed before this render, for a gauge mounted new as its score lands (a slot's
   *  link is a new element): mounted done after running or waiting, it counts up as if it had been
   *  there. Default: its own kind, so a gauge mounted done is at rest. */
  shownBefore?: GaugeState["kind"];
}) {
  const numberId = useId();
  const count = useCountUp(state.kind, shownBefore);
  const box = { width: size, height: size };

  if (state.kind === "running") {
    return (
      <span role="img" aria-label="Simulating" data-gauge="running" className="relative block shrink-0" style={box}>
        <RunningRing size={size} />
      </span>
    );
  }

  if (state.kind === "done") {
    const { stroke, m, d } = measures(size);
    const value = Math.round(state.value);
    const fill = Math.max(0, Math.min(100, value));
    const shown = count.drawing ? Math.round(easeOut(count.progress) * value) : value;
    const fontSize = Math.round(size * 0.31);
    const baseline = m + (ASCENT - CONTENT / 2) * fontSize;
    const picture = (
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block overflow-visible">
        <Track size={size} />
        {fill > 0 && (
          <path
            data-part="value"
            d={d}
            pathLength={100}
            fill="none"
            stroke="var(--color-foreground)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill} 100`}
            className={count.drawing ? "gauge-draw" : undefined}
          />
        )}
        <text
          x={m}
          y={baseline.toFixed(2)}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={700}
          letterSpacing="-0.03em"
          fill="var(--color-foreground)"
          className="tabular-nums"
        >
          {shown}
        </text>
      </svg>
    );
    if (href) {
      // `pointer-events-auto`: a pack's gauge column passes every other tap through to its row.
      return (
        <Link
          href={href}
          data-gauge="done"
          data-value={value}
          aria-label={`Open the result: ${clipName(label)}`}
          aria-describedby={numberId}
          className="tap-44 pointer-events-auto relative block shrink-0 rounded-full"
          style={box}
        >
          {picture}
          <span id={numberId} className="sr-only">
            {words ?? stopWords(value)}
          </span>
        </Link>
      );
    }
    return (
      <span role="img" aria-label={words ?? stopWords(value)} data-gauge="done" data-value={value} className="relative block shrink-0" style={box}>
        {picture}
      </span>
    );
  }

  if (state.kind === "waiting") {
    // Dimmed as drawn (`.tq-hook.wait .mg { opacity: 0.7 }`).
    return (
      <span role="img" aria-label="Waiting" data-gauge="waiting" className="relative block shrink-0 opacity-70" style={box}>
        <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block overflow-visible">
          <Track size={size} />
        </svg>
      </span>
    );
  }

  // Empty: the one control.
  return (
    <button
      type="button"
      data-gauge="empty"
      aria-label={`Simulate: ${clipName(label)}`}
      disabled={!onSimulate}
      onClick={onSimulate}
      className="tap-44 pointer-events-auto relative block shrink-0 cursor-pointer rounded-full text-foreground-muted transition-[color,scale] duration-150 hover:text-foreground motion-safe:active:scale-[0.96] disabled:cursor-default disabled:hover:text-foreground-muted"
      style={box}
    >
      <EmptyArt size={size} />
    </button>
  );
}

/** The empty gauge's picture: the track and the pulse glyph, 15 in a 46 gauge and 12 in a 30 slot, as drawn. */
export function EmptyArt({ size }: { size: number }) {
  return (
    <>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block overflow-visible">
        <Track size={size} />
      </svg>
      <PulseGlyph size={size >= 40 ? 15 : 12} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    </>
  );
}

// ─── The slot: a 30 gauge with its caption ───────────────────────────────────

/**
 * What a slot's gauge showed before this render, handed to the gauge (`shownBefore`). A slot that
 * gets its result page with its score swaps its row for a link, a new element, so the gauge inside
 * is mounted new at the very moment the score lands and would start at rest: React cannot move a
 * mounted gauge into the new link. Kept in state and compared while rendering, as `useCountUp` does.
 * A page that arrives after the score (the kind unchanged) hands over the kind itself, so the score
 * is not counted twice.
 */
function useShownBefore(kind: GaugeState["kind"], linked: boolean): GaugeState["kind"] {
  const [last, setLast] = useState({ kind, linked, before: kind });
  if (last.kind !== kind || last.linked !== linked) {
    setLast({ kind, linked, before: last.kind !== kind ? last.kind : kind });
  }
  return last.before;
}

/** The slot's caption in each state that is not a control. */
const SLOT_CAPTION: Record<Exclude<GaugeState["kind"], "empty">, string> = {
  running: "Simulating",
  waiting: "Waiting",
  done: "would stop to watch",
};

/**
 * One line of a card that can be simulated (spec §4.3, §4.4; drawing `.ax-slot`): the script's
 * opening ("Simulate the opening") and the remix hook ("Simulate the hook").
 *
 * - empty: ONE button, the whole slot (the drawing's hit area is the slot, `.ax-hit`): the empty
 *   gauge at 30, the label, and the price in the `em` ("1 credit", `creditCost("react")`). Named
 *   "<label>: <the text it simulates>" (cut to 60 characters, as the gauge is), the price as its
 *   description.
 * - running / waiting / done: the small gauge at 30 (the ring, the dimmed track, the number) and
 *   "Simulating", "Waiting" or "would stop to watch". Not a control, except (step 2) a simulated slot
 *   with its result page (`href`): then ONE link, "would stop to watch" and a chevron, named
 *   "Open the result: <the text>" and described by the number. No `href` (its key not known yet): the
 *   words alone, never a dead link. A score that lands while watched counts up here too, link or not
 *   (`useShownBefore`).
 *
 * Geometry as drawn: 40 tall, 9 between the gauge and the text, 13 / 570 (drawn 13.5), the price
 * 500 in the muted ink. Margins are the caller's (`className`).
 */
export function GaugeSlot({
  state,
  label,
  text,
  onSimulate,
  href,
  className,
}: {
  state: GaugeState;
  /** "Simulate the opening", "Simulate the hook". */
  label: string;
  /** The text the slot simulates. */
  text: string;
  onSimulate?: () => void;
  /** A simulated slot's result page (step 2): the caption becomes a link. */
  href?: string | null;
  className?: string;
}) {
  const priceId = useId();
  const numberId = useId();
  const shownBefore = useShownBefore(state.kind, state.kind === "done" && !!href);
  const row = "flex h-10 items-center gap-[9px] text-meta font-[570] text-foreground";

  if (state.kind !== "empty") {
    if (state.kind === "done" && href) {
      return (
        <Link
          href={href}
          data-slot="done"
          aria-label={`Open the result: ${clipName(text)}`}
          aria-describedby={numberId}
          className={cn(row, "tap-44 -mx-1.5 rounded-xl px-1.5", className)}
        >
          <SmallGauge state={state} size={30} label={text} shownBefore={shownBefore} />
          <span>{SLOT_CAPTION.done}</span>
          <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="-ml-1 shrink-0 text-foreground-muted" />
          <span id={numberId} className="sr-only">
            {stopWords(state.value)}
          </span>
        </Link>
      );
    }
    return (
      <div data-slot={state.kind} className={cn(row, className)}>
        <SmallGauge state={state} size={30} label={text} shownBefore={shownBefore} />
        <span>{SLOT_CAPTION[state.kind]}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-slot="empty"
      aria-label={`${label}: ${clipName(text)}`}
      aria-describedby={priceId}
      disabled={!onSimulate}
      onClick={onSimulate}
      // An outlined button with the next-step chips' outline (the ink at 16%, inside): the control that
      // spends a credit read as a caption when it was a ring and a line of text (critic 2026-11-23).
      // The gauge sits 5 in; radius 8 since 2026-11-26 (was a pill); as wide as its words.
      className={cn(
        row,
        "tap-44 group w-fit cursor-pointer rounded-lg pl-[5px] pr-3.5 text-left inset-ring inset-ring-foreground/16 transition-colors duration-150 hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent",
        className,
      )}
    >
      <span
        aria-hidden
        className="relative block size-[30px] shrink-0 text-foreground-muted transition-colors duration-150 group-hover:text-foreground group-disabled:text-foreground-muted"
      >
        <EmptyArt size={30} />
      </span>
      <span>{label}</span>
      <em id={priceId} className="font-medium not-italic text-foreground-muted">
        {creditsLabel(creditCost("react"))}
      </em>
    </button>
  );
}
