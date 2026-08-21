"use client";

/**
 * rail-kit — the rev-12 card grammar the three drill pages are built from.
 *
 * One vocabulary, so Brain · Engagement · Audience read as one instrument instead of three
 * treatments. Everything here is matte (no gradient, glass, glow, inset-shine or shadow — verify by
 * walking computed style, never by grepping) and single-accent: coral is LOSS, in chrome, at most
 * ONE zone per page. If "good" must read as good it does so by weight, size and position — cream at
 * full strength IS the positive state.
 *
 * Three laws worth restating where they are implemented, because each cost a revision:
 *  · Cards END ON THEIR DATA. There are no card feet, no page-answer lines and no floating reads —
 *    rev 11 deleted the text layer instead of improving it ("or nothing" won). The surface's one
 *    sentence is the verdict headline.
 *  · Mixed units are fixed by NAMING each scale in the card's right-meta, never by hiding the block.
 *    Rev 8 folded the instrument into a drawer to keep one unit and the page came back too thin.
 *  · Grades carry NO colour. `brain-signals.ts` calls them "a cutoff on a MODELED signal, NOT a
 *    benchmark against real outcomes", and an unbenchmarked judgement must not shout.
 *
 * No scroll-reveal here on purpose: the shipped rail's `StaggerReveal` renders the grid and heatmap
 * as blank voids in any capture that expands the scroller without walking it, and these cards carry
 * no motion worth that cost.
 */

import { TONE } from "./AmbientDetail";
import type { AnswerStat, MetricTile, RankStripData, VoiceRow } from "./domain-template";

/** Deterministic en-US thousands grouping — `toLocaleString()` honors the machine's locale and
 *  rendered "1.000" (European) on this box; same guard as the adapters'. */
const fmtCount = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── surfaces ──────────────────────────────────────────────────────────────────

export const SURFACE = {
  card: "#212120",
  chip: "#2b2a28",
  chipOn: "#343330",
  figure: "#131210",
  scrim: "rgba(20,20,19,.82)",
} as const;

/** A filled card — no border. Grouping is by FILL, exactly one level deep; the failure rev 3 was
 *  rejected for was borders inside borders, not nesting itself. */
export function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="mt-3 rounded-[14px] px-[15px] pb-4 pt-[15px]" style={{ background: SURFACE.card }}>
      {children}
    </div>
  );
}

/** Plain-text card header (TikTok Studio has no header icons) + a right-meta that survives ONLY
 *  where the label IS data: the scale it is on, the denominator, the live scrub readout. */
export function CardHead({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <h3 className="whitespace-nowrap text-[14px] font-medium tracking-[-0.005em]" style={{ color: TONE.cream }}>
        {title}
      </h3>
      {meta ? (
        <span className="whitespace-nowrap text-[11px] tabular-nums" style={{ color: TONE.faint }}>
          {meta}
        </span>
      ) : null}
    </div>
  );
}

// ── tiles · the TikTok "Key metrics" idiom ────────────────────────────────────

/** Label · big number · the delta vs the creator's OWN catalogue. No coral: the dominant loss is
 *  named once, in the answer. A tile that shouted it again made four red things on one screen. */
