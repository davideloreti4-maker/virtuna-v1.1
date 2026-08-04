"use client";

/**
 * EngagementTab — Ambient Audience v2, page ② "Engagement": what they did with it.
 *
 *   Retention — the instrument. The post, the curve, the moments and the words, ONE playhead.
 *   → Key metrics — avg watch · watched full · rewatch, with the last-41 benchmark DRAWN as a rank
 *     strip rather than implied by a right-meta that cited it
 *   → When they react — per-second intensity for saves / shares / comments on the clip's own axis
 *   → Projected reaction — counts of the projected reach (creators think in saves, not in points)
 *
 * Retention lives here, not on Brain (owner call, twice): it is what the room DID with the clip
 * second by second, so it belongs with the video that produced it and the outcomes it explains.
 * Brain keeps the cognitive read of the same clip — two pages, two questions, one artefact.
 *
 * TEXT inverts (§3.3). A text sim has the voices and no timeline, so the voices lead and there is no
 * retention card, no rank strip and no reaction timeline. Neither side is a stub of the other.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TONE } from "./AmbientDetail";
import {
  Axis,
  Card,
  CardHead,
  HeatCells,
  MethodFoot,
  RankStrip,
  SURFACE,
  Tiles,
  Voice,
  curvePath,
  mmss,
  sampleCurve,
} from "./rail-kit";
import type {
  ActionIntentData,
  DrillFixApplied,
  EngagementFrameData,
  MetricTile,
  RetentionInstrument,
} from "./domain-template";

const W = 366;
const H = 108;
const P = 6;
/** The transcript window's fade width, in px — also the track's end padding, so the two always agree. */
const TRACK_PAD = 26;

// ── the instrument ───────────────────────────────────────────────────────────

/** The post itself, centred in the retention card exactly as TikTok centres the playing video in
 *  its own retention section. The progress line answers the scrubber; in a host that mounts a real
 *  `<video>` it seeks with the playhead. */
function Cover({ label, coverSrc, progress }: { label: string; coverSrc?: string | null; progress: number }) {
  return (
    <div
      className="relative mx-auto mt-3.5 h-[234px] w-[132px] overflow-hidden rounded-[10px]"
      style={{ background: SURFACE.figure, border: `1px solid ${TONE.border}` }}
    >
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span
          className="absolute inset-0"
          style={{ background: "repeating-linear-gradient(104deg,#1b1a18 0 13px,#161514 13px 26px)" }}
        />
      )}
      <span
        className="absolute left-1/2 top-1/2 flex h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{ background: "rgba(38,38,36,.9)" }}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TONE.cream} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M5 3 19 12 5 21Z" />
        </svg>
      </span>
      <span
        className="absolute bottom-[9px] right-[7px] rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
        style={{ background: "rgba(20,20,19,.78)", color: "rgba(236,231,222,.85)" }}
      >
        {label}
      </span>
      <span className="absolute bottom-0 left-0 h-0.5" style={{ width: `${(progress * 100).toFixed(1)}%`, background: "rgba(236,231,222,.85)" }} />
    </div>
  );
}

/** ONE playhead drives the cover's progress line, the curve, the chips and the transcript. The read
 *  is annotated ON the figure (the YouTube key-moments idiom) instead of written under it. */
