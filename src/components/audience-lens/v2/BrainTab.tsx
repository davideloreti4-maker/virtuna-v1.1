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
import { TONE, Kick, SecHead, HowToRead, VerdictChip, Unlock, type AttentionData, type NetworkRow, type SignalRow } from "./AmbientDetail";
import { SignalGridV2, NetworkSigmaBars, KpiHeatmap, BuyIntentCurve } from "./BrainDepth";
import type { BrainDriver, BrainFrameData, DomainTemplate, ResistanceCurveData, WhyThisSecond } from "./domain-template";

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
  verdict,
}: {
  seedKey: string;
  stopRatio: number;
  clipSeconds: number;
  reducedMotion: boolean;
  verdict?: DomainTemplate["verdict"];
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
      className="relative overflow-hidden rounded-[14px]"
      style={{ height: 270, border: `1px solid ${TONE.border}`, background: "#131210" }}
    >
      <CortexCanvas seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} />
      <Corner where="tl">Predicted cortex</Corner>
      <Corner where="tr" dim>
        t = 0:{pad2(Math.floor(t))}
      </Corner>
      {verdict ? <VerdictChip verdict={verdict} /> : null}
    </div>
  );
}

// ── attention: curve-as-scrubber + synced transcript + moment chips ──────────

const CW = 310;
const CH = 84;
const CPAD = 6;

