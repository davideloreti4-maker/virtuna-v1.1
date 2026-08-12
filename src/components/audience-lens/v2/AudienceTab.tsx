"use client";

/**
 * AudienceTab — Ambient Audience v2, page ③ "Audience": who was in the room.
 *
 *   the terrain — the society, districts self-reading their own rates (the 270px hero)
 *   → Who watches — and how long: retention split by traffic pool. No platform reports this, and it
 *     is the product's actual claim — TikTok's screens are all post-hoc on a post you cannot change
 *   → How they decided: the dot-matrix count rows, and every row SPEAKS when you tap it
 *   → Who this is for: each pool indexed against the room average, diverging from a zero line
 *   → Who spreads it: saw → reshared → their networks, then who multiplies it
 *   → Where & when: the surface mix and the posting window, one card since rev 11
 *
 * ONE TAXONOMY runs all five: relationship to the creator — Followers · Returning · New viewers ·
 * Outside niche, TikTok's own analytics vocabulary. The archetype namespace (builders / learners /
 * skeptics / drive-by) is owner-REJECTED and must not be re-proposed; a caste is not a person. The
 * voices carry human descriptors instead ("small creator"), and every echo count fits inside the
 * row it belongs to.
 *
 * Rev 11 deleted the page's prose, rev 12 its two segmented composition strips: the percentages
 * already live in the rows beneath them. Hero + five cards of pure data.
 */

import { useState } from "react";
import { TONE, type SegmentStop } from "./AmbientDetail";
import { TerrainMap } from "./AudienceTerrain";
import { BarRow, Card, CardHead, LegendRows, MethodFoot, SURFACE, Voice, curvePath } from "./rail-kit";
import type { AmplificationData, AudienceFitData, DecisionStatesData, DemandCurveData, DomainTemplate, PersonaReadData, PersonaVoice, PopulationFrameData, PopulationMain } from "./domain-template";

// ── who watches — and how long ───────────────────────────────────────────────

const SPARK_W = 150;
const SPARK_H = 28;

/** Per-pool retention: the label with its share of the room, its own curve, and the second it drops.
 *  The coral is spent HERE, on the pool that leaves first — it is the page's one loss. */