function RetentionCard({ data, applied }: { data: RetentionInstrument; applied: DrillFixApplied | null }) {
  const curve = applied?.retention?.curve ?? data.curve;
  const clip = applied?.retention?.clipSeconds ?? data.clipSeconds;
  const moments = applied?.retention?.moments ?? data.moments;
  const anno = applied?.retention?.anno ?? data.anno;
  const trimWords = applied?.retention?.trimWords ?? 0;
  const coverLabel = applied?.thumbLabel ?? data.coverLabel;
  const breakAt = data.breakAt ?? 0;

  const words = data.transcript.split(" ").slice(trimWords);
  const [ph, setPh] = useState(() => (clip > 0 ? Math.min(1, breakAt / clip) : 0));
  const wrapRef = useRef<HTMLDivElement>(null);

  const seek = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) setPh(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  }, []);

  const held = sampleCurve(curve, ph);
  const line = curvePath(curve, W, H, P);
  const median = data.median ? curvePath(data.median, W, H, P) : null;
  // After the fix the ORIGINAL stays on the figure as a coral ghost — a before/after you can see,
  // not two screens you have to remember between.
  const ghost = applied?.retention ? curvePath(data.curve, W, H, P) : null;
  const bx = P + (curve.length > 1 ? breakAt / (curve.length - 1) : 0) * (W - 2 * P);
  // The coral run keeps the FULL curve's spacing (`span`) — the slice is a segment of this figure,
  // not a figure of its own.
  const breakRun = !applied && breakAt > 0 ? curvePath(curve.slice(0, breakAt + 1), W, H, P, curve.length) : null;
  const phX = P + ph * (W - 2 * P);
  const phY = H - P - held * (H - 2 * P);
  const wordIdx = words.length ? Math.min(words.length - 1, Math.floor(ph * words.length)) : 0;
  const breakWord = applied ? -1 : (data.breakWordIndex ?? -1) - trimWords;

  return (
    <Card>
      <CardHead title="Retention" meta={`${mmss(ph * clip)} · ${Math.round(held * 100)}%`} />
      <Cover label={coverLabel} coverSrc={data.coverSrc} progress={ph} />
      <div
        ref={wrapRef}
        className="relative mt-3 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) seek(e.clientX);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          <path d={`${line} L${W - P},${H - P} L${P},${H - P} Z`} fill="rgba(236,231,222,.045)" />
          {/* the creator's OWN median — the only benchmark band we hold */}
          {median ? <path d={median} fill="none" stroke="rgba(236,231,222,.28)" strokeWidth={1.4} strokeDasharray="4 4" /> : null}
          {ghost ? <path d={ghost} fill="none" stroke="rgba(255,99,99,.32)" strokeWidth={1.4} strokeDasharray="3 3" /> : null}
          <path d={line} fill="none" stroke="rgba(236,231,222,.72)" strokeWidth={1.6} />
          {breakRun ? (
            <>
              <path d={breakRun} fill="none" stroke={TONE.coral} strokeWidth={2} />
              <line x1={bx} y1={0} x2={bx} y2={H} stroke="rgba(255,99,99,.26)" strokeWidth={1} />
            </>
          ) : null}
          {data.median ? (
            <text x={W - P - 3} y={H - P - (data.median[data.median.length - 1] ?? 0) * (H - 2 * P) + 12} textAnchor="end" fontSize={9} fill="rgba(236,231,222,.34)">
              your median
            </text>
          ) : null}
          <line x1={phX} y1={0} x2={phX} y2={H} stroke="rgba(236,231,222,.32)" strokeWidth={1} />
          <circle cx={phX} cy={phY} r={3.6} fill={TONE.cream} />
        </svg>
        {anno ? (
          <span
            className="pointer-events-none absolute top-2 rounded-md px-[7px] py-[3px] text-[11px] font-medium tabular-nums"
            style={
              applied
                ? { right: 8, background: "rgba(20,20,19,.78)", color: "rgba(236,231,222,.8)" }
                : { left: "12%", background: "rgba(20,20,19,.78)", color: TONE.coral }
            }
          >
            {anno}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex gap-[7px]">
        {moments.map((m) => {
          const on = Math.abs(ph * clip - m.at) < 0.5;
          return (
            <button
              key={m.at}
              type="button"
              aria-pressed={on}
              onClick={() => setPh(clip > 0 ? Math.min(1, m.at / clip) : 0)}
              className="flex items-baseline gap-[7px] rounded-[9px] px-[11px] py-2"
              style={{ background: on ? SURFACE.chipOn : SURFACE.chip }}
            >
              <span className="text-[11px] tabular-nums" style={{ color: TONE.faint }}>
                {mmss(m.at)}
              </span>
              <b className="text-[13px] font-medium tabular-nums" style={{ color: TONE.cream }}>
                {m.pct}%
              </b>
            </button>
          );
        })}
      </div>
      <Transcript words={words} current={wordIdx} breakWord={breakWord} />
    </Card>
  );
}

/** The transcript is ONE line, synced to the playhead, with the current word held at centre — rev
 *  6's five-line grey block is gone. The offset is MEASURED off the live word, never estimated from
 *  an average character width, so it stays centred whatever the words are. */
function Transcript({ words, current, breakWord }: { words: string[]; current: number; breakWord: number }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const [dx, setDx] = useState(0);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    const word = track?.children[current] as HTMLElement | undefined;
    if (!strip || !track || !word) return;
    const target = strip.clientWidth / 2 - (word.offsetLeft + word.offsetWidth / 2);
    setDx(Math.min(0, Math.max(strip.clientWidth - track.scrollWidth, target)));
  }, [current, words]);

  return (
    <div
      ref={stripRef}
      className="relative mt-3 h-[19px] overflow-hidden"
      style={{
        // A fade wide enough that a WORD dissolves in it. At 10% the ramp finished inside a single
        // word, so both ends read as a hard cut mid-word ("…every viral hook forma") — broken rather
        // than windowed. Stated in px so the window is the same at any card width.
        maskImage: `linear-gradient(90deg,transparent 0,#000 ${TRACK_PAD}px,#000 calc(100% - ${TRACK_PAD}px),transparent 100%)`,
        WebkitMaskImage: `linear-gradient(90deg,transparent 0,#000 ${TRACK_PAD}px,#000 calc(100% - ${TRACK_PAD}px),transparent 100%)`,
      }}
    >
      <span
        ref={trackRef}
        className="absolute left-0 top-0 whitespace-nowrap text-[13px] leading-[19px]"
        style={{
          color: "rgba(236,231,222,.26)",
          // Dead space under the fade at both ends. Without it the clamp parks the track flush at
          // `dx = 0`, which put the FIRST word directly under the ramp and erased it — the strip
          // opened on an invisible word every time the playhead sat at 0.
          paddingLeft: TRACK_PAD,
          paddingRight: TRACK_PAD,
          transform: `translateX(${dx.toFixed(0)}px)`,
          transition: "transform .09s linear",
        }}
      >
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              color: i === current ? TONE.cream : i < current ? "rgba(236,231,222,.6)" : undefined,
              borderBottom: i === breakWord ? `2px solid ${TONE.coral}` : undefined,
              paddingBottom: i === breakWord ? 1 : undefined,
            }}
          >
            {w}{" "}
          </span>
        ))}
      </span>
    </div>
  );
}