function AttentionScrubber({
  data,
  synthesis,
  reducedMotion,
  flashMoment = null,
}: {
  data: AttentionData;
  synthesis?: WhyThisSecond;
  reducedMotion: boolean;
  flashMoment?: string | null;
}) {
  const { points, transcript, peakWordIndex, moments } = data;
  const words = useMemo(() => transcript.split(" "), [transcript]);
  const n = points.length;

  // Cross-tab thread target — the moment chip whose time token matches the flashed moment.
  const flashT = flashMoment ? flashMoment.split(" ")[0] : null;
  const flashRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (flashT && flashRef.current) {
      flashRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flashT]);

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
      <div className="flex items-start gap-3">
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
        {moments.map((m) => {
          const flashed = flashT != null && m.t === flashT;
          return (
            <button
              key={m.t}
              ref={flashed ? flashRef : undefined}
              type="button"
              className="rounded-lg px-2.5 py-[5px] font-mono text-[12px] tracking-[0.04em]"
              style={{
                border: `1px solid ${flashed ? TONE.coral : TONE.hair}`,
                color: flashed ? TONE.cream : TONE.dim,
                boxShadow: flashed ? `0 0 0 3px rgba(255,99,99,.18)` : "none",
                transition: "border-color .35s, color .35s, box-shadow .35s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
              onMouseLeave={(e) => (e.currentTarget.style.color = flashed ? TONE.cream : TONE.dim)}
            >
              {m.t}
              <b className="ml-1.5 font-medium" style={{ color: m.dip ? TONE.coral : TONE.cream }}>
                {m.v}
              </b>
            </button>
          );
        })}
      </div>

      {/* the plain-language read sits ON the moment (merged from the old WHY-THIS-SECOND section) —
          not a voice quote (no serif/quotes), an analysis line; coral on the loss clause. */}
      {synthesis ? (
        <p className="mt-4 text-[14px] leading-[1.5]">
          {synthesis.segments.map((s, i) => (
            <span key={i} style={{ color: s.loss ? TONE.coral : TONE.dim }}>
              {s.text}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

// ── breakdown · vs your typical (signals, tightened) ─────────────────────────

/** #8 + consolidate — the raw 0..100 score was uninformative on its own (65 of what?) AND the bar
 *  made three near-identical scores look identical. Tightened to the ONE informative atom: the DELTA
 *  vs the user's baseline (`signalsBaseline`). Reads as a story — what this does better / worse than
 *  typical. Negative delta → coral (the loss). Bar + absolute score dropped (declutter). */
function SignalRows({ signals, baseline }: { signals: SignalRow[]; baseline?: string }) {
  return (
    <div className="mt-8">
      <Kick>{baseline ?? "breakdown"}</Kick>
      <div className="mt-1.5">
        {signals.map((s, i) => {
          const down = s.vsBase != null && s.vsBase < 0;
          return (
            <div
              key={s.label}
              className="flex items-baseline justify-between py-2.5"
              style={{ borderBottom: i < signals.length - 1 ? `1px solid ${TONE.border}` : undefined }}
            >
              <span className="text-[14px]" style={{ color: down ? TONE.coral : TONE.dim }}>
                {s.label}
              </span>
              <span
                className="font-mono text-[13px] tabular-nums"
                style={{ color: s.vsBase == null ? "rgba(236,231,222,.4)" : down ? TONE.coral : TONE.cream }}
              >
                {s.vsBase != null ? `${s.vsBase > 0 ? "+" : ""}${s.vsBase}` : `${s.score}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── the brain state: compact cortex + inline network read + claim boundary ────

/** THE BRAIN STATE (consolidated) — the cortex demoted from the top of the card to a compact proof
 *  figure, made legible by an inline plain-word read of the two networks that matter most (the loss +
 *  the strength), and closed by the #3 "what it is NOT" claim boundary. This fuses the old separate
 *  cortex figure + the network σ table into ONE readable block; the full σ is dropped from the main
 *  view (declutter — the words carry the meaning, the arrow the direction). */
function BrainHero({
  brain,
  verdict,
  reducedMotion,
}: {
  brain: BrainFrameData;
  verdict: DomainTemplate["verdict"];
  reducedMotion: boolean;
}) {
  const reads = useMemo(() => {
    const networks = brain.networks ?? [];
    if (!networks.length) return [];
    const byZ = [...networks].sort((a, b) => a.z - b.z);
    const loss = networks.find((n) => n.loss) ?? byZ[0]!;
    const strong = [...byZ].reverse().find((n) => n.label !== loss.label);
    return [loss, strong].filter(Boolean) as NetworkRow[];
  }, [brain.networks]);

  return (
    <div className="mt-4">
      <CortexFigure
        seedKey={brain.cortexSeedKey}
        stopRatio={Math.min(1, Math.max(0, brain.stopRatio))}
        clipSeconds={brain.clipSeconds}
        reducedMotion={reducedMotion}
        verdict={verdict}
      />
      {reads.length ? (
        <p className="mt-3 text-[14px] leading-[1.5]">
          {reads.map((nw, i) => (
            <span key={nw.label} style={{ color: nw.loss ? TONE.coral : TONE.dim }}>
              {i > 0 ? <span style={{ color: "rgba(236,231,222,.3)" }}> · </span> : null}
              {nw.label} {nw.read} {nw.z < 0 ? "↓" : "↑"}
            </span>
          ))}
        </p>
      ) : null}
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
      <Kick>Price sensitivity</Kick>
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

/** The Brain's driver-axis figure. Creator = attention-over-the-clip (carries the plain-language
 *  synthesis read); pricing = resistance-over-price. A new domain adds a `kind` here without touching
 *  the frame's other slots. */
function BrainDriverSlot({
  driver,
  synthesis,
  reducedMotion,
  flashMoment = null,
}: {
  driver: BrainDriver;
  synthesis?: WhyThisSecond;
  reducedMotion: boolean;
  flashMoment?: string | null;
}) {
  switch (driver.kind) {
    case "attention-scrubber":
      return <AttentionScrubber data={driver.data} synthesis={synthesis} reducedMotion={reducedMotion} flashMoment={flashMoment} />;
    case "resistance-curve":
      return <ResistanceCurve data={driver.data} />;
  }
}

// ── the brain role-frame ──────────────────────────────────────────────────────

/** BrainFrame — the invariant *why* role (2026-07-21 owner restructure). The BRAIN is the hero:
 *  cortex big + the verdict chip → THE UNLOCK (the cheat code) → the MOMENT (attention + read) →
 *  the BREAKDOWN (signals vs baseline) → trust footer. A new domain supplies figures via the
 *  DomainTemplate — it never edits this frame. */
export function BrainFrame({
  brain,
  verdict,
  unlock,
  reducedMotion = false,
  flashMoment = null,
}: {
  brain: BrainFrameData;
  verdict: DomainTemplate["verdict"];
  unlock?: DomainTemplate["unlock"];
  reducedMotion?: boolean;
  /** Cross-tab thread — when the audience tab jumps here, the matching moment ("0:04 · the drop")
   *  flashes and scrolls into view, so you land on the mechanism behind the coded reason. */
  flashMoment?: string | null;
}) {
  return (
    <div>
      <BrainHero brain={brain} verdict={verdict} reducedMotion={reducedMotion} />
      {/* retention line sits right UNDER the brain — same clip, one unit (owner mark) */}
      <BrainDriverSlot driver={brain.driver} synthesis={brain.whyThisSecond} reducedMotion={reducedMotion} flashMoment={flashMoment} />
      {/* the decomposition — the Sapient nine-grid when the domain authors it, else the lean 3-row delta */}
      {brain.signalGrid ? (
        <SignalGridV2 cells={brain.signalGrid} />
      ) : (
        <SignalRows signals={brain.signals} baseline={brain.signalsBaseline} />
      )}
      {/* the deeper read (optional, creator-authored) — raw networks → per-second heatmap → buy intent */}
      {brain.networkBars ? <NetworkSigmaBars rows={brain.networkBars} reducedMotion={reducedMotion} /> : null}
      {brain.kpiHeatmap ? <KpiHeatmap data={brain.kpiHeatmap} reducedMotion={reducedMotion} /> : null}
      {brain.buyIntent ? (
        <BuyIntentCurve data={brain.buyIntent} clipSeconds={brain.clipSeconds} reducedMotion={reducedMotion} />
      ) : null}
      {/* THE UNLOCK closes the tab — the fix you take away, after you've seen why */}
      {unlock ? <Unlock unlock={unlock} /> : null}
      {/* one consolidated honesty line (replaces the scattered per-section "modeled" disclaimers) */}
      {brain.calibrationNote ? (
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TONE.faint }}>
          {brain.calibrationNote}
        </div>
      ) : null}
      <HowToRead />
    </div>
  );
}
