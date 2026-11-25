"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useId, useMemo, useState, useSyncExternalStore } from "react";
import { porcelainLegend, type PorcelainLook } from "@/components/audience-lens/cortex-porcelain";
import { Card } from "@/components/ui/card";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { predictedBold, type NetworkId } from "@/lib/brain/cortex-sim";
import { FOCUS_LEVEL, SIGNAL_MEANING, focusSentence, momentLine, restWord } from "@/lib/result/brain-read";
import { brainTrackOf, type BrainSignal } from "@/lib/result/brain-track";
import { timecode } from "@/lib/result/format";
import type { VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { usePlayhead } from "./playhead";
import { useContentWidth } from "./use-content-width";

// WebGL (three.js): browser only, never rendered on the server.
const CortexCanvas = dynamic(() => import("@/components/audience-lens/CortexCanvas"), { ssr: false });

/**
 * Brain. The existing 3D brain driven by the existing model at the playhead, in porcelain,
 * as built; and the signals card: one sentence about Focus, the moment the rows are read at, and four
 * signals, each its name and what it stands for, its curve over the clip against its resting level,
 * and a word for where it stands at that moment. Away from rest a coral line marks the video's moment
 * on every curve: besides the named scene, the video's moment is the one thing coral marks. A model
 * of attention, not a scan.
 *
 * Phone: the brain card (232 tall), 10 below it the signals card, the caption under both. A panel 520
 * wide and up: the two cards side by side, 1 : 1.28, 16 apart, as tall as the signals card's content;
 * the brain at the phone's size, centred in its card's height.
 *
 * The brain is handed a new reading at most four times a second while the playhead moves: the
 * reading is taken on quarter seconds, and the canvas walks its surface between readings itself.
 * Only this component follows the playhead frame by frame; it hands the stage and the rows nothing
 * but quarter-second values, and both are memoised, so the WebGL root renders at most four times a
 * second while playing and not at all at rest.
 */
export function BrainPanel({ model }: { model: VideoModel }) {
  const playhead = usePlayhead();
  const track = useMemo(() => brainTrackOf(model), [model]);
  const look: PorcelainLook = usePaintedTheme() === "dark" ? "porcelain-dark" : "porcelain-light";
  const reducedMotion = usePrefersReducedMotion();

  const moving = !playhead.resting;
  const t = moving ? Math.min(model.clipS, Math.floor(playhead.t * 4) / 4) : model.clipS;
  const bold = useMemo(() => predictedBold(track.drive, t), [track, t]);
  const atEnd = useMemo(() => predictedBold(track.drive, model.clipS), [track, model.clipS]);

  return (
    <div data-result="brain">
      <div className="flex flex-col gap-2.5 @min-[520px]:grid @min-[520px]:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] @min-[520px]:gap-4">
        <BrainStage
          seed={track.seed}
          bold={bold}
          t={t}
          look={look}
          reducedMotion={reducedMotion}
          corner={moving ? `At ${timecode(t)}` : null}
        />
        <Signals model={model} signals={track.signals} bold={bold} atEnd={atEnd} t={t} moving={moving} />
      </div>
      <p className="mt-2.5 px-1 text-label leading-4 text-foreground-secondary">A model of attention, not a scan.</p>
    </div>
  );
}

// ── the brain ────────────────────────────────────────────────────────────────

/** The stage behind the brain (`--stage` in the mock), from the theme's tokens. */
const STAGE: Record<PorcelainLook, string> = {
  "porcelain-light":
    "radial-gradient(90% 80% at 50% 40%, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 30%, var(--color-background)) 100%)",
  "porcelain-dark":
    "radial-gradient(80% 70% at 50% 42%, color-mix(in srgb, var(--color-surface-elevated) 60%, var(--color-surface)) 0%, var(--color-surface) 100%)",
};

/** The shadow the brain casts on its stage (`--bshadow`, without the dark theme's warm glow). */
const CAST: Record<PorcelainLook, string> = {
  "porcelain-light": "drop-shadow(0 22px 20px color-mix(in srgb, var(--color-foreground) 16%, transparent))",
  "porcelain-dark": "drop-shadow(0 26px 24px color-mix(in srgb, var(--color-scrim) 83%, transparent))",
};

const BrainStage = memo(function BrainStage({
  seed,
  bold,
  t,
  look,
  reducedMotion,
  corner,
}: {
  seed: number;
  bold: Record<NetworkId, number>;
  t: number;
  look: PorcelainLook;
  reducedMotion: boolean;
  corner: string | null;
}) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [warm, hot] = porcelainLegend(look);

  return (
    <Card
      data-result="brain-stage"
      className="relative h-[232px] overflow-hidden p-0 @min-[520px]:h-auto"
      style={{ backgroundImage: STAGE[look] }}
    >
      {/* The brain fills the stage's height on the phone (232, set 7 below its top); on a wide panel
          it is the same 232, centred in the card's height, however tall the signals card makes it
          (at 164 it stood lost in a card that is about 390 tall). The stage clips what falls past
          its edge. */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-[7px] h-[232px] @min-[520px]:top-[calc(50%-116px)] motion-safe:transition-opacity motion-safe:duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ filter: CAST[look] }}
      >
        <CortexCanvas seed={seed} bold={bold} t={t} look={look} reducedMotion={reducedMotion} onReady={onReady} />
      </div>
      {/* On the phone a touch on the brain scrolls the page: the canvas's turn-it-by-hand control
          would otherwise hold every gesture that starts on it. */}
      <div className="absolute inset-0 @min-[520px]:hidden" />
      {corner && (
        <span className="absolute left-[18px] top-4 text-meta font-[560] leading-[21px] text-foreground-secondary tabular-nums">
          {corner}
        </span>
      )}
      <span className="absolute right-[18px] top-[17px] flex items-center gap-[7px] text-label leading-[21px] text-foreground-secondary">
        <span>calm</span>
        <i
          aria-hidden="true"
          className="block h-[5px] w-11 rounded-full"
          style={{
            backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--color-foreground) 10%, transparent), ${warm}, ${hot})`,
          }}
        />
        <span>active</span>
      </span>
    </Card>
  );
});

// ── the four signals ─────────────────────────────────────────────────────────

const ROW_H = 34;
/** The mock draws a level of 74 at the curve's top; a run that runs hotter widens the scale. */
const SCALE_TOP = 74;
/** The name and what it stands for: 112 wide; 96 where the card's inside is under 300 (a 320 phone). */
const LABEL_W = { wide: 112, narrow: 96 } as const;
const NARROW_BELOW = 300;
/** The word at the right ("above rest"), on one line. */
const WORD_W = 74;
/** The row's two gaps (`gap-2.5`). */
const GAPS = 20;

const Signals = memo(function Signals({
  model,
  signals,
  bold,
  atEnd,
  t,
  moving,
}: {
  model: VideoModel;
  signals: BrainSignal[];
  bold: Record<NetworkId, number>;
  /** The levels at the clip's end, where a clip that is not a whole number of seconds ends its line. */
  atEnd: Record<NetworkId, number>;
  t: number;
  /** Away from rest: the coral line at the moment on every curve. */
  moving: boolean;
}) {
  const [cardRef, inner] = useContentWidth<HTMLDivElement>(325);
  // The columns and the curve are sized from the one measured inside, so they always add up to it.
  const label = inner < NARROW_BELOW ? LABEL_W.narrow : LABEL_W.wide;
  const width = Math.max(40, inner - label - WORD_W - GAPS);
  const top = useMemo(() => Math.max(SCALE_TOP, ...signals.flatMap((s) => s.perSecond)), [signals]);
  const sentence = useMemo(() => {
    const focus = signals.find((signal) => signal.id === "dorsal_attention");
    return focus ? focusSentence(focus.perSecond, model.audience.scenes) : FOCUS_LEVEL;
  }, [signals, model]);

  return (
    <Card ref={cardRef} data-result="brain-signals" className="flex flex-col px-[18px] pb-2.5 pt-4 @min-[520px]:px-[22px]">
      <p data-part="focus-sentence" className="text-title font-[640] text-foreground tabular-nums">
        {sentence}
      </p>
      <p data-part="moment-line" className="mt-1.5 text-meta font-[560] text-foreground-secondary tabular-nums">
        {momentLine(t)}
      </p>
      <div className="mt-1">
        {signals.map((signal, i) => (
          <div
            key={signal.id}
            data-signal={signal.id}
            className={cn("flex items-center gap-2.5 py-2.5", i > 0 && "border-t border-border")}
          >
            <span className="shrink-0" style={{ width: label }}>
              <span data-label className="block text-ui font-[560] text-foreground">
                {signal.label}
              </span>
              <span data-meaning className="block text-label leading-4 text-foreground-secondary">
                {SIGNAL_MEANING[signal.id]}
              </span>
            </span>
            <SignalLine
              signal={signal}
              clipS={model.clipS}
              t={t}
              now={bold[signal.id] * 100}
              end={atEnd[signal.id] * 100}
              width={width}
              top={top}
              moving={moving}
            />
            <span
              data-word
              className="ml-auto shrink-0 whitespace-nowrap text-right text-meta font-[560] text-foreground-secondary"
              style={{ width: WORD_W }}
            >
              {restWord(bold[signal.id] * 100, signal.rest)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
});

/**
 * One signal over the clip (`sigLine`): the dashed resting level, the whole curve quiet, the part up
 * to the playhead in ink, a dot at the playhead and, away from rest, a coral line there. At rest the
 * playhead is the clip's end.
 */
function SignalLine({
  signal,
  clipS,
  t,
  now,
  end,
  width: W,
  top,
  moving,
}: {
  signal: BrainSignal;
  clipS: number;
  t: number;
  now: number;
  end: number;
  width: number;
  top: number;
  moving: boolean;
}) {
  const clipId = useId();
  const H = ROW_H;
  const y = (v: number) => yOf(v, top);

  const d = useMemo(() => {
    const xs = signal.perSecond.map((_, s) => xOf(s, clipS, W));
    const ys = signal.perSecond.map((v) => yOf(v, top));
    // One value per whole second; a clip that ends between two seconds ends at its last level.
    if (clipS - (signal.perSecond.length - 1) > 0.05) {
      xs.push(xOf(clipS, clipS, W));
      ys.push(yOf(end, top));
    }
    return monotonePath(xs, ys);
  }, [signal, clipS, end, W, top]);

  const px = xOf(t, clipS, W);
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
      <defs>
        <clipPath id={clipId}>
          <rect x={-3} y={-6} width={px + 3} height={H + 12} />
        </clipPath>
      </defs>
      <path
        d={`M0 ${y(signal.rest).toFixed(1)}H${W}`}
        stroke="var(--color-foreground-muted)"
        strokeWidth={1.25}
        strokeDasharray="2 4"
      />
      <path d={d} fill="none" stroke="var(--color-foreground-muted)" strokeWidth={1.5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth={2.25}
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />
      {moving && <path data-part="moment-mark" d={`M${f(px)} 0V${H}`} stroke="var(--color-below)" strokeWidth={2} />}
      <circle cx={px} cy={y(now)} r={4} fill="var(--color-foreground)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}

/** A second of the clip across the curve's width. */
const xOf = (s: number, clipS: number, width: number) => (clipS > 0 ? (s / clipS) * width : 0);
/** A level (0 to 100) up the row: `top` at the curve's top, 2 above the bottom at 0 (`sigLine`). */
const yOf = (v: number, top: number) => ROW_H - 2 - (v / top) * (ROW_H - 5);

const f = (n: number) => n.toFixed(1);

/**
 * A smooth line through the points that never overshoots them (monotone cubic, the mock's `mono`):
 * a level that only rises between two seconds is not drawn dipping.
 */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  let p = `M${f(xs[0]!)} ${f(ys[0]!)}`;
  if (n === 1) return p;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * d[i]!) / h;
      m[i + 1] = (3 * b * d[i]!) / h;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1]! - xs[i]!) / 3;
    p += `C${f(xs[i]! + h)} ${f(ys[i]! + m[i]! * h)} ${f(xs[i + 1]! - h)} ${f(ys[i + 1]! - m[i + 1]! * h)} ${f(xs[i + 1]!)} ${f(ys[i + 1]!)}`;
  }
  return p;
}

// ── hooks ────────────────────────────────────────────────────────────────────

/** The theme painted on <html data-theme> (the new look's light or dark), followed as it changes. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const paintedTheme = (): "light" | "dark" =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
const serverTheme = (): "light" | "dark" => "light";

function usePaintedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, paintedTheme, serverTheme);
}
