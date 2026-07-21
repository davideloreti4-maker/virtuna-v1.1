"use client";

/**
 * BrainTab — Ambient Audience v2, Detail tab ① "The brain" (out-Sapient Sapient).
 *
 * Round-4 anatomy: predicted-cortex figure (🔒 the owner-locked rainbow `CortexCanvas`, reused
 * as-is) · attention curve-as-scrubber with a synced transcript + peak-word underline + moment
 * chips · signal breakdown · networks at the playhead · "how to read" trust footer.
 *
 * Reuse decision (build handoff §5): reuse ONLY CortexCanvas (locked) + the drive plumbing
 * (`predictedBold`); build the scrubber/signal/network rows LEAN in r4 grammar rather than drag in
 * BrainView's 1189-line well chrome or the video-coupled `retention-scrubber`. Brain data is
 * MODELED — the corner chips + `modeled` tags carry that honesty (design law).
 *
 * The P2 mark (signal breakdown + networks need real improvement — translate σ into plain words,
 * add a "why this second" synthesis) is a LIVE-refine backlog item — built faithful to r4 first.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { hashSeed, predictedBold, type DriveInput } from "@/lib/brain/cortex-sim";
import { TONE, Kick, SecHead, HowToRead, type AttentionData, type NetworkRow, type SignalRow } from "./AmbientDetail";
import type { AskWhySlot, BrainDriver, BrainFrameData, ResistanceCurveData } from "./domain-template";

// CortexCanvas is WebGL (three.js) — client-only, never SSR (mirrors BrainView.tsx:115).
const CortexCanvas = dynamic(() => import("../CortexCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" style={{ background: "#131210" }} />,
});

const CLIP_LOOP_MS = 8000; // replay the clip on an 8s loop (r4 RDUR)
const pad2 = (n: number) => String(n).padStart(2, "0");

// ── cortex figure (🔒 locked rainbow, corner-chipped) ────────────────────────

function Corner({ where, dim, children }: { where: "tl" | "tr" | "br"; dim?: boolean; children: React.ReactNode }) {
  const pos =
    where === "tl" ? "top-2 left-2" : where === "tr" ? "top-2 right-2" : "bottom-2 right-2";
  return (
    <span
      className={`absolute ${pos} rounded-md px-2 py-[3px] font-mono text-[11px] uppercase tracking-[0.08em]`}
      style={{ color: dim ? "rgba(236,231,222,.45)" : "rgba(236,231,222,.85)", background: "rgba(20,20,19,.78)" }}
    >
      {children}
    </span>
  );
}

function CortexFigure({
  seedKey,
  stopRatio,
  clipSeconds,
  reducedMotion,
}: {
  seedKey: string;
  stopRatio: number;
  clipSeconds: number;
  reducedMotion: boolean;
}) {
  const seed = useMemo(() => hashSeed(seedKey), [seedKey]);
  const drive = useMemo<DriveInput>(
    () => ({ mode: "simulated", stopRatio, durationS: clipSeconds, seedKey }),
    [stopRatio, clipSeconds, seedKey],
  );
  const [t, setT] = useState(reducedMotion ? clipSeconds * 0.33 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let start = 0;
    let lastQuarter = -1;
    const loop = (now: number) => {
      if (!start) start = now;
      const p = ((now - start) % CLIP_LOOP_MS) / CLIP_LOOP_MS;
      const tt = p * clipSeconds;
      // Throttle bold recompute to ~4Hz — CortexCanvas lerps between targets on its own frame loop.
      const q = Math.floor(tt * 4);
      if (q !== lastQuarter) {
        lastQuarter = q;
        setT(tt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, clipSeconds]);

  const bold = useMemo(() => predictedBold(drive, t), [drive, t]);

  return (
    <div
      className="relative mt-3.5 overflow-hidden rounded-[12px]"
      style={{ height: 180, border: `1px solid ${TONE.border}`, background: "#131210" }}
    >
      <CortexCanvas seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} />
      <Corner where="tl">Predicted cortex</Corner>
      <Corner where="tr" dim>
        modeled
      </Corner>
      <Corner where="br">t = 0:{pad2(Math.floor(t))}</Corner>
    </div>
  );
}

// ── attention: curve-as-scrubber + synced transcript + moment chips ──────────

const CW = 310;
const CH = 84;
const CPAD = 6;

function AttentionScrubber({
  data,
  reducedMotion,
}: {
  data: AttentionData;
  reducedMotion: boolean;
}) {
  const { points, transcript, peakWordIndex, moments, hold } = data;
  const words = useMemo(() => transcript.split(" "), [transcript]);
  const n = points.length;

  const px = (i: number) => CPAD + (i / (n - 1)) * (CW - 2 * CPAD);
  const py = (v: number) => CH - CPAD - (v / 80) * (CH - 2 * CPAD);
  const linePath = "M" + points.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L");
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${CH - CPAD} L${px(0).toFixed(1)},${CH - CPAD} Z`;
  const peakI = points.indexOf(Math.max(...points));
  const dipI = points.indexOf(Math.min(...points));

  const phRef = useRef<SVGCircleElement>(null);
  const [wordsPlayed, setWordsPlayed] = useState(() => (reducedMotion ? Math.ceil(words.length * 0.42) : 0));

  const seek = (p: number) => {
    const fi = p * (n - 1);
    const i0 = Math.floor(fi);
    const fr = fi - i0;
    const v = points[i0]! + (points[Math.min(i0 + 1, n - 1)]! - points[i0]!) * fr;
    const ph = phRef.current;
    if (ph) {
      ph.setAttribute("cx", px(fi).toFixed(1));
      ph.setAttribute("cy", py(v).toFixed(1));
    }
  };

  useEffect(() => {
    if (reducedMotion) {
      seek(0.42);
      return;
    }
    let raf = 0;
    let start = 0;
    let lastWi = -1;
    const loop = (now: number) => {
      if (!start) start = now;
      const p = ((now - start) % CLIP_LOOP_MS) / CLIP_LOOP_MS;
      seek(p);
      const wi = Math.floor(p * words.length);
      if (wi !== lastWi) {
        lastWi = wi;
        setWordsPlayed(wi);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, words.length]);

  return (
    <div className="mt-8">
      <Kick tag="modeled">Attention · same playhead</Kick>
      <SecHead q="Where attention holds" ownLabel="hold" ownValue={String(hold)} weak />

      <div className="mt-4 flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px]"
          style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.dim }}
        >
          ❚❚
        </span>
        <p className="text-[15px] leading-[1.55]" style={{ color: TONE.faint }}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i <= wordsPlayed ? TONE.cream : undefined,
                borderBottom: i === peakWordIndex ? `2px solid ${TONE.coral}` : undefined,
                paddingBottom: i === peakWordIndex ? 1 : undefined,
                transition: "color .2s",
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>

      {/* the attention curve IS the scrubber */}
      <div className="mt-3.5">
        <svg viewBox={`0 0 ${CW} ${CH}`} className="block h-auto w-full">
          <path d={areaPath} fill="rgba(236,231,222,.05)" stroke="none" />
          <path d={linePath} fill="none" stroke="rgba(236,231,222,.6)" strokeWidth={1.5} />
          <circle cx={px(peakI)} cy={py(points[peakI]!)} r={3} fill="none" stroke="rgba(236,231,222,.7)" strokeWidth={1.2} />
          <circle cx={px(dipI)} cy={py(points[dipI]!)} r={3} fill={TONE.coral} opacity={0.85} />
          <circle ref={phRef} cx={px(0)} cy={py(points[0]!)} r={3.5} fill={TONE.cream} />
        </svg>
      </div>

      <div className="mt-3 flex gap-2">
        {moments.map((m) => (
          <button
            key={m.t}
            type="button"
            className="rounded-lg px-2.5 py-[5px] font-mono text-[12px] tracking-[0.04em] transition-colors"
            style={{ border: `1px solid ${TONE.hair}`, color: TONE.dim }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.dim)}
          >
            {m.t}
            <b className="ml-1.5 font-medium" style={{ color: m.dip ? TONE.coral : TONE.cream }}>
              {m.v}
            </b>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── signal breakdown (0..100) ────────────────────────────────────────────────

function SignalRows({ signals }: { signals: SignalRow[] }) {
  return (
    <div className="mt-8">
      <Kick tag="modeled">Signal breakdown</Kick>
      <div className="mt-1">
        {signals.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-3 py-3"
            style={{ borderBottom: i < signals.length - 1 ? `1px solid ${TONE.border}` : undefined }}
          >
            <span className="w-[104px] flex-none text-[14px]" style={{ color: TONE.dim }}>
              {s.label}
            </span>
            <span className="relative h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: TONE.ghost }}>
              <span
                className="absolute inset-0 block origin-left"
                style={{ transform: `scaleX(${Math.min(1, s.score / 100)})`, background: "rgba(236,231,222,.6)" }}
              />
            </span>
            <span className="w-6 flex-none text-right text-[13px] font-medium" style={{ color: TONE.cream }}>
              {s.score}
            </span>
            <span
              className="w-11 flex-none text-right font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{ color: s.band === "strong" ? TONE.faint : s.band === "weak" ? TONE.coral : "rgba(236,231,222,.3)" }}
            >
              {s.band}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── networks at the playhead (z-scored σ, diverging from a centre baseline) ───

function NetworkRows({ networks }: { networks: NetworkRow[] }) {
  return (
    <div className="mt-8">
      <Kick tag="z-scored">Networks · at the playhead</Kick>
      <div className="mt-1">
        {networks.map((nw) => {
          const w = Math.min(50, Math.abs(nw.z) * 34);
          const pos = nw.z >= 0;
          return (
            <div key={nw.label} className="flex items-center gap-3 py-2.5">
              <span className="w-[76px] flex-none text-[13px]" style={{ color: TONE.dim }}>
                {nw.label}
              </span>
              <span className="relative h-3.5 flex-1">
                {/* centre baseline */}
                <span className="absolute bottom-0 top-0 left-1/2 w-px" style={{ background: TONE.hair }} />
                <span
                  className="absolute top-[5px] h-1 rounded-full"
                  style={{
                    width: `${w}%`,
                    [pos ? "left" : "right"]: "50%",
                    background: nw.loss ? TONE.coral : pos ? "rgba(236,231,222,.55)" : "rgba(236,231,222,.35)",
                    opacity: nw.loss ? 0.8 : 1,
                  } as React.CSSProperties}
                />
              </span>
              <span className="w-11 flex-none text-right font-mono text-[12px]" style={{ color: TONE.faint }}>
                {nw.z > 0 ? "+" : nw.z < 0 ? "−" : ""}
                {Math.abs(nw.z).toFixed(1)}σ
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── resistance curve (pricing driver — "why this price") ──────────────────────

/** Resistance rises with price; a coral dashed marker flags the spike (the loss). Static — a price
 *  axis has no playhead, so no scrubber. */
function ResistanceCurve({ data }: { data: ResistanceCurveData }) {
  const { points, spikeAt, spikeLabel, question } = data;
  const n = points.length;
  const px = (i: number) => CPAD + (i / (n - 1)) * (CW - 2 * CPAD);
  const py = (v: number) => CH - CPAD - (v / 100) * (CH - 2 * CPAD);
  const linePath = "M" + points.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L");
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${CH - CPAD} L${px(0).toFixed(1)},${CH - CPAD} Z`;
  const sx = CPAD + spikeAt * (CW - 2 * CPAD);
  return (
    <div className="mt-8">
      <Kick tag="modeled">Price sensitivity</Kick>
      <SecHead q={question} ownLabel="spikes at" ownValue={spikeLabel.split(" ")[0] ?? ""} weak />
      <div className="mt-3.5">
        <svg viewBox={`0 0 ${CW} ${CH}`} className="block h-auto w-full">
          <path d={areaPath} fill="rgba(236,231,222,.05)" stroke="none" />
          <path d={linePath} fill="none" stroke="rgba(236,231,222,.6)" strokeWidth={1.5} />
          <line x1={sx} y1={0} x2={sx} y2={CH} stroke={TONE.coral} strokeWidth={1} strokeDasharray="3 3" />
        </svg>
      </div>
      <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: "rgba(255,99,99,.7)" }}>
        {spikeLabel}
      </div>
    </div>
  );
}

// ── driver-axis slot (◇ swap — "why this ___") ────────────────────────────────

/** The Brain's driver-axis figure. Creator = attention-over-the-clip; pricing = resistance-over-price.
 *  A new domain adds a `kind` here without touching the frame's other slots. */
function BrainDriverSlot({ driver, reducedMotion }: { driver: BrainDriver; reducedMotion: boolean }) {
  switch (driver.kind) {
    case "attention-scrubber":
      return <AttentionScrubber data={driver.data} reducedMotion={reducedMotion} />;
    case "resistance-curve":
      return <ResistanceCurve data={driver.data} />;
  }
}

// ── ask-why chat slot (● shared, deferred) ────────────────────────────────────

/** The interrogate-the-room slot. Shared across every domain by design, but there's no chat infra
 *  in v2 yet — so it renders as a disabled affordance that shows the slot without faking a live
 *  answer (honesty: don't pretend it's wired). Enable when the ask-why loop lands. */
function AskWhyStub({ slot }: { slot: AskWhySlot }) {
  return (
    <div className="mt-8">
      <Kick tag="soon">Ask the room why</Kick>
      <div
        className="mt-3 flex items-center gap-2.5 rounded-[10px] px-3.5 py-3"
        style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19", opacity: slot.enabled ? 1 : 0.55 }}
      >
        <span className="min-w-0 flex-1 text-[14px]" style={{ color: TONE.faint }}>
          {slot.placeholder}
        </span>
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px]"
          style={{ background: TONE.well, color: TONE.faint }}
          aria-hidden
        >
          ↑
        </span>
      </div>
    </div>
  );
}

// ── the brain role-frame ──────────────────────────────────────────────────────

/** BrainFrame — the invariant *why* role, rendered as ordered slots. Fixed slots (cortex · footer)
 *  render always; the driver axis + signals are the swap slots the DomainTemplate fills; networks +
 *  ask-why are optional/deferred. A new domain supplies figures — it never edits this frame. */
export function BrainFrame({
  brain,
  reducedMotion = false,
}: {
  brain: BrainFrameData;
  reducedMotion?: boolean;
}) {
  return (
    <div className="mt-3.5">
      <CortexFigure
        seedKey={brain.cortexSeedKey}
        stopRatio={Math.min(1, Math.max(0, brain.stopRatio))}
        clipSeconds={brain.clipSeconds}
        reducedMotion={reducedMotion}
      />
      <BrainDriverSlot driver={brain.driver} reducedMotion={reducedMotion} />
      <SignalRows signals={brain.signals} />
      {brain.networks ? <NetworkRows networks={brain.networks} /> : null}
      {brain.askWhy ? <AskWhyStub slot={brain.askWhy} /> : null}
      <HowToRead />
    </div>
  );
}