function PoolRows({ rows }: { rows: NonNullable<PopulationFrameData["pools"]>["rows"] }) {
  return (
    <div className="mt-1">
      {rows.map((p) => (
        <div key={p.label} className="flex items-center gap-[11px] py-2">
          <span className="w-[88px] flex-none">
            <span className="block text-[13px]" style={{ color: TONE.dim }}>
              {p.label}
            </span>
            <span className="mt-0.5 block text-[11px]" style={{ color: TONE.faint }}>
              {p.share}
            </span>
          </span>
          {p.curve?.length ? (
            <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" className="h-7 flex-1">
              <path d={`${curvePath(p.curve, SPARK_W, SPARK_H, 2)} L${SPARK_W - 2},${SPARK_H - 2} L2,${SPARK_H - 2} Z`} fill="rgba(236,231,222,.05)" />
              <path d={curvePath(p.curve, SPARK_W, SPARK_H, 2)} fill="none" stroke={p.loss ? TONE.coral : "rgba(236,231,222,.62)"} strokeWidth={1.4} />
            </svg>
          ) : (
            <span className="flex-1" />
          )}
          {p.dropAt ? (
            <span className="w-[34px] flex-none text-right text-[13px] font-medium tabular-nums" style={{ color: p.loss ? TONE.coral : TONE.faint }}>
              {p.dropAt}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── how they decided ─────────────────────────────────────────────────────────

const DOTS = 18;

/** The dot-matrix count rows — the shipped, product-native component, in plain behaviour: Watched ·
 *  Almost stayed · Wrong audience · Scrolled past. The verb "stop" is BANNED surface-wide: the live
 *  rail uses "would stop" as the GOOD outcome (stopped scrolling) while TikTok and every creator
 *  read it as the loss — one verb, two polarities, so it is gone.
 *
 *  Each row is a BUTTON. Talking to a simulated viewer is the most differentiated thing in the
 *  product and a flat count row never offered it. */
function DecisionStates({
  data,
  onInterview,
}: {
  data: DecisionStatesData;
  onInterview?: (who: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const fmtN = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (
    <Card>
      <CardHead title="How they decided" meta={`${fmtN(data.total)} simulated`} />
      <div className="mt-0.5">
        {data.states.map((s) => {
          const lit = data.total ? Math.round((s.count / data.total) * DOTS) : 0;
          const on = open === s.key;
          return (
            <div key={s.key}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpen(on ? null : s.key)}
                className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(236,231,222,.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="w-[112px] flex-none text-[13px]" style={{ color: on ? TONE.cream : TONE.dim }}>
                  {s.label}
                </span>
                <span className="flex flex-1 gap-[5px]">
                  {Array.from({ length: DOTS }, (_, i) => (
                    <span
                      key={i}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: i < lit ? "rgba(236,231,222,.78)" : "rgba(236,231,222,.13)" }}
                    />
                  ))}
                </span>
                {/* No coral on the count. The page's one coral zone is spent on the terrain and the
                    pool that leaves first; a red number here made the loss read twice and flattened
                    the hierarchy. Loss reads by position — it is the last row. */}
                <span className="w-9 flex-none text-right text-[14px] font-medium tabular-nums" style={{ color: TONE.cream }}>
                  {fmtN(s.count)}
                </span>
                <span
                  className="w-[9px] flex-none text-[11px]"
                  style={{ color: TONE.faint, transform: on ? "rotate(90deg)" : undefined, transition: "transform .15s" }}
                >
                  ›
                </span>
              </button>
              {on && s.voice ? (
                <div className="pb-2.5 pt-0.5">
                  <Voice voice={s.voice} onInterview={onInterview} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── the targeting + reach reads ──────────────────────────────────────────────

/** Who this is for. Diverging with a zero line, because an over/under index without one is a lie
 *  about direction: −68% simply draws longer than +5%. Sub-baseline is LOW (faint), never coral —
 *  the page's coral is already spent on the pool that leaves. */
function FitCard({ data }: { data: AudienceFitData }) {
  const max = Math.max(1, ...data.rows.map((r) => Math.abs(r.index)));
  return (
    <Card>
      <CardHead title="Who this is for" meta={data.baseline} />
      <div className="mt-1">
        {data.rows.map((r, i) => (
          <BarRow
            key={r.label}
            label={r.label}
            value={`${r.index > 0 ? "+" : ""}${r.index}%`}
            frac={Math.abs(r.index) / max}
            negative={r.index < 0}
            diverging
            lead={i === 0 && r.index > 0}
            low={r.index < 0}
          />
        ))}
      </div>
    </Card>
  );
}

/** Who spreads it — the second ring: saw → reshared → their networks, then the carriers. A sub-1×
 *  multiplier is low, not a loss. */
function SpreadCard({ data }: { data: AmplificationData }) {
  const max = Math.max(1, ...data.carriers.map((c) => c.factor));
  const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (
    <Card>
      <CardHead title="Who spreads it" meta="modeled reach" />
      <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5" style={{ background: SURFACE.chip }}>
        {data.cascade.map((c, i) => (
          <span key={c.label} className="flex items-center gap-2.5">
            {i > 0 ? (
              <span className="mt-3 text-[13px]" style={{ color: TONE.faint }}>
                →
              </span>
            ) : null}
            <span className="flex flex-col gap-0.5">
              <i className="whitespace-nowrap text-[10px] not-italic" style={{ color: TONE.faint }}>
                {c.label}
              </i>
              <b className="text-[17px] font-medium leading-none tracking-[-0.012em] tabular-nums" style={{ color: TONE.cream }}>
                {fmt(c.count)}
              </b>
            </span>
          </span>
        ))}
        <span className="ml-auto self-end rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tabular-nums" style={{ background: SURFACE.chipOn, color: TONE.faint }}>
          ×{data.reachMultiplier.toFixed(1)}
        </span>
      </div>
      <div className="mt-2">
        {data.carriers.map((c) => (
          <BarRow key={c.label} label={c.label} value={`×${c.factor.toFixed(1)}`} frac={c.factor / max} lead={c.lead} low={c.factor < 1} />
        ))}
      </div>
    </Card>
  );
}

/** Where & when — ONE card since rev 11. Two thin cards were two more blocks on the page the owner
 *  called the most overloaded, and they answer one question: where would this land, and when. */
function DistributionCard({ data }: { data: NonNullable<PopulationFrameData["distribution"]> }) {
  const peak = Math.max(1, ...(data.week ?? []).map((d) => d.value));
  return (
    <Card>
      <CardHead title={data.title} meta={data.meta} />
      {data.surfaces?.length ? (
        <div className="mb-3.5">
          <LegendRows rows={data.surfaces.map((s) => ({ label: s.label, value: s.value }))} />
        </div>
      ) : null}
      {data.week?.length ? (
        <div className="mt-3 flex items-end gap-1">
          {data.week.map((d) => (
            <div key={d.day} className="flex-1 text-center">
              {d.hours ? (
                <span className="mb-1 block text-[10px] font-medium tabular-nums" style={{ color: TONE.cream }}>
                  {d.hours}
                </span>
              ) : null}
              <span
                className="block rounded-[5px]"
                style={{ height: Math.max(6, Math.round((d.value / peak) * 38)), background: d.best ? "rgba(236,231,222,.82)" : "rgba(236,231,222,.16)" }}
              />
              <span className="mt-1.5 block text-[10px]" style={{ color: d.best ? TONE.cream : TONE.faint }}>
                {d.day}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

// ── ◇ swap slots kept alive for the other domains ────────────────────────────

/** Pricing's main figure — would-pay share falls as price rises; a cream marker flags the optimum
 *  (cream = the good default; coral stays reserved for the loss). */
function DemandCard({ data }: { data: DemandCurveData }) {
  const W = 366;
  const H = 96;
  const P = 6;
  const line = curvePath(data.points.map((v) => v / 100), W, H, P);
  const ox = P + data.optimalAt * (W - 2 * P);
  return (
    <Card>
      <CardHead title={data.kicker} meta={data.caption} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full">
        <path d={line} fill="none" stroke="rgba(236,231,222,.72)" strokeWidth={1.6} />
        <line x1={ox} y1={0} x2={ox} y2={H} stroke="rgba(236,231,222,.55)" strokeWidth={1} strokeDasharray="3 3" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] tabular-nums" style={{ color: TONE.faint }}>
        <span>{data.loLabel}</span>
        <span style={{ color: TONE.dim }}>{data.optimalLabel}</span>
        <span>{data.hiLabel}</span>
      </div>
    </Card>
  );
}

function SegmentsCard({ title, rows }: { title: string; rows: SegmentStop[] }) {
  return (
    <Card>
      <CardHead title={title} />
      <div className="mt-1">
        {rows.map((s) => (
          <BarRow key={s.label} label={s.label} value={`${s.pct}%`} frac={s.pct / 100} low={s.loss} labelWidth={104} valueWidth={38} />
        ))}
      </div>
    </Card>
  );
}

function MainSlot({ main }: { main: PopulationMain }) {
  // The tri-state row is deliberately NOT drawn: its two figures are the hero chip and the answer's
  // stat row, and a page must not say one fact twice.
  return main.kind === "demand-curve" ? <DemandCard data={main.data} /> : null;
}

// ── the personas-only grade (v8 report — a drop's cached read) ───────────────

/** The ten, as presence — lit = stopped. A tally you can see before you read it. */
function PersonaFaces({ stop, total }: { stop: number; total: number }) {
  return (
    <div className="mt-3.5 flex gap-[6px]">
      {Array.from({ length: total }, (_, i) => {
        const lit = i < stop;
        return (
          <span
            key={i}
            data-testid={`report-face-${i}`}
            data-lit={lit ? "true" : "false"}
            aria-hidden
            className="h-[26px] flex-1 rounded-[6px]"
            style={{ background: lit ? "rgba(236,231,222,.30)" : "rgba(236,231,222,.07)" }}
          />
        );
      })}
    </div>
  );
}

function PersonaVoiceGroup({
  id,
  title,
  voices,
  count,
}: {
  id: "stopped" | "scrolled";
  title: string;
  voices: PersonaVoice[];
  count: number;
}) {
  // Nobody in this group spoke ⇒ no header. An empty section is a promise of evidence we
  // cannot keep, and the group's own count is already on the faces above.
  if (voices.length === 0) return null;
  return (
    <Card>
      <div data-testid={`report-group-${id}`}>
        <CardHead title={title} meta={`${count} of the room`} />
        <div className="mt-1">
          {voices.map((v, i) => (
            <div key={`${v.who}-${i}`} className="py-2">
              <div className="font-serif text-body leading-[1.45]" style={{ color: TONE.dim }}>
                “{v.quote}”
              </div>
              <div className="mt-1 text-caption" style={{ color: TONE.faint }}>
                {v.who}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** The audience page at its PERSONAS-ONLY grade: verdict · ten faces · the real voices · the fix.
 *  The projection strip (terrain, pools, "1,000 simulated") describes a Stage-2 aggregate that
 *  does not exist here, so it is simply OMITTED — never synthesized to fill the slot. */
function PersonaReadFrame({
  read,
  methodOpen,
  onToggleMethod,
  simline,
  onSteer,
}: {
  read: PersonaReadData;
  methodOpen: boolean;
  onToggleMethod?: () => void;
  simline?: string;
  onSteer?: (steer: string) => void;
}) {
  const lost = read.total - read.stop;
  return (
    <div data-page="audience" className="pt-4">
      <div className="rounded-[14px] p-4" style={{ background: SURFACE.figure }}>
        <div className="flex items-baseline gap-1.5">
          <span
            data-testid="report-verdict"
            className="text-stat font-light leading-none tabular-nums"
            style={{ color: TONE.cream }}
          >
            {read.stop}/{read.total}
          </span>
          <span className="text-body" style={{ color: TONE.faint }}>
            stopped scrolling
          </span>
        </div>
        <PersonaFaces stop={read.stop} total={read.total} />
      </div>

      <PersonaVoiceGroup id="stopped" title="Why they stopped" voices={read.stopped} count={read.stop} />
      <PersonaVoiceGroup id="scrolled" title="Why they scrolled" voices={read.scrolled} count={lost} />

      {/* The tab ends in a fix, and the fix feeds the thread as a steer (spec §2). It names the
          real number it is asking you to win back — never a projected gain, which would be a
          claim about a run that has not happened. */}
      {onSteer && lost > 0 ? (
        <button
          type="button"
          onClick={() => onSteer(`Rewrite the hook to win back the ${lost} who scrolled past.`)}
          className="mt-4 w-full rounded-lg border border-white/[0.06] bg-surface-elevated px-3 py-2.5 text-label font-medium text-foreground transition-colors hover:border-white/[0.10]"
        >
          Fix what lost them
        </button>
      ) : null}

      <MethodFoot open={methodOpen} onToggle={onToggleMethod ?? (() => {})} simline={simline} />
    </div>
  );
}

// ── the population role-frame ────────────────────────────────────────────────

export function PopulationFrame({
  population,
  personaRead,
  verdict,
  reducedMotion = false,
  onInterview,
  onJumpToBrain,
  method,
  methodOpen = false,
  onToggleMethod,
  simline,
  onSteer,
}: {
  /** The full Stage-2 projection. Absent ⇒ the frame renders its personas-only grade instead. */
  population?: PopulationFrameData | null;
  /** The reduced evidence base (v8 report). Read only when `population` is absent. */
  personaRead?: PersonaReadData | null;
  verdict: DomainTemplate["verdict"];
  reducedMotion?: boolean;
  onInterview?: (who: string) => void;
  onJumpToBrain?: (moment: string) => void;
  method?: { heading: string; notes: string[] }[];
  methodOpen?: boolean;
  onToggleMethod?: () => void;
  simline?: string;
  /** The personas-only fix action — feeds the thread as a steer. Unused at the full grade,
   *  whose fix lives in the Brain answer block. */
  onSteer?: (steer: string) => void;
}) {
  if (!population) {
    return personaRead ? (
      <PersonaReadFrame
        read={personaRead}
        methodOpen={methodOpen}
        onToggleMethod={onToggleMethod}
        simline={simline}
        onSteer={onSteer}
      />
    ) : null;
  }
  const threaded = population.voices.reasons.find((r) => r.thread);
  return (
    <div data-page="audience">
      <TerrainMap
        terrain={population.terrain}
        verdict={population.heroVerdict ?? verdict}
        reducedMotion={reducedMotion}
        highlightCluster={null}
        figread={population.heroFigread}
      />

      {population.pools?.rows.length ? (
        <Card>
          <CardHead title={population.pools.title} meta={population.pools.meta} />
          {population.pools.rows.some((r) => r.curve?.length) ? (
            <PoolRows rows={population.pools.rows} />
          ) : (
            <LegendRows rows={population.pools.rows.map((r) => ({ label: r.label, value: r.share }))} />
          )}
        </Card>
      ) : null}

      {population.decisionStates ? <DecisionStates data={population.decisionStates} onInterview={onInterview} /> : null}

      <MainSlot main={population.main} />

      {population.audienceFit ? <FitCard data={population.audienceFit} /> : null}
      {population.amplification ? <SpreadCard data={population.amplification} /> : null}
      {population.segments ? <SegmentsCard title={population.segments.title} rows={population.segments.rows} /> : null}
      {population.distribution ? <DistributionCard data={population.distribution} /> : null}

      {/* The cross-page thread survives: a coded reason IS a brain moment, and following it lands on
          the mechanism behind the words. Rendered only when a reason actually carries one. */}
      {threaded && onJumpToBrain ? (
        <button
          type="button"
          onClick={() => onJumpToBrain(threaded.thread!.toMoment)}
          className="mt-3 text-[12px] transition-colors"
          style={{ color: "rgba(255,99,99,.75)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = TONE.coral)}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,99,99,.75)")}
        >
          ↳ {threaded.thread!.toMoment}
        </button>
      ) : null}

      <MethodFoot
        open={methodOpen}
        onToggle={onToggleMethod ?? (() => {})}
        method={method ?? (population.room ? [{ heading: "What this is not", notes: [population.room.note] }] : undefined)}
        simline={simline}
      />
    </div>
  );
}