// ── when they react ──────────────────────────────────────────────────────────

/** Per-second intensity in the activation grid's grammar, counts matching the Projected reaction
 *  tiles. The benchmark and the timeline are what filled this page out in rev 12 — with DATA, not
 *  another sentence. */
function ReactionTimeline({
  data,
  scale,
}: {
  data: { seconds: number; rows: { label: string; count: number; intensity: number[] }[] };
  scale: number;
}) {
  // Each row's `intensity` is normalised WITHIN itself, so 16 comments drew at the same density as 102
  // saves and the three reactions read as one flat block — the counts on the right were carrying the
  // whole hierarchy alone. Weight every row against the heaviest so the heat means the same thing on
  // all three. Square-rooted, not linear: at raw share the lightest row falls to ~0.17 alpha and stops
  // being legible at all, which trades one misread for another. `scale` is uniform across rows and so
  // cancels — the ratio is taken from the raw counts.
  const top = Math.max(1, ...data.rows.map((r) => r.count));
  return (
    <Card>
      <CardHead title="When they react" meta="modeled · per second" />
      <div className="mt-3">
        {data.rows.map((r) => {
          const rel = Math.sqrt(Math.max(0, r.count) / top);
          return (
            <div key={r.label} className="flex items-center gap-2 py-[5px]">
              <span className="w-[74px] flex-none text-[13px]" style={{ color: TONE.dim }}>
                {r.label}
              </span>
              <HeatCells values={r.intensity.map((k) => 0.04 + k * 0.76 * rel)} height={14} />
              <span className="w-9 flex-none text-right text-[14px] font-medium tabular-nums" style={{ color: TONE.cream }}>
                {Math.round(r.count * scale)}
              </span>
            </div>
          );
        })}
      </div>
      <Axis left="0s" right={`${data.seconds}s`} indent={82} />
    </Card>
  );
}

