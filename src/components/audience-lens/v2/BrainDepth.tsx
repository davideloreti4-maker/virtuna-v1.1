"use client";

/**
 * BrainDepth — Ambient Audience v2, the Sapient-depth sections of the brain tab.
 *
 * Split out of BrainTab (keeps that file under the 500-line guide). Four sections, rebuilt LEAN in the
 * r4 `TONE` grammar (the old-room `SigmaBars`/`SignalGrid`/`SignalHeatmap`/`AttentionCurve` read fixed
 * CSS vars + their data fns are grounded-only, so we lift their shapes/labels and re-render matte here,
 * which also lets us add the premium reveals they lack):
 *
 *   ① SignalGridV2   — the nine breakdown signals (number · label · status word · vs-typical delta)
 *   ② NetworkSigmaBars — raw network activation, z-scored (centered-baseline diverging bars)
 *   ③ KpiHeatmap     — activation per second, every decoded system (cream-ramp cells, L→R column reveal)
 *   ④ BuyIntentCurve — purchase-intent moments (cream curve + threshold + peak seconds)
 *
 * Design law held: matte only (hairlines + tone-step, no glow); coral is liveness/loss-only (a weak
 * signal, the standout loss network) — everything else is cream; all motion reduced-motion-guarded.
 */

import { motion } from "motion/react";
import { StaggerReveal } from "@/components/motion";
import { useCountUp } from "@/hooks/useCountUp";
import { TONE, Kick } from "./AmbientDetail";
import type { BuyIntentData, KpiHeatmapData, NetworkBar, SignalCell } from "./domain-template";

const toneColor = (t: SignalCell["tone"]) =>
  t === "weak" ? TONE.coral : t === "strong" ? TONE.cream : "rgba(236,231,222,.5)";

// ── ① nine breakdown signals ───────────────────────────────────────────────────

