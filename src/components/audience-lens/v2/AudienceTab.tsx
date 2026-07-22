"use client";

/**
 * AudienceTab — Ambient Audience v2, Detail tab ② "The audience" (out-AS Artificial Societies).
 *
 * The *who / how many* role, editorial-minimal: the map's dot vocabulary is the ONLY viz language on
 * the tab. The society map (`AudienceTerrain`) is the hero; the district ledger reuses the SAME dots
 * as node-bars (units = people), so map + ledger are one system — not two unrelated bar treatments.
 * Everything redundant is stripped: no section kickers where the content self-reads, no role words,
 * no caption restating the ledger, no per-reason bars. The ranked numbers + coral + whitespace carry
 * it. The top objection still THREADS to the brain moment (the human "why" = the mechanical "why").
 *
 * Deterministic layout lives in `AudienceTerrain` (seed 42, stable across runs & SSR).
 */

import { useMemo, useState } from "react";
import { TONE, Kick, HowToRead, type CodedReason, type SegmentStop, type TerrainCluster, type TriState } from "./AmbientDetail";
import { TerrainMap } from "./AudienceTerrain";
import { IndexBars, Amplification, Swing, RoomStrip } from "./AudienceDepth";
import type { DemandCurveData, DomainTemplate, PopulationFrameData, PopulationMain } from "./domain-template";

// ── the shared dot vocabulary — a node-bar (units = people, lit share = the rate) ─────

/** A node-bar: `dots` units spread across the row, the leading `frac` lit. The SAME cream/coral dots
 *  as the society map, so the ledger and the map read as one system (not a generic progress bar). */
function NodeBar({ frac, loss = false, dots = 16 }: { frac: number; loss?: boolean; dots?: number }) {
  const on = Math.round(Math.min(1, Math.max(0, frac)) * dots);
  const onColor = loss ? TONE.coral : TONE.cream;
  return (
    <span className="flex flex-1 items-center justify-between" aria-hidden>
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: i < on ? onColor : "rgba(236,231,222,.14)",
            opacity: i < on ? (loss ? 0.92 : 0.95) : 1,
          }}
        />
      ))}
    </span>
  );
}

// ── main figure slot (◇ swap — the distribution the headline summarizes) ──────

/** The Population's main figure. Creator = the stop/skim/scroll tri-state; pricing = the demand
 *  curve. A new domain adds a `kind` (overlay · answer-distribution) here without touching terrain/
 *  segments/voices. */
function PopulationMainSlot({ main }: { main: PopulationMain }) {
  switch (main.kind) {
    case "tri-state":
      return <TriStateOutcome tri={main.data} percentileLine={main.percentileLine} />;
    case "demand-curve":
      return <DemandCurve data={main.data} />;
  }
}

/** Demand curve — would-pay share falls as price rises; a cream dashed marker flags the revenue-
 *  optimal price (cream = the good default; coral stays reserved for the loss, per the room law). */
function DemandCurve({ data }: { data: DemandCurveData }) {
  const W = 380;
  const H = 66;
  const PAD = 5;
  const { points, optimalAt, optimalLabel, loLabel, hiLabel, caption, kicker } = data;
  const n = points.length;
  const px = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const py = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);
  const linePath = "M" + points.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L");
  const ox = PAD + optimalAt * (W - 2 * PAD);
  return (
    <div className="mt-9">
      <Kick>{kicker}</Kick>
      <div className="mt-3.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          <path d={linePath} fill="none" stroke="rgba(236,231,222,.6)" strokeWidth={1.5} />
          <line x1={ox} y1={0} x2={ox} y2={H} stroke="rgba(236,231,222,.55)" strokeWidth={1} strokeDasharray="3 3" />
        </svg>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[12px]">
        <span className="font-mono" style={{ color: TONE.dim }}>
          {optimalLabel}
        </span>
        <span style={{ color: TONE.faint }}>{caption}</span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]" style={{ color: TONE.faint }}>
        <span>{loLabel}</span>
        <span>{hiLabel}</span>
      </div>
    </div>
  );
}

/** The stop / skim / scroll split. Editorial-minimal: a quiet percentile line + the three figures in
 *  light type; coral on the loss. No loud kicker, no column rules — the numbers carry it. */