/** The room's ACTION profile, when the fold sealed one, in the tile grammar the rest of the page
 *  speaks. It answers Engagement's question — what they'd do with it — so it lives here rather than
 *  beside the audience census where it used to sit. Intent, never a reach claim: the denominator
 *  disclosure rides the card's right-meta. */
function actionTiles(data: ActionIntentData): { tiles: MetricTile[]; meta: string } {
  return {
    tiles: data.rows.slice(0, 4).map((r, i) => ({
      label: r.label.replace(/^\w/, (c) => c.toUpperCase()),
      value: String(Math.round(r.value)),
      delta: `${Math.round(data.watchThroughPct)}% watch-through`,
      lead: i === 0,
    })),
    meta: `${data.actors} of ${data.total} would act`,
  };
}

// ── the frame ────────────────────────────────────────────────────────────────

export function EngagementFrame({
  data,
  actionIntent,
  applied = null,
  method,
  methodOpen = false,
  onToggleMethod,
  simline,
  onInterview,
}: {
  data: EngagementFrameData;
  actionIntent?: ActionIntentData;
  applied?: DrillFixApplied | null;
  method?: { heading: string; notes: string[] }[];
  methodOpen?: boolean;
  onToggleMethod?: () => void;
  simline?: string;
  onInterview?: (who: string) => void;
}) {
  const watchTiles = applied?.watchTiles ?? data.watch?.tiles;
  const rank = data.watch?.rank
    ? { ...data.watch.rank, ...(applied?.rankValue != null ? { value: applied.rankValue } : {}) }
    : undefined;
  const fallback = actionIntent && !data.reactions ? actionTiles(actionIntent) : null;
  const reactionTiles = applied?.reactionTiles ?? data.reactions?.tiles ?? fallback?.tiles;
  const reactionMeta = applied?.reactionMeta ?? data.reactions?.meta ?? fallback?.meta;

  return (
    <div data-page="engagement">
      {data.retention ? <RetentionCard data={data.retention} applied={applied} /> : null}

      {/* TEXT's instrument — the voices lead, because that is what a text sim actually holds. */}
      {data.voices?.rows.length ? (
        <Card>
          <CardHead title={data.voices.title} />
          <div>
            {data.voices.rows.map((v, i) => (
              <Voice key={v.who} voice={v} onInterview={onInterview} divider={i < data.voices!.rows.length - 1} />
            ))}
          </div>
        </Card>
      ) : null}

      {watchTiles?.length ? (
        <Card>
          <CardHead title={data.watch?.title ?? "Key metrics"} meta={data.watch?.meta} />
          <Tiles tiles={watchTiles} cols={3} />
          {rank ? <RankStrip data={rank} /> : null}
        </Card>
      ) : null}

      {data.reactionTimeline ? (
        <ReactionTimeline data={data.reactionTimeline} scale={applied?.reactionScale ?? 1} />
      ) : null}

      {reactionTiles?.length ? (
        <Card>
          <CardHead title={data.reactions?.title ?? "Projected reaction"} meta={reactionMeta} />
          <Tiles tiles={reactionTiles} />
        </Card>
      ) : null}

      {/* A page with nothing authored says so rather than closing on an empty frame. */}
      {!data.retention && !data.voices && !watchTiles?.length && !reactionTiles?.length ? (
        <div className="py-16 text-center text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          No engagement read on this run.
        </div>
      ) : null}

      <MethodFoot open={methodOpen} onToggle={onToggleMethod ?? (() => {})} method={method} simline={simline} />
    </div>
  );
}