export function SignalGridV2({ cells }: { cells: SignalCell[] }) {
  return (
    <div className="mt-9">
      <Kick>the nine breakdown signals</Kick>
      <StaggerReveal className="mt-2 grid grid-cols-3" staggerDelay={0.04} initialDelay={0.05}>
        {cells.map((c) => (
          <StaggerReveal.Item key={c.key}>
            <div
              className="py-3 pr-3"
              style={{ borderTop: `1px solid ${TONE.border}` }}
              title={c.whyScore}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-light leading-none tabular-nums" style={{ color: TONE.cream }}>
                  {c.score}
                </span>
                {c.delta != null ? (
                  <span
                    className="font-mono text-[10px] tabular-nums"
                    style={{ color: c.delta < 0 ? TONE.coral : "rgba(236,231,222,.4)" }}
                  >
                    {c.delta > 0 ? "+" : ""}
                    {c.delta}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase leading-tight tracking-[0.07em]" style={{ color: TONE.faint }}>
                {c.label}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.09em]" style={{ color: toneColor(c.tone) }}>
                {c.word}
              </div>
            </div>
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>
    </div>
  );
}

// ── ② raw network activation · z-scored ────────────────────────────────────────

const SIGMA_MAX = 1.5; // σ that fills a full half-bar

function SigmaRow({ r, reducedMotion }: { r: NetworkBar; reducedMotion: boolean }) {
  const above = r.z >= 0;
  const frac = Math.min(1, Math.abs(r.z) / SIGMA_MAX);
  const fillColor = r.loss ? TONE.coral : above ? TONE.cream : "rgba(236,231,222,.42)";
  const valColor = r.loss ? TONE.coral : above ? TONE.cream : "rgba(236,231,222,.5)";
  const fillStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: `${(frac * 50).toFixed(1)}%`,
    background: fillColor,
    borderRadius: 999,
    opacity: 0.85,
    ...(above ? { left: "50%", transformOrigin: "left center" } : { right: "50%", transformOrigin: "right center" }),
  };
  return (
    <div className="flex items-center gap-3 py-[7px]">
      <span className="w-[104px] flex-none text-[12px]" style={{ color: r.loss ? TONE.coral : TONE.dim }}>
        {r.label}
      </span>
      <span className="relative h-[6px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
        <span
          className="absolute inset-y-0"
          style={{ left: "50%", width: 1, background: "rgba(255,255,255,.16)" }}
        />
        {reducedMotion ? (
          <span style={fillStyle} />
        ) : (
          <motion.span
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            style={fillStyle}
          />
        )}
      </span>
      <span className="w-[118px] flex-none text-right font-mono text-[11px] tabular-nums" style={{ color: valColor }}>
        {r.z > 0 ? "+" : ""}
        {r.z.toFixed(2)}σ <span style={{ color: "rgba(236,231,222,.36)" }}>· {r.band}</span>
      </span>
    </div>
  );
}

export function NetworkSigmaBars({ rows, reducedMotion }: { rows: NetworkBar[]; reducedMotion: boolean }) {
  return (
    <div className="mt-9">
      <Kick tag="z-scored">raw network activation</Kick>
      <div className="mt-3">
        {rows.map((r) => (
          <SigmaRow key={r.label} r={r} reducedMotion={reducedMotion} />
        ))}
      </div>
    </div>
  );
}

// ── ③ activation per second · every decoded system ─────────────────────────────

const cellBg = (v: number) => `rgba(236,231,222,${(0.05 + 0.6 * (v / 100)).toFixed(3)})`;

const RAIL = 60; // px — the left label rail
const CELL_H = 13; // px — one KPI cell

export function KpiHeatmap({ data, reducedMotion }: { data: KpiHeatmapData; reducedMotion: boolean }) {
  const { seconds, rows } = data;
  const cols = Array.from({ length: seconds }, (_, i) => i);
  // sparse second-axis ticks — first, middle, last (kept to 3 so the tiny type never crowds)
  const ticks = [0, Math.floor((seconds - 1) / 2), seconds - 1];
  const Cell = (row: KpiHeatmapData["rows"][number], i: number) => (
    <span key={row.label} className="block rounded-[2px]" style={{ height: CELL_H, background: cellBg(row.values[i] ?? 0) }} />
  );
  return (
    <div className="mt-9">
      <Kick tag={`${seconds}s · ${rows.length} systems`}>activation per second</Kick>

      {/* second-axis, aligned to the grid (offset past the rail) */}
      <div className="mt-3 flex" style={{ paddingLeft: RAIL + 8 }}>
        <div className="relative h-[10px] flex-1 font-mono text-[8.5px] tabular-nums" style={{ color: "rgba(236,231,222,.32)" }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2"
              style={{ left: `${(t / (seconds - 1)) * 100}%` }}
            >
              {t}s
            </span>
          ))}
        </div>
      </div>

      <div className="mt-1 flex gap-2">
        {/* left label rail — right-aligned, one line per row, aligned 1:1 with the cells */}
        <div className="flex flex-none flex-col gap-[2px]" style={{ width: RAIL }}>
          {rows.map((row) => (
            <span
              key={row.label}
              className="flex items-center justify-end truncate font-mono uppercase tracking-[0.03em]"
              style={{ height: CELL_H, fontSize: "8.5px", color: "rgba(236,231,222,.42)" }}
            >
              {row.label}
            </span>
          ))}
        </div>
        {/* the grid, revealed column-by-column left → right */}
        {reducedMotion ? (
          <div className="flex flex-1 gap-[2px]">
            {cols.map((i) => (
              <div key={i} className="flex flex-1 flex-col gap-[2px]">
                {rows.map((row) => Cell(row, i))}
              </div>
            ))}
          </div>
        ) : (
          <StaggerReveal className="flex flex-1 gap-[2px]" staggerDelay={0.02} initialDelay={0.04}>
            {cols.map((i) => (
              <StaggerReveal.Item key={i} className="flex flex-1 flex-col gap-[2px]">
                {rows.map((row) => Cell(row, i))}
              </StaggerReveal.Item>
            ))}
          </StaggerReveal>
        )}
      </div>

      {/* legend */}
      <div className="mt-3 flex items-center justify-between" style={{ paddingLeft: RAIL + 8 }}>
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: TONE.faint }}>
          <span>weak</span>
          <span
            className="block h-[5px] w-[56px] rounded-full"
            style={{ background: "linear-gradient(90deg, rgba(236,231,222,.05), rgba(236,231,222,.65))" }}
          />
          <span>strong</span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: TONE.faint }}>
          each cell = 1 sec
        </span>
      </div>
    </div>
  );
}