function TriStateOutcome({ tri, percentileLine }: { tri: TriState; percentileLine: string }) {
  const cols = [
    { n: tri.stopped, t: "stopped", loss: false },
    { n: tri.skimmed, t: "skimmed", loss: false },
    { n: tri.scrolled, t: "scrolled past", loss: true },
  ];
  return (
    <div className="mt-9">
      <div className="text-[11px]" style={{ color: TONE.faint }}>
        {percentileLine}
      </div>
      {/* three framed cells — the split reads as three distinct outcomes, coral on the loss */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {cols.map((c) => (
          <div
            key={c.t}
            className="rounded-[10px] px-3 py-3.5"
            style={{
              border: `1px solid ${c.loss ? "rgba(255,99,99,.22)" : TONE.border}`,
              background: c.loss ? "rgba(255,99,99,.04)" : "rgba(255,255,255,.02)",
            }}
          >
            <div className="text-[24px] font-light tabular-nums" style={{ color: c.loss ? TONE.coral : TONE.cream }}>
              {c.n}%
            </div>
            <div className="mt-1 text-[12px]" style={{ color: c.loss ? "rgba(255,99,99,.7)" : TONE.faint }}>
              {c.t}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── the districts · ranked node-bar ledger (the read's home) ──────────────────

/** DistrictLedger — the ranked reading of the society (believers → ceiling). Editorial-minimal: no
 *  kicker, no role words, no caption; each row is name · node-bar · rate, coral on the ceiling. The
 *  believers → ceiling story is carried by the order + the coral, not by words. Hovering a row
 *  spotlights its district on the map (`onHover` → `highlight`). */
function DistrictLedger({
  clusters,
  lossIndex,
  highlight,
  onHover,
}: {
  clusters: TerrainCluster[];
  lossIndex: number;
  highlight: number | null;
  onHover: (i: number | null) => void;
}) {
  const ranked = useMemo(
    () => clusters.map((c, i) => ({ c, i })).sort((a, b) => b.c.lit - a.c.lit),
    [clusters],
  );
  return (
    <div className="mt-5">
      {ranked.map(({ c, i }) => {
        const loss = i === lossIndex;
        const pct = Math.round(c.lit * 100);
        const on = highlight === i;
        return (
          <div
            key={c.name}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            className="flex items-center gap-3.5 rounded-[8px] px-2 py-[10px]"
            style={{ background: on ? "rgba(255,255,255,.03)" : "transparent", transition: "background .2s" }}
          >
            <span className="w-[74px] flex-none text-[14px]" style={{ color: loss ? TONE.coral : TONE.cream }}>
              {c.name}
            </span>
            <NodeBar frac={c.lit} loss={loss} />
            <span
              className="w-[38px] flex-none text-right text-[13px] font-medium tabular-nums"
              style={{ color: loss ? TONE.coral : TONE.cream }}
            >
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── willingness-to-pay segments (pricing only) — same node-bar vocabulary ─────

function Segments({ title, rows }: { title: string; rows: SegmentStop[] }) {
  return (
    <div className="mt-9">
      <Kick>{title}</Kick>
      <div className="mt-2">
        {rows.map((s) => (
          <div key={s.label} className="flex items-center gap-3.5 py-[10px]">
            <span className="w-[104px] flex-none text-[14px]" style={{ color: s.loss ? TONE.coral : TONE.dim }}>
              {s.label}
            </span>
            <NodeBar frac={s.pct / 100} loss={s.loss} />
            <span className="w-[38px] flex-none text-right text-[13px] font-medium tabular-nums" style={{ color: s.loss ? TONE.coral : TONE.cream }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── the receipts · coded reasons, leaking above a hairline, holding below (● shared) ──

/** One coded reason: label + weight (×count, coral when it's an objection), the verbatim serif quote,
 *  and a condensed meta line — the brain thread (loss reasons only) + the exemplar voice. */
function ReasonRow({
  r,
  last,
  onInterview,
  onJumpToBrain,
}: {
  r: CodedReason;
  last: boolean;
  onInterview?: (who: string) => void;
  onJumpToBrain?: (moment: string) => void;
}) {
  return (
    <div className="py-3.5" style={{ borderBottom: last ? undefined : `1px solid ${TONE.border}` }}>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-[14px] font-medium" style={{ color: TONE.cream }}>
          {r.label}
        </span>
        <span className="flex-none font-mono text-[13px] tabular-nums" style={{ color: r.loss ? TONE.coral : TONE.faint }}>
          ×{r.count}
        </span>
      </div>
      <p className="mt-2 font-serif text-[15px] italic leading-[1.45]" style={{ color: TONE.dim }}>
        &ldquo;{r.quote}&rdquo;
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {r.thread && onJumpToBrain ? (
          <>
            <button
              type="button"
              onClick={() => onJumpToBrain(r.thread!.toMoment)}
              className="transition-colors"
              style={{ color: "rgba(255,99,99,.75)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TONE.coral)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,99,99,.75)")}
            >
              ↳ {r.thread.toMoment}
            </button>
            <span style={{ color: "rgba(236,231,222,.25)" }}>·</span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onInterview?.(r.who)}
          className="transition-colors"
          style={{ color: TONE.faint }}
          onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
          onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
        >
          {r.who} · interview ›
        </button>
      </div>
    </div>
  );
}

/** Receipts — the coded reasons, objections (coral ×count) above a hairline, endorsements below. The
 *  split is a quiet rule, not a shouted LEAKING/HOLDING label; the coral vs faint counts carry it. */
function Receipts({
  kicker,
  reasons,
  onInterview,
  onJumpToBrain,
}: {
  kicker: string;
  reasons: CodedReason[];
  onInterview?: (who: string) => void;
  onJumpToBrain?: (moment: string) => void;
}) {
  const leaking = reasons.filter((r) => r.loss);
  const holding = reasons.filter((r) => !r.loss);
  return (
    <div className="mt-9">
      <Kick>{kicker}</Kick>
      <div className="mt-2">
        {leaking.map((r, i) => (
          <ReasonRow key={r.label} r={r} last={i === leaking.length - 1} onInterview={onInterview} onJumpToBrain={onJumpToBrain} />
        ))}
      </div>
      {holding.length ? (
        <div className="mt-2 pt-2" style={{ borderTop: leaking.length ? `1px solid ${TONE.border}` : undefined }}>
          {holding.map((r, i) => (
            <ReasonRow key={r.label} r={r} last={i === holding.length - 1} onInterview={onInterview} onJumpToBrain={onJumpToBrain} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── the population role-frame ──────────────────────────────────────────────────

/** PopulationFrame — the invariant *who / how many* role. The society map is the hero; the ranked
 *  node-bar ledger reads it (hovering a row spotlights its district) → the distribution → segments
 *  (pricing only) → the receipts → calibration → footer. A new domain supplies figures; it never
 *  edits this frame. */
export function PopulationFrame({
  population,
  verdict,
  reducedMotion = false,
  onInterview,
  onJumpToBrain,
}: {
  population: PopulationFrameData;
  verdict: DomainTemplate["verdict"];
  reducedMotion?: boolean;
  onInterview?: (who: string) => void;
  onJumpToBrain?: (moment: string) => void;
}) {
  const [highlight, setHighlight] = useState<number | null>(null);
  return (
    <div className="mt-4">
      <TerrainMap terrain={population.terrain} verdict={verdict} reducedMotion={reducedMotion} highlightCluster={highlight} />
      {/* the read — the non-obvious "so what" of the society (believers vs your ceiling). The insight,
          not a caption restating the map. Premium quiet treatment: a mono eyebrow + hairline set it
          apart as an intentional statement, not a floating grey line under the hero. */}
      {population.heroRead ? (
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${TONE.border}` }}>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "rgba(236,231,222,.32)" }}
          >
            the read
          </div>
          <p className="mt-2 text-[15px] leading-[1.55]" style={{ color: TONE.dim }}>
            {population.heroRead}
          </p>
        </div>
      ) : null}
      <DistrictLedger
        clusters={population.terrain.clusters}
        lossIndex={population.terrain.lossClusterIndex}
        highlight={highlight}
        onHover={setHighlight}
      />
      <PopulationMainSlot main={population.main} />
      {/* who this is for → who spreads it (targeting + reach — the reads the map can't make) */}
      {population.audienceFit ? <IndexBars data={population.audienceFit} reducedMotion={reducedMotion} /> : null}
      {population.amplification ? <Amplification data={population.amplification} /> : null}
      {population.segments ? <Segments title={population.segments.title} rows={population.segments.rows} /> : null}
      <Receipts
        kicker={population.voices.kicker}
        reasons={population.voices.reasons}
        onInterview={onInterview}
        onJumpToBrain={onJumpToBrain}
      />
      {/* the swing — the upside after you've seen who + why */}
      {population.swing ? <Swing data={population.swing} /> : null}
      {/* the room — the trust strip (richer than the plain calibration line; falls back to it) */}
      {population.room ? (
        <RoomStrip data={population.room} />
      ) : population.calibration ? (
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TONE.faint }}>
          {population.calibration.note}
        </div>
      ) : null}
      <HowToRead />
    </div>
  );
}
