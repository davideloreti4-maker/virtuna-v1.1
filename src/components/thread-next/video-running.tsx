"use client";

import { useEffect, useState } from "react";

import { useVideoMeta } from "@/hooks/use-video-meta";
import { resultHref } from "@/lib/result/href";
import { clockLabel } from "@/lib/thread-next/beat-timing";

import { AnswerCard, AnswerPrimary } from "./answer-card";
import { PlayIcon } from "./answer-icons";
import { VideoThumb, bigArc } from "./video-answer";

/**
 * The video card while it simulates (spec §4.5, P8; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axVideoRun`, `axBigRun`): the live turn of a
 * video the creator just sent.
 *
 * - The staged file's thumbnail (`useVideoMeta`), a plain tile until the browser has drawn it.
 * - In the gauge's place, its track as dots (28 along the arc, the ink at 22%) and a clock counting
 *   from the moment the card appeared (or `startedAt`): "0:41". Under it "uploading" until the run
 *   has an id, then what to expect: "of about a minute" (a run takes 45 to 90 seconds, measured
 *   2026-11-19/20), and "taking longer" past 90 seconds (`runLabel`). A clock that only counts up
 *   gave the wait no end (review 2026-11-23). Only the label is a live region; the clock ticks
 *   silently.
 * - The one primary "Watch it run" (play icon, free, the arrow) opens the run's page once the run
 *   has an id; before that there is none.
 *
 * No percentage and no stage: the stream carries none the card could name (seam map §2.5).
 *
 * Geometry as drawn: the thumbnail 96 (120 on a desk) and the dial 140 × 123 centred in the rest,
 * 10 apart; the clock 35 / 700 at −0.04em, its baseline 30% of the box down plus 0.97 em; the label
 * 11 (drawn 11.5) / 430 in the secondary ink, its baseline 20 under the clock's; the primary 12 under.
 */

const SIZE = 140;
const DOTS = 28;

/** A run usually lands inside this many seconds (45 to 90 measured). */
const USUAL_RUN_S = 90;

/** Under the clock: what is happening, then what to expect. */
function runLabel(running: boolean, elapsedS: number): string {
  if (!running) return "uploading";
  // "of": the clock above counts up, so the line reads "0:44 of about a minute", never as time left.
  return elapsedS <= USUAL_RUN_S ? "of about a minute" : "taking longer";
}

/** Inter's ascent and content area per em: where a line's baseline sits. */
const ASCENT = 0.96875;
const CONTENT = 1.2109;
/** The label's role (caption, 11) on a 14 line. */
const LABEL_SIZE = 11;
const LABEL_LINE = 14;

function RunDial({ clock, label }: { clock: string; label: string }) {
  const { m, r, height } = bigArc(SIZE);
  const dots = Array.from({ length: DOTS }, (_, i) => {
    const a = ((135 + (270 * i) / (DOTS - 1)) * Math.PI) / 180;
    return { cx: (m + r * Math.cos(a)).toFixed(2), cy: (m + r * Math.sin(a)).toFixed(2) };
  });
  const clockSize = Math.round(SIZE * 0.25);
  const clockBase = 0.3 * height + clockSize * 0.97;
  const labelBase = clockBase + 20;
  const labelTop = labelBase - ((LABEL_LINE - CONTENT * LABEL_SIZE) / 2 + ASCENT * LABEL_SIZE);

  return (
    <div data-part="run-dial" className="relative shrink-0" style={{ width: SIZE, height }}>
      <svg aria-hidden width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block overflow-visible">
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r={2.7} fill="var(--color-foreground)" opacity={0.22} />
        ))}
        <text
          x={m}
          y={clockBase.toFixed(2)}
          textAnchor="middle"
          fontSize={clockSize}
          fontWeight={700}
          letterSpacing="-0.04em"
          fill="var(--color-foreground)"
          className="tabular-nums"
        >
          {clock}
        </text>
      </svg>
      <span
        aria-live="polite"
        className="absolute inset-x-0 text-center text-caption font-[430] leading-[14px] tracking-normal text-foreground-secondary"
        style={{ top: labelTop }}
      >
        {label}
      </span>
    </div>
  );
}

export function VideoRunning({
  file,
  analysisId,
  startedAt,
}: {
  /** The staged video, for its thumbnail. */
  file: File | null;
  /** The run's id once the stream has started it; null while the file uploads. */
  analysisId: string | null;
  /** When the creator sent it (ms). The moment the card appeared when not given. */
  startedAt?: number;
}) {
  const [start] = useState(() => startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { thumbnail } = useVideoMeta(file);
  // The run's own start: the moment its id arrived (a card that mounts with an id counts from its
  // start). "taking longer" is about the run, so a slow upload before it does not count against it.
  const [runStart, setRunStart] = useState<number | null>(() => (analysisId ? start : null));
  if (analysisId && runStart === null) setRunStart(now);
  const runElapsedS = runStart === null ? 0 : (now - runStart) / 1000;

  return (
    <AnswerCard>
      <div className="flex items-center gap-2.5 pt-2.5 md:gap-7">
        <VideoThumb src={thumbnail} className="w-24 md:w-[120px]" />
        {/* Desktop: the dial sits where the done card's gauge lands (the start of the right column),
            so the result does not jump sideways (Task 7 critic). Phone: centred, as drawn (P8). */}
        <div className="flex min-w-0 flex-1 justify-center md:justify-start">
          <RunDial clock={clockLabel((now - start) / 1000)} label={runLabel(!!analysisId, runElapsedS)} />
        </div>
      </div>
      {analysisId && (
        <div className="mt-3 md:mt-5">
          <AnswerPrimary
            icon={<PlayIcon size={20} aria-hidden className="shrink-0" />}
            label="Watch it run"
            href={resultHref(analysisId)}
            trailingArrow
          />
        </div>
      )}
    </AnswerCard>
  );
}