// ── ④ purchase-intent moments ──────────────────────────────────────────────────

function AbovePct({ pct }: { pct: number }) {
  const display = useCountUp({ to: pct, duration: 1.2, format: (v) => `${v}` });
  return (
    <span className="flex items-baseline gap-1">
      <motion.span className="text-[24px] font-light leading-none tabular-nums" style={{ color: TONE.cream }}>
        {display}
      </motion.span>
      <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.06em]" style={{ color: TONE.faint }}>
        % above
        <br />
        threshold
      </span>
    </span>
  );
}

const BW = 380;
const BH = 76;
const BPAD = 6;

export function BuyIntentCurve({
  data,
  clipSeconds,
  reducedMotion,
}: {
  data: BuyIntentData;
  clipSeconds: number;
  reducedMotion: boolean;
}) {
  const { points, threshold, abovePct, peaks, caption } = data;
  const n = points.length;
  const px = (i: number) => BPAD + (i / (n - 1)) * (BW - 2 * BPAD);
  const py = (v: number) => BH - BPAD - (v / 100) * (BH - 2 * BPAD);
  const linePath = "M" + points.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L");
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${BH - BPAD} L${px(0).toFixed(1)},${BH - BPAD} Z`;
  const ty = py(threshold);
  // peak "0:05" → seconds → x by fraction of the clip length
  const peakX = (t: string) => {
    const [m, s] = t.split(":").map((x) => parseInt(x, 10));
    const sec = (m || 0) * 60 + (s || 0);
    const frac = Math.min(1, Math.max(0, sec / clipSeconds));
    return BPAD + frac * (BW - 2 * BPAD);
  };
  return (
    <div className="mt-9">
      <div className="flex items-start justify-between">
        <Kick>purchase-intent moments</Kick>
        <AbovePct pct={abovePct} />
      </div>
      <div className="mt-3">
        <svg viewBox={`0 0 ${BW} ${BH}`} className="block h-auto w-full">
          <path d={areaPath} fill="rgba(236,231,222,.05)" stroke="none" />
          {/* the clip's own average — the dashed threshold */}
          <line x1={BPAD} y1={ty} x2={BW - BPAD} y2={ty} stroke="rgba(236,231,222,.4)" strokeWidth={1} strokeDasharray="3 3" />
          {reducedMotion ? (
            <path d={linePath} fill="none" stroke="rgba(236,231,222,.7)" strokeWidth={1.5} />
          ) : (
            <motion.path
              d={linePath}
              fill="none"
              stroke="rgba(236,231,222,.7)"
              strokeWidth={1.5}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            />
          )}
          {peaks.map((p) => (
            <circle key={p.t} cx={peakX(p.t)} cy={py(p.v)} r={3} fill={TONE.cream} />
          ))}
        </svg>
      </div>
      {/* peak-second chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {peaks.map((p) => (
          <span
            key={p.t}
            className="rounded-lg px-2.5 py-[5px] font-mono text-[12px] tracking-[0.04em]"
            style={{ border: `1px solid ${TONE.hair}`, color: TONE.dim }}
          >
            {p.t}
            <b className="ml-1.5 font-medium" style={{ color: TONE.cream }}>
              {p.v}
            </b>
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.5]" style={{ color: TONE.faint }}>
        {caption}
      </p>
    </div>
  );
}