export function Tiles({ tiles, cols = 2 }: { tiles: MetricTile[]; cols?: 2 | 3 }) {
  return (
    <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[10px] px-3 pb-3 pt-[11px]"
          style={{ background: t.lead ? SURFACE.chipOn : SURFACE.chip }}
        >
          <span className="block truncate text-[11px]" style={{ color: TONE.faint }}>
            {t.label}
          </span>
          <b className="mt-[5px] block text-[21px] font-medium leading-[1.15] tracking-[-0.012em] tabular-nums" style={{ color: TONE.cream }}>
            {t.value}
          </b>
          {t.delta ? (
            <span className="mt-[3px] block text-[11px] tabular-nums" style={{ color: TONE.dim }}>
              {t.delta}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** The answer's evidence — number + label pairs, not a clause (rev 11). */
export function AStat({ stats }: { stats: AnswerStat[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1">
      {stats.map((s) => (
        <span key={`${s.value}-${s.label}`} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <b className="text-[15px] font-medium leading-none tracking-[-0.01em] tabular-nums" style={{ color: s.loss ? TONE.coral : TONE.cream }}>
            {s.value}
          </b>
          <span className="text-[11px]" style={{ color: TONE.faint }}>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── rows ──────────────────────────────────────────────────────────────────────

/** A legend row — dot · name · value. The segmented composition strips these used to sit under were
 *  deleted in rev 12 (owner): the percentages already live here. */
export function LegendRows({ rows }: { rows: { label: string; value: string; weight?: number }[] }) {
  const shade = (i: number) => `rgba(236,231,222,${[0.88, 0.52, 0.32, 0.18][i] ?? 0.18})`;
  return (
    <div className="mt-1.5">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="flex items-center gap-2.5 py-2"
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${TONE.border}` : undefined }}
        >
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: shade(i) }} />
          <span className="min-w-0 flex-1 text-[13px]" style={{ color: TONE.dim }}>
            {r.label}
          </span>
          <b className="text-[14px] font-medium tabular-nums" style={{ color: TONE.cream }}>
            {r.value}
          </b>
        </div>
      ))}
    </div>
  );
}

/**
 * An anchored bar row — the reason/fit/spread grammar.
 *
 * `diverging` puts a zero line at the centre and grows each bar out from it. An over/under index
 * NEEDS that line: without one, −68% simply draws longer than +5% and the bar lies about direction.
 * A negative index or a sub-1× multiplier is LOW, not a loss — it reads faint, never coral, because
 * the page's one coral is spoken for.
 */
export function BarRow({
  label,
  value,
  frac,
  negative = false,
  diverging = false,
  lead = false,
  low = false,
  labelWidth = 88,
  valueWidth = 48,
}: {
  label: string;
  value: string;
  frac: number; // 0..1 of the available half (diverging) or full track
  negative?: boolean;
  diverging?: boolean;
  lead?: boolean;
  low?: boolean;
  labelWidth?: number;
  valueWidth?: number;
}) {
  const fill = low ? "rgba(236,231,222,.22)" : lead ? "rgba(236,231,222,.85)" : "rgba(236,231,222,.5)";
  const width = `${(Math.min(1, Math.max(0, frac)) * (diverging ? 48 : 100)).toFixed(1)}%`;
  return (
    <div className="flex items-center gap-[11px] py-2">
      <span className="flex-none text-[13px]" style={{ width: labelWidth, color: lead ? TONE.cream : TONE.dim }}>
        {label}
      </span>
      <span className="relative h-[7px] flex-1 rounded-[4px]" style={{ background: "rgba(236,231,222,.07)" }}>
        {diverging ? <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(236,231,222,.22)" }} /> : null}
        <span
          className="absolute inset-y-0 rounded-[4px]"
          style={{ width, background: fill, ...(diverging ? (negative ? { right: "50%" } : { left: "50%" }) : { left: 0 }) }}
        />
      </span>
      <span
        className="flex-none text-right text-[13px] font-medium tabular-nums"
        style={{ width: valueWidth, color: low ? TONE.faint : TONE.cream }}
      >
        {value}
      </span>
    </div>
  );
}

/** Heat cells — one row of per-second intensity. The shared grammar of the activation grid and the
 *  reaction timeline, so "when it fires" reads the same way on both pages. */
export function HeatCells({ values, dead = false, height = 9 }: { values: number[]; dead?: boolean; height?: number }) {
  return (
    <span className="flex flex-1 gap-px">
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ height, background: `rgba(236,231,222,${dead ? 0.03 : Math.min(0.88, Math.max(0.05, v)).toFixed(2)})` }}
        />
      ))}
    </span>
  );
}

/** An axis strip under a per-second figure. */
export function Axis({ left, right, mid, indent = 0 }: { left: string; right: string; mid?: string; indent?: number }) {
  return (
    <div className="mt-1.5 flex justify-between text-[10px] tabular-nums" style={{ marginLeft: indent, color: TONE.faint }}>
      <span>{left}</span>
      {mid ? <span>{mid}</span> : null}
      <span>{right}</span>
    </div>
  );
}

// ── the rank strip — the benchmark, drawn ─────────────────────────────────────

/** This clip among the creator's own last N. Rev 11's Key-metrics meta already SAID "vs your last 41
 *  videos"; rev 12 draws it, so the claim has a figure under it. Benchmarks are the creator's own
 *  catalogue, never an industry band. */
export function RankStrip({ data }: { data: RankStripData }) {
  const at = (v: number) => `${((v / data.max) * 100).toFixed(1)}%`;
  // The benchmark has to SAY it is the benchmark. Unlabelled, the strip read as a dashed line with two
  // indistinguishable marks on it — the axis named "this clip" but nothing named the tick you are meant
  // to compare it against, which is the whole point of drawing the catalogue. The caption flips to the
  // tick's left in the last third so it can never run off the card.
  const medPct = (data.median / data.max) * 100;
  const flip = medPct > 66;
  return (
    <>
      <div className="relative mt-3.5 h-[35px]">
        <span className="absolute inset-x-0 top-[9px] h-1 rounded-sm" style={{ background: "rgba(236,231,222,.06)" }} />
        {data.values.map((v, i) => (
          <span
            key={i}
            className="absolute top-[11px] h-[3px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ left: at(v), background: "rgba(236,231,222,.22)" }}
          />
        ))}
        <span className="absolute top-[5px] h-3 w-px -translate-x-1/2" style={{ left: at(data.median), background: "rgba(236,231,222,.42)" }} />
        <span
          className="absolute top-[7px] h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ left: at(data.value), background: TONE.cream }}
        />
        <span
          className="absolute top-[21px] whitespace-nowrap text-[10px] tabular-nums"
          style={{
            color: TONE.faint,
            ...(flip ? { right: `${(100 - medPct).toFixed(1)}%`, marginRight: 5 } : { left: at(data.median), marginLeft: 5 }),
          }}
        >
          median {data.median}
          {data.unit}
        </span>
      </div>
      <Axis left={`0${data.unit}`} mid={`this clip · ${data.value}${data.unit}`} right={`${data.max}${data.unit}`} />
    </>
  );
}

// ── voices — the ONLY serif on the surface ────────────────────────────────────

/** A simulated viewer, in their own words. Content, not chrome: the serif stays. The tag is a human
 *  descriptor ("small creator"), never a caste — the archetype namespace is owner-retired. `interview ›`
 *  surfaces the `PersonaChatDrawer` affordance the frames already ship. */
export function Voice({
  voice,
  onInterview,
  divider = false,
}: {
  voice: VoiceRow;
  onInterview?: (who: string) => void;
  divider?: boolean;
}) {
  const denom = voice.echoOf && voice.echoOf > 0 ? voice.echoOf : voice.echo;
  return (
    <div className="py-3" style={{ borderBottom: divider ? `1px solid ${TONE.border}` : undefined }}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-[23px] w-[23px] flex-none items-center justify-center rounded-full text-[11px] font-medium"
          style={{ background: SURFACE.chipOn, color: voice.loss ? TONE.coral : TONE.dim }}
        >
          {voice.who.slice(0, 1)}
        </span>
        <b className="text-[13px] font-medium" style={{ color: TONE.cream }}>
          {voice.who}
        </b>
        <span className="rounded-md px-[7px] py-0.5 text-[11px]" style={{ background: SURFACE.chip, color: TONE.faint }}>
          {voice.tag}
        </span>
        {onInterview ? (
          <button
            type="button"
            onClick={() => onInterview(voice.who)}
            className="ml-auto flex-none text-[11px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.dim)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            interview ›
          </button>
        ) : null}
      </div>
      <p className="mt-2 font-serif text-[15px] leading-[1.5]" style={{ color: TONE.cream }}>
        {voice.quote}
      </p>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="whitespace-nowrap text-[11px] tabular-nums" style={{ color: voice.loss ? TONE.coral : TONE.faint }}>
          {/* The denominator makes the count readable — "453 would echo this" floats without the
              room's size; "453 of 1,001" is a share you can weigh at a glance. */}
          {voice.echoOf && voice.echoOf > voice.echo
            ? `${fmtCount(voice.echo)} of ${fmtCount(voice.echoOf)} would echo this`
            : `${fmtCount(voice.echo)} would echo this`}
        </span>
        <span className="h-[3px] flex-1 overflow-hidden rounded-sm" style={{ background: "rgba(236,231,222,.09)" }}>
          <span
            className="block h-full rounded-sm"
            style={{
              width: `${Math.min(100, Math.round((voice.echo / Math.max(1, denom)) * 100))}%`,
              background: voice.loss ? TONE.coral : "rgba(236,231,222,.42)",
            }}
          />
        </span>
      </div>
      {voice.swing ? (
        <div className="mt-2 text-[12px] font-medium tabular-nums" style={{ color: TONE.dim }}>
          {voice.swing}
        </div>
      ) : null}
    </div>
  );
}

// ── the page close: the method drawer + the sim disclosure ────────────────────

/** "How to read these numbers" — the drawer EXPLAINS the instrument (which scale each block is on,
 *  what the model cannot claim). It holds no second copy of it: rev 8 hid the instrument in here and
 *  the Brain tab came back thinner than the shipped one it was replacing. Zero coral inside. */
export function MethodFoot({
  open,
  onToggle,
  method,
  simline,
}: {
  open: boolean;
  onToggle: () => void;
  method?: { heading: string; notes: string[] }[];
  simline?: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="mt-6 flex w-full items-center justify-between pt-3.5 text-[12px] transition-colors"
        style={{ borderTop: `1px solid ${TONE.border}`, color: open ? TONE.dim : TONE.faint }}
      >
        <span>How to read these numbers</span>
        <span style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>›</span>
      </button>
      {open && method?.length ? (
        <div className="pt-1">
          {method.map((m) => (
            <div key={m.heading}>
              <div
                className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-[0.09em]"
                style={{ color: TONE.faint }}
              >
                {m.heading}
              </div>
              {m.notes.map((n, i) => (
                <p key={i} className="mt-2.5 text-[11px] leading-[1.5]" style={{ color: TONE.faint }}>
                  {n}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {simline ? (
        <div className="mt-3.5 text-[10px] leading-[1.5] tabular-nums" style={{ color: TONE.faint }}>
          {simline}
        </div>
      ) : null}
    </>
  );
}

// ── figure helpers ────────────────────────────────────────────────────────────

/**
 * An SVG polyline through 0..1 values, top-left origin. Shared by the retention curve, the per-pool
 * sparks and the median band so every curve on the surface is drawn by one function.
 *
 * `span` is the number of points the X axis represents, which is NOT always `values.length`: drawing
 * a SEGMENT of a curve (the coral run up to the break) has to keep the parent's spacing or the four
 * points stretch across the whole card and the figure claims the room left over 28 seconds when it
 * left over three.
 */
export function curvePath(values: number[], w: number, h: number, pad: number, span = values.length): string {
  if (values.length < 2 || span < 2) return "";
  return (
    "M" +
    values
      .map((v, i) => `${(pad + (i / (span - 1)) * (w - 2 * pad)).toFixed(1)},${(h - pad - v * (h - 2 * pad)).toFixed(1)}`)
      .join(" L")
  );
}

/** Sample a 0..1 curve at a 0..1 position, linearly — the playhead reads the same value the line
 *  draws, so the readout can never disagree with the figure. */
export function sampleCurve(values: number[], u: number): number {
  if (!values.length) return 0;
  const f = Math.min(1, Math.max(0, u)) * (values.length - 1);
  const i = Math.floor(f);
  const next = values[Math.min(i + 1, values.length - 1)]!;
  return values[i]! + (next - values[i]!) * (f - i);
}

export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
