"use client";

/**
 * AudienceDepth — Ambient Audience v2, the deeper "who / how many" reads on the audience tab.
 *
 * Each section carries a read the map + ledger + tri-state can't:
 *   ① IndexBars    — who this is for (over/under-index vs the creator's typical audience → targeting)
 *   ② Amplification — who spreads it · how far (the reshare cascade / reach depth + carrier segments)
 *   ②b ActionIntent — what they'd DO with it (the room's action profile; VIDEO only). Fills the slot
 *      ② omits itself from on a video run, and answers a NARROWER question on purpose: intent, not
 *      reach. No multiplier, no cascade, no carriers — we hold what they'd do, not how far it travels.
 *   ③ Swing        — the swing · your upside (the fence-sitters + the verdict move if you win them)
 *   ④ RoomStrip    — the room · trust (sample · calibration · confidence — a richer calibration line)
 *
 * Same r4 grammar as the brain depth: the diverging/anchored bar is the shared viz vocabulary, matte
 * only, coral = liveness/loss (a cooling core segment, a fence-sitter loss) — everything else cream.
 */

import { motion } from "motion/react";
import { useCountUp } from "@/hooks/useCountUp";
import { TONE, Kick } from "./AmbientDetail";
import type {
  ActionIntentData,
  AmplificationData,
  AudienceFitData,
  RoomTrustData,
  SwingData,
} from "./domain-template";

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── ① who this is for · vs your typical ────────────────────────────────────────

const IDX_MAX = 40; // % index that fills a full half-bar

export function IndexBars({ data, reducedMotion }: { data: AudienceFitData; reducedMotion: boolean }) {
  return (
    <div className="mt-9">
      <Kick tag={data.baseline}>who this is for</Kick>
      <div className="mt-3">
        {data.rows.map((r) => {
          const over = r.index >= 0;
          const frac = Math.min(1, Math.abs(r.index) / IDX_MAX);
          const fillColor = r.loss ? TONE.coral : over ? TONE.cream : "rgba(236,231,222,.42)";
          const fillStyle: React.CSSProperties = {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: `${(frac * 50).toFixed(1)}%`,
            background: fillColor,
            borderRadius: 999,
            opacity: 0.85,
            ...(over ? { left: "50%", transformOrigin: "left center" } : { right: "50%", transformOrigin: "right center" }),
          };
          return (
            <div key={r.label} className="flex items-center gap-3 py-[7px]">
              <span className="w-[72px] flex-none text-[14px]" style={{ color: r.loss ? TONE.coral : TONE.dim }}>
                {r.label}
              </span>
              <span className="relative h-[6px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
                <span className="absolute inset-y-0" style={{ left: "50%", width: 1, background: "rgba(255,255,255,.16)" }} />
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
              <span
                className="w-[48px] flex-none text-right font-mono text-[12px] tabular-nums"
                style={{ color: r.loss ? TONE.coral : over ? TONE.cream : "rgba(236,231,222,.5)" }}
              >
                {r.index > 0 ? "+" : ""}
                {r.index}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-[1.5]" style={{ color: TONE.dim }}>
        {data.read}
      </p>
    </div>
  );
}

// ── ② who spreads it · how far ─────────────────────────────────────────────────

const FACTOR_MAX = 3.5;

function ReachNum({ to }: { to: number }) {
  const display = useCountUp({ to: Math.round(to * 10), duration: 1.2, format: (v) => (v / 10).toFixed(1) });
  return (
    <motion.span className="text-[24px] font-light leading-none tabular-nums" style={{ color: TONE.cream }}>
      {display}
    </motion.span>
  );
}

export function Amplification({ data }: { data: AmplificationData }) {
  return (
    <div className="mt-9">
      <div className="flex items-start justify-between">
        <Kick tag="modeled reach">who spreads it</Kick>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-[13px]" style={{ color: TONE.faint }}>
            ×
          </span>
          <ReachNum to={data.reachMultiplier} />
          <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.06em]" style={{ color: TONE.faint }}>
            your
            <br />
            followers
          </span>
        </span>
      </div>

      {/* the reshare cascade — a reverse funnel: saw it → reshared → their networks (reach depth) */}
      <div className="mt-4 flex items-center gap-2.5">
        {data.cascade.map((s, i) => {
          const last = i === data.cascade.length - 1;
          return (
            <div key={s.label} className="flex flex-1 items-center gap-2.5">
              {i > 0 ? (
                <span className="font-mono text-[13px]" style={{ color: "rgba(236,231,222,.28)" }}>
                  →
                </span>
              ) : null}
              <div className="flex-1">
                <div className="text-[19px] font-light leading-none tabular-nums" style={{ color: last ? TONE.cream : TONE.dim }}>
                  {fmt(s.count)}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: TONE.faint }}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* the carriers — reshare propensity per segment (× baseline) */}
      <div className="mt-5">
        {data.carriers.map((c) => {
          const frac = Math.min(1, c.factor / FACTOR_MAX);
          return (
            <div key={c.label} className="flex items-center gap-3 py-[6px]">
              <span className="w-[72px] flex-none text-[14px]" style={{ color: c.lead ? TONE.cream : TONE.dim }}>
                {c.label}
              </span>
              <span className="relative h-[6px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(frac * 100).toFixed(1)}%`, background: c.lead ? TONE.cream : "rgba(236,231,222,.5)", opacity: 0.85 }}
                />
              </span>
              <span
                className="w-[40px] flex-none text-right font-mono text-[12px] tabular-nums"
                style={{ color: c.lead ? TONE.cream : "rgba(236,231,222,.55)" }}
              >
                ×{c.factor.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[13px] leading-[1.5]" style={{ color: TONE.dim }}>
        {data.read}
      </p>
    </div>
  );
}

// ── ②b what they'd do with it · the action profile (VIDEO only) ────────────────

/** The bar scale. The verbs are a 0–100 intent index, so the axis is the index itself — NOT the
 *  row max. A max-relative scale would redraw the leader at full width on every video and erase the
 *  one thing this section measures: how much intent there actually is. */
const INTENT_MAX = 100;

export function ActionIntent({ data }: { data: ActionIntentData }) {
  return (
    <div className="mt-9">
      <div className="flex items-start justify-between">
        <Kick tag="modeled intent">what they&rsquo;d do with it</Kick>
        {/* The watch-through rate rides HERE, apart from the bars, because it is a different kind of
            number: a real flat mean of the cast's watch-through, not a weighted intent index. */}
        <span className="flex items-baseline gap-1.5">
          <span className="text-[24px] font-light leading-none tabular-nums" style={{ color: TONE.cream }}>
            {Math.round(data.watchThroughPct)}%
          </span>
          <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.06em]" style={{ color: TONE.faint }}>
            avg watch
            <br />
            through
          </span>
        </span>
      </div>

      <div className="mt-4">
        {data.rows.map((r) => {
          const frac = Math.min(1, Math.max(0, r.value) / INTENT_MAX);
          return (
            <div key={r.label} className="flex items-center gap-3 py-[6px]">
              <span className="w-[72px] flex-none text-[14px]" style={{ color: TONE.dim }}>
                {r.label}
              </span>
              <span className="relative h-[6px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(frac * 100).toFixed(1)}%`, background: "rgba(236,231,222,.62)" }}
                />
              </span>
              <span
                className="w-[40px] flex-none text-right font-mono text-[12px] tabular-nums"
                style={{ color: "rgba(236,231,222,.55)" }}
              >
                {Math.round(r.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* the real headcounts — unweighted, exact, and the only figures here that are counts of people */}
      <div className="mt-3.5 font-mono text-[11px]" style={{ color: TONE.faint }}>
        <span className="tabular-nums" style={{ color: "rgba(236,231,222,.6)" }}>
          {data.actors} of {data.total}
        </span>{" "}
        would act
        {data.inert > 0 ? (
          <>
            {" · "}
            <span className="tabular-nums">{data.inert}</span> would do nothing
            {data.watchedButInert > 0 ? (
              <>
                {" · "}
                <span className="tabular-nums">{data.watchedButInert}</span> of those watched it through
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <p className="mt-2.5 text-[13px] leading-[1.5]" style={{ color: TONE.dim }}>
        {data.read}
      </p>
      <p className="mt-1.5 font-mono text-[10px]" style={{ color: "rgba(236,231,222,.3)" }}>
        {data.note}
      </p>
    </div>
  );
}

// ── ③ the swing · your upside ──────────────────────────────────────────────────

export function Swing({ data }: { data: SwingData }) {
  const { nearMiss, fromPct, toPct, gainLabel, read } = data;
  return (
    <div className="mt-9">
      <Kick>the swing</Kick>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[30px] font-light leading-none tabular-nums" style={{ color: TONE.cream }}>
          {nearMiss}
        </span>
        <span className="text-[13px]" style={{ color: TONE.faint }}>
          on the fence
        </span>
      </div>
      {/* the verdict move — solid cream = today, the brighter band = the swing you can still win, a tick
          at the boundary so the gain reads as its own segment (a fix is a win → never coral) */}
      <div className="relative mt-4 h-[10px] rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${toPct}%`, background: "rgba(236,231,222,.28)" }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fromPct}%`, background: TONE.cream, opacity: 0.9 }} />
        <div className="absolute w-px" style={{ left: `${fromPct}%`, top: -2, bottom: -2, background: "rgba(236,231,222,.55)" }} />
      </div>
      <div className="mt-2.5 flex items-baseline gap-2 font-mono text-[12px] tabular-nums">
        <span style={{ color: TONE.cream }}>{fromPct}%</span>
        <span style={{ color: "rgba(236,231,222,.3)" }}>→</span>
        <span style={{ color: TONE.cream }}>{toPct}%</span>
        <span className="text-[11px]" style={{ color: TONE.faint }}>
          {gainLabel}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: TONE.dim }}>
        {read}
      </p>
    </div>
  );
}

// ── ④ the room · trust ─────────────────────────────────────────────────────────

export function RoomStrip({ data }: { data: RoomTrustData }) {
  const pct = Math.round(data.confidence * 100);
  return (
    <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${TONE.border}` }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: TONE.faint }}>
          the room
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(236,231,222,.5)" }}>
          {data.confidenceLabel} confidence
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.05)" }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, rgba(236,231,222,.3), rgba(236,231,222,.62))" }}
          />
        </span>
        <span className="flex-none font-mono text-[12px] tabular-nums" style={{ color: TONE.dim }}>
          {data.confidence.toFixed(2)}
        </span>
      </div>
      <div className="mt-3 font-mono text-[11px]" style={{ color: TONE.faint }}>
        <span className="tabular-nums" style={{ color: "rgba(236,231,222,.6)" }}>
          {fmt(data.simulated)}
        </span>{" "}
        simulated · calibrated on {data.calibratedOn}
      </div>
      <p className="mt-1.5 text-[12px] leading-[1.5]" style={{ color: "rgba(236,231,222,.32)" }}>
        {data.note}
      </p>
    </div>
  );
}
