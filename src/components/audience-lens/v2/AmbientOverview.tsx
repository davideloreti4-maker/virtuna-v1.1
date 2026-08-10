"use client";

/**
 * AmbientOverview — Ambient Audience v2, surface ① (the room's home).
 *
 * The board: room header (its own facts) · SIMULATING-NOW live card · RANKED results ·
 * NOT-SIMULATED-YET queue · the ＋ door.
 *
 * Rev B+ (2026-08-02) — what changed and why:
 *  - THE 0/10 RANK IS DEAD (owner). The engine no longer measures it, so nothing renders it:
 *    a queued row carries no score, no bar and no rank numeral. A video keeps `viral 84` — that
 *    is a real native craft score, not a projection dressed as one.
 *  - The header states the room's FACTS ("1,000 minds · calibrated · reads on TikTok") instead of
 *    wearing a CALIBRATED badge. The micro-avatar cast cluster and the "on call" footer are gone
 *    with it — the identity is in the sentence now.
 *  - The run in flight is a DOT FIELD (one dot ≈ N/120 minds) filling with real progress, over a
 *    phase line in plain words. The four-word stage stepper and the travelling gradient scan are
 *    deleted: one reported our pipeline's vocabulary, the other performed liveness the fill was
 *    already carrying honestly.
 *  - Sentence-case section headers; zero mono-uppercase chrome anywhere on this surface.
 *
 * Design laws honored:
 *  - Sealed verdicts: staged progress is honest, a partial verdict is never fabricated. The fill
 *    is REAL progress and the number stays withheld until n-of-n decide.
 *  - Matte: no gradients, no shadows, no blur.
 *  - One accent across the three room surfaces, and it is not on this one — the winner reads by
 *    rank position and full-strength cream.
 */

import { useEffect, useRef, useState } from "react";
// The room's headcount moved OUT of this file (2026-08-13): the phone arrival's audience line
// states the same number, and the owner-ruled copy is only true while both read one definition.
import { TIER_VIEWERS } from "@/lib/surfaces/ambient-v2-audience-meta";

// ── view-model ───────────────────────────────────────────────────────────────

/** Fidelity tier (L5): SIM-1 Flash n=1,000 / SIM-1 Max n=10,000. */
export type SimTier = "flash" | "max";

/** Run provenance of a ranked row. `simulated` = a sealed result (default). `queued` = added
 *  but not yet run (shown as an honest absence, never a fabricated score). */
export type RankState = "simulated" | "queued";

/** What KIND of thing was screened — so a mixed board (hooks + ideas + a video test…) is legible
 *  at a glance. Surfaced as small plain-text kind tag per row. */
export type RankKind = "hook" | "idea" | "video" | "script" | "remix" | "concept";

/** One screened stimulus in the ranked list. `stopPct` = the audience's would-stop % (sealed
 *  rows, ranked; the top is the win). A QUEUED row carries no number of its own: the generation-time
 *  persona estimate it used to print (`personaStops`, "8/10") is dead — the engine stopped
 *  measuring it, so the board stopped ranking un-run work by it. */
export interface RankedStimulus {
  id: string;
  stimulus: string;
  stopPct: number;
  viralScore?: number | null; // VIDEO rows only — the tested video's native craft/viral score (0–100),
  //  a REAL measurement of the file, distinct from the attention % (which appears only once simulated).
  kind?: RankKind;
  state?: RankState; // defaults to "simulated"
  /** Set ⇒ `stopPct` is ONE SLICE's stop rate, not the room's, and this is that slice's name.
   *  The board ranks sliced and whole-room verdicts in the same column — they answer different
   *  questions, so the label is what keeps "41% of Builders" from being read as "41% of the room".
   *  It is printed on the row, never dropped: an unlabelled sliced verdict is a mislabelled one. */
  sliceLabel?: string;
  /** Set on a SEALED row whose run produced no population, so there is no depth drill behind it —
   *  the measured % IS the whole answer. Such a row used to look identical to a drillable one and
   *  simply do nothing when tapped (`openStimulus`'s empty else), which is the worst of both. The
   *  house rule is the one already stated on AmbientDetail's tab strip: say "nothing behind this"
   *  BEFORE the tap, not after. So the row stops pretending to be a door. */
  noDepth?: boolean;
}

/** A run in flight. Verdict is SEALED until every agent decides; `verdictPct` reveals then. */
export interface WatchingRun {
  stimulus: string;
  verdictPct?: number;
}

/**
 * One named slice of the calibrated signature — who is actually in the room, and how much of it
 * they are.
 *
 * REAL without a run: `audience.personas` carries archetype + label + share off calibration, so
 * this is knowable the moment the rail mounts. That is the whole reason the resting board can say
 * something true (see `OverviewData.segments`).
 */
export interface RoomSegment {
  /** The ENGINE key. Carried but never displayed — a segment is identified by what the projection
   *  reads, never by `label`, which is creator-editable display text. */
  archetype: string;
  label: string;
  /** Integer percent of the room. The adapter apportions these by largest remainder so a column
   *  of them adds up; see `deriveSegments`. */
  sharePct: number;
  /** The calibration-stored reaction frame, VERBATIM — the only per-segment string the Flash sim
   *  is briefed with. Printed as the row's second line. Empty ⇒ the row prints its name alone. */
  repaint: string;
}

export interface OverviewData {
  audienceName: string;
  provenance: string; // the calibration fact — "calibrated" / "baseline"
  /** Where the room READS — the chosen scene ⑤ arms a run with. Stated in the header facts line. */
  scene: string;
  tier: SimTier;
  watching?: WatchingRun | null; // null ⇒ rest state (no run)
  ranked: RankedStimulus[];
  /**
   * The room's makeup — rendered on the RESTING board (nothing sealed, nothing queued, nothing in
   * flight). This resolves the cast question parked at handoff §8, which sat open because the
   * board only ever mounted beside a thread, where it always had rows.
   *
   * It mounts on the desktop ARRIVAL now (owner ruling 2026-08-11 r3), and there it has none: the
   * ranked list is built from the open thread's descriptor ledger. A board that is only a
   * "0 sealed" header over empty space reads as a panel that failed to load — worse than the foot
   * chip it replaced. So the resting state answers the question it CAN answer without firing
   * anything: who is in this room.
   *
   * Names and shares, NOT initials. Initials were tried in the audience sheet and cut the same day:
   * they carry no information and collide (two segments starting "G" render the same grey tile).
   */
  segments: RoomSegment[];
}

/** Shared fixed height across all three v2 surfaces (build handoff §4 — "same fixed height"). */
export const AMBIENT_PANEL_HEIGHT = 800;

/**
 * How a v2 surface is mounted.
 *  - `rail` (default) — the ≥xl right column: fills top-to-bottom, capped at 440, its own left
 *    hairline divides it from the thread, paints its own #181817 ground.
 *  - `sheet` — the <xl mobile header sheet: full-bleed inside a host that already owns the ground,
 *    the rounding and the height cap, so the surface drops its width cap, hairline and background
 *    and simply flexes to the space the sheet gives it. Tighter gutters for a ~390px viewport.
 *
 * This is a PRESENTATION switch only — every surface renders the same anatomy and the same real
 * data in both modes (the mobile room must not become a second, lesser room).
 */
export type AmbientPresentation = "rail" | "sheet";

/** Horizontal gutter per presentation — 26px reads generous in a 400px rail, cramped at 390 - 52. */
export const ambientGutter = (p: AmbientPresentation) => (p === "sheet" ? "px-[18px]" : "px-[26px]");

const TIER_LABEL: Record<SimTier, string> = { flash: "SIM-1 Flash", max: "SIM-1 Max" };

/** Deterministic thousands separator — `toLocaleString()` is locale-dependent (SSR/client drift). */
const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Tone system (mirrors the mock's :root — kept local for pixel fidelity to the target).
const TONE = {
  cream: "#ece7de",
  head: "rgba(236,231,222,.92)", // section headers — a step under content cream
  dim: "rgba(236,231,222,.62)",
  faint: "rgba(236,231,222,.38)",
  ghost: "rgba(236,231,222,.16)",
  mute: "rgba(236,231,222,.25)",
  card: "#1d1d1c", // the one live card + nothing else
  chip: "#2b2a28", // the Simulate → action chip at rest
  well: "#262624", // …and where it lands on hover
  border: "rgba(255,255,255,.06)",
  hair: "rgba(255,255,255,.08)",
  hover: "rgba(255,255,255,.03)",
} as const;

// ── small primitives ─────────────────────────────────────────────────────────

/**
 * A section header: sentence case, and the right slot carries DATA only.
 *
 * This replaced a mono/uppercase/0.08em-tracked kicker. Terminal chrome reads as instrumentation,
 * and instrumentation is what a creator is trying not to be looking at — the same tell that got
 * the rev-4 "Bloomberg terminal" note. Uppercase also costs a third more width for the same words
 * in a 440px column.
 */
function SectionHead({
  children,
  meta,
  live,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium" style={{ color: TONE.head }}>
        {live ? (
          <span
            className="ambient-live-pulse inline-block h-[6px] w-[6px] flex-none rounded-full"
            style={{ background: TONE.cream }}
          />
        ) : null}
        {children}
      </span>
      {meta ? (
        <span className="flex-none text-[11px] tabular-nums" style={{ color: TONE.faint }}>
          {meta}
        </span>
      ) : null}
    </div>
  );
}

/** The sealed padlock — the verdict is withheld until n-of-n decide (design law: sealed). */
function SealGlyph({ color }: { color: string }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden style={{ color }}>
      <rect x="1.25" y="5" width="7.5" height="6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** A row's type tag — plain faint text. Not a chip: on this surface a chip FILL means an action
 *  you can take (`Simulate →`), and a kind is a fact about the row, not a control. */
function KindTag({ children, tone = TONE.faint }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="flex-none text-[11px] tabular-nums" style={{ color: tone }}>
      {children}
    </span>
  );
}

// ── watching card (dot field, honest fill, sealed verdict) ───────────────────

// The field is 24 × 5. One dot therefore stands for n/120 minds (≈8 at Flash) — a quantisation the
// count line beside it never inherits: that number is exact.
const DOT_COLUMNS = 24;
const DOT_COUNT = DOT_COLUMNS * 5;
const DOT_LIT = "0.85";
const DOT_UNDECIDED = "0.13";

const DUR = 9000;
const HOLD = 2400;
/** The single frame reduced motion renders — mid-run, so the card still reads as a run in flight. */
const REST_FRAME = 0.62;

/** Where the plain-words phase line turns over. The cuts are the mock's; the words are what a
 *  creator would say about the room, not what our pipeline calls its stages. */
const PHASE_CUTS: [p: number, label: (minds: string) => string][] = [
  [0.12, () => "Reading the hook"],
  [0.55, (minds) => `${minds} minds deciding`],
  [0.96, () => "Counting the votes"],
  [Infinity, () => "Sealing the verdict"],
];

function WatchingCard({
  run,
  tier,
  reducedMotion,
}: {
  run: WatchingRun;
  tier: SimTier;
  reducedMotion: boolean;
}) {
  const n = TIER_VIEWERS[tier];
  const fieldRef = useRef<HTMLDivElement>(null);
  // Lazy-init avoids setState-in-effect; live motion's only setState is inside the rAF callback.
  const [decided, setDecided] = useState(() => (reducedMotion ? Math.round(REST_FRAME * n) : 0));
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // The field is painted IMPERATIVELY. `decided` changes ~n times across a run, and rendering
    // 120 children through React on each of those — to flip one opacity — is a lot of
    // reconciliation for the one element on this surface that must not stutter.
    const paint = (p: number) => {
      const el = fieldRef.current;
      if (!el) return;
      const lit = Math.round(p * DOT_COUNT);
      for (let i = 0; i < el.children.length; i++) {
        (el.children[i] as HTMLElement).style.opacity = i < lit ? DOT_LIT : DOT_UNDECIDED;
      }
    };

    if (reducedMotion) {
      paint(REST_FRAME);
      return;
    }
    let raf = 0;
    let start = 0;
    let lastD = -1;
    let lastComplete: boolean | null = null;
    const loop = (now: number) => {
      if (!start) start = now;
      const el = (now - start) % (DUR + HOLD);
      const p = Math.min(el / DUR, 1);
      paint(p);
      const d = p < 1 ? Math.round(p * n) : n;
      if (d !== lastD) {
        lastD = d;
        setDecided(d);
      }
      const c = p >= 1;
      if (c !== lastComplete) {
        lastComplete = c;
        setComplete(c);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, n]);

  const p = complete ? 1 : decided / n;
  const phase = complete
    ? "Every mind has decided"
    : (PHASE_CUTS.find(([cut]) => p < cut) ?? PHASE_CUTS[PHASE_CUTS.length - 1]!)[1](withCommas(n));

  return (
    <div
      className="ambient-row-in mt-3 rounded-[12px] p-4"
      style={{ border: `1px solid ${TONE.border}`, background: TONE.card }}
    >
      {/* what is under test — two lines, because a hook that needs a third is a hook you can open */}
      <div
        className="overflow-hidden text-[14px] leading-[1.45]"
        style={{
          color: TONE.cream,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {run.stimulus}
      </div>

      {/* THE FIELD — the room as individuals, filling as they decide. A bar says "63% loaded";
          this says "these many of them have answered", which is the thing actually happening. */}
      <div
        ref={fieldRef}
        data-testid="ambient-dot-field"
        aria-hidden
        className="mt-4 grid"
        style={{ gridTemplateColumns: `repeat(${DOT_COLUMNS}, 1fr)`, rowGap: 9 }}
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <span
            key={i}
            className="h-[5px] w-[5px] justify-self-center rounded-full"
            style={{ background: TONE.cream, opacity: DOT_UNDECIDED, transition: "opacity .5s ease" }}
          />
        ))}
      </div>

      <div className="mt-[15px] flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px]" style={{ color: "rgba(236,231,222,.8)" }}>
          {phase}
        </span>
        <span className="flex-none tabular-nums text-[12px]" style={{ color: TONE.faint }}>
          {withCommas(complete ? n : decided)} of {withCommas(n)}
        </span>
      </div>

      {/* THE SEAL. It swaps to the verdict only when the run is complete AND a verdict exists —
          an engine that returned nothing leaves this sealed rather than showing a number for it. */}
      <div
        className="mt-[13px] flex min-h-[22px] items-center justify-between border-t pt-3"
        style={{ borderColor: TONE.border }}
      >
        {complete && run.verdictPct != null ? (
          <span className="tabular-nums text-[15px] font-semibold" style={{ color: TONE.cream }}>
            {run.verdictPct}%
            <span className="ml-[5px] text-[12px] font-normal" style={{ color: TONE.dim }}>
              would stop
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-[7px] text-[12px]" style={{ color: TONE.faint }}>
            <SealGlyph color={TONE.faint} />
            Sealed until all {withCommas(n)} decide
          </span>
        )}
      </div>
    </div>
  );
}

// ── ranked row ───────────────────────────────────────────────────────────────

/** A SEALED result row — ranked, clickable into the detail/brain. */
function SealedRow({
  rank,
  r,
  index,
  barRef,
  onOpen,
}: {
  rank: number;
  r: RankedStimulus;
  index: number;
  /** The board's own winner — every bar is drawn against it, so the top row is always a full bar
   *  and the rest read as "how close to the best thing here". The old fixed BAR_REF=50 meant a
   *  board whose best row scored 20% drew five stubs and looked like a broken component. */
  barRef: number;
  onOpen?: (id: string) => void;
}) {
  const w = barRef > 0 ? Math.min(1, r.stopPct / barRef) : 0;
  const top = rank === 1;
  // A run with no population has no drill behind it. Don't dress it as a door: no pointer, no hover
  // lift, no click handler — and a tag below that names the state. Previously such a row was a
  // fully-armed button whose tap hit an empty `else`, which reads as a broken app rather than as an
  // honest limit. (Disabling is deliberate over "open an empty drill": there is genuinely nothing
  // to show — the aggregate the depth view is built from is the thing that is missing.)
  const drillable = !r.noDepth;

  return (
    <li
      className="ambient-row-in last:border-b-0"
      style={{ animationDelay: `${0.04 + index * 0.05}s`, borderBottom: `1px solid ${TONE.border}` }}
    >
      <button
        type="button"
        onClick={drillable ? () => onOpen?.(r.id) : undefined}
        disabled={!drillable}
        aria-label={drillable ? undefined : `${r.stimulus} — verdict only, no depth behind this row`}
        className={`group block w-full rounded-[8px] px-0.5 py-[13px] text-left transition-colors ${
          drillable ? "cursor-pointer" : "cursor-default"
        }`}
        onMouseEnter={drillable ? (e) => (e.currentTarget.style.background = TONE.hover) : undefined}
        onMouseLeave={drillable ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
      >
        <span className="flex items-baseline gap-2.5">
          <span
            className="w-[14px] flex-none tabular-nums text-[12px]"
            style={{ color: top ? TONE.dim : TONE.faint }}
          >
            {rank}
          </span>
          {/* the title is the widest element on the row — it is what the creator is looking for */}
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
            style={{ color: TONE.cream }}
          >
            {r.stimulus}
          </span>
          {r.kind ? <KindTag>{r.kind}</KindTag> : null}
          {/* a tested video keeps its native viral score in view — the % is the audience read on top */}
          {r.kind === "video" && r.viralScore != null ? <KindTag>viral {r.viralScore}</KindTag> : null}
          {/* A SLICED verdict says whose it is, right next to the number. Without this the row is
              indistinguishable from a reading of the whole room — same column, same bar. */}
          {r.sliceLabel ? <KindTag>{r.sliceLabel}</KindTag> : null}
          {/* The run landed a real %, but produced no population — so this row is the end of the
              road, not a door. Saying so costs one tag and removes an inert click. */}
          {r.noDepth ? <KindTag>verdict only</KindTag> : null}
          <span className="flex-none tabular-nums text-[14px] font-semibold" style={{ color: TONE.cream }}>
            {r.stopPct.toFixed(1)}%
          </span>
        </span>

        <span
          className="relative mb-px ml-6 mt-2.5 block h-[3px] overflow-hidden rounded-full"
          style={{ background: TONE.ghost }}
        >
          {/* the win reads at full strength; every other bar steps back. One accent per surface,
              and this is not where it is spent — position and weight carry the ranking. */}
          <span
            className="absolute inset-0 block origin-left rounded-full"
            style={{
              transform: `scaleX(${w})`,
              background: top ? "rgba(236,231,222,.92)" : "rgba(236,231,222,.45)",
            }}
          />
        </span>
      </button>
    </li>
  );
}

/**
 * A QUEUED row — on the board, not yet run past the audience.
 *
 * It used to mirror the sealed anatomy exactly: a rank numeral, an `N/10` value and a muted bar,
 * all three derived from `personaStops`. That number was the generation model's self-estimate, the
 * engine stopped measuring it, and the owner called it dead — so the row now carries NO score, NO
 * bar and no rank position. What it carries instead is the one true thing about it: it hasn't been
 * run, and here is the button that runs it. A video keeps `viral 84`, which is a real score of the
 * actual file.
 */
function QueuedRow({
  r,
  index,
  onSimulate,
}: {
  r: RankedStimulus;
  index: number;
  onSimulate?: (id: string) => void;
}) {
  return (
    <li
      className="ambient-row-in last:border-b-0"
      style={{ animationDelay: `${0.04 + index * 0.05}s`, borderBottom: `1px solid ${TONE.border}` }}
    >
      <button
        type="button"
        onClick={() => onSimulate?.(r.id)}
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-0.5 py-[13px] text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = TONE.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
          style={{ color: "rgba(236,231,222,.66)" }}
        >
          {r.stimulus}
        </span>
        {r.kind ? <KindTag>{r.kind}</KindTag> : null}
        {r.kind === "video" && r.viralScore != null ? <KindTag>viral {r.viralScore}</KindTag> : null}
        {/* THE one chip fill on the board — because it is the one thing on the row you can DO.
            Persistent, never hover-revealed: a touch user has no hover, and this is the door. */}
        <span
          className="flex-none rounded-full px-2.5 py-[5px] text-[11px] transition-colors group-hover:bg-[#262624] group-hover:text-[#ece7de]"
          style={{ background: TONE.chip, color: TONE.dim }}
        >
          Simulate&nbsp;→
        </span>
      </button>
    </li>
  );
}

/**
 * One row of the resting board: a slice of the room, how much of it it is, and what it judges by.
 *
 * Deliberately NOT a button. Every other row on this surface is a door (open the drill, fire the
 * sim), and there is nothing behind a segment — the house rule already stated on the ＋ door and
 * on `noDepth` rows is that a control with nothing behind it is worse than no control. So this
 * borrows the row's metrics and its hairline, and none of its affordance: no hover fill, no chip.
 *
 * Share sits right in tabular-nums, matching the audience sheet's name-left / value-right grammar
 * (2026-08-11 r2) so the right edge of a column of them stays straight.
 *
 * ── The name and the frame (owner ruling 2026-08-12) ──────────────────────────────────
 *
 * The name/share pair alone was the two facts the algorithm does not use — the label never reaches
 * the model (F7) and the share is documented as not the prediction dial. The frame beneath it IS
 * the brief the sim runs on, so the row now states what these people judge by, in the words the
 * model was actually given. Ten rows of 15/12/12/10/10/10/8/8/8/7 also stop reading as a flat
 * distribution once each one says something different — which is why truncating the list was the
 * wrong fix for that complaint.
 *
 * ⚠️ THE BOARD SCROLLS AT 900px, AND THAT IS THE RULING (owner, 2026-08-12). Measured: ten rows at
 * 76px overrun the 825px scroll region by ~155px, so the last row, the rest line and the ＋ door
 * are one scroll down on the desktop arrival. The alternative was clamping each frame to one line,
 * which fits exactly — and truncates every row precisely where its payload is ("dismisses low-…").
 * The frames are the reason this row exists; a complete one that scrolls beats a cropped one that
 * doesn't. Do not "fix" this back with a line-clamp. Row padding is `py-[10px]` rather than the
 * board's usual 13 for the same reason: it buys 60px of that overrun back at no cost to the text.
 */
function SegmentRow({ s, index }: { s: RoomSegment; index: number }) {
  return (
    <li
      className="ambient-row-in last:border-b-0"
      style={{ animationDelay: `${0.04 + index * 0.05}s`, borderBottom: `1px solid ${TONE.border}` }}
    >
      {/* py-[10px], not the board's usual 13: a two-line row needs less padding than a one-line one
          to keep the same rhythm, and those 6px × 10 rows are what keeps the ＋ door — the only
          control this board has — above the fold at a 900px viewport. */}
      <div className="w-full px-0.5 py-[10px]">
        <div className="flex items-center gap-2.5">
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
            style={{ color: "rgba(236,231,222,.66)" }}
          >
            {s.label}
          </span>
          <span className="flex-none text-[12px] tabular-nums" style={{ color: TONE.faint }}>
            {s.sharePct}%
          </span>
        </div>
        {/* Never invented: a segment stored before the field existed carries no frame and prints
            none, rather than a plausible sentence nobody briefed the model with. */}
        {s.repaint ? (
          <p className="mt-[3px] text-[12px] leading-[1.45]" style={{ color: TONE.faint }}>
            {s.repaint}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ── room header glyph — a calm audience cluster (people, not a sparkline) ─────
// A small crowd of cream nodes at varied depth (opacity), no connecting lines — the old
// constellation's lines read as a stock chart. Static: the only live motion on the surface belongs
// to the run in flight, so the mark stays calm and doesn't compete.

function RoomGlyph() {
  return (
    <svg viewBox="0 0 20 16" className="h-[15px] w-[18px] flex-none" aria-hidden>
      <circle cx="4" cy="11" r="2" fill="#ece7de" opacity=".9" />
      <circle cx="9.5" cy="6" r="2" fill="#ece7de" opacity=".62" />
      <circle cx="14.5" cy="11.5" r="1.9" fill="#ece7de" opacity=".78" />
      <circle cx="16.5" cy="5" r="1.5" fill="#ece7de" opacity=".4" />
    </svg>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientOverview({
  data,
  reducedMotion = false,
  onOpenStimulus,
  onQuickSimulate,
  onTestVariant,
  onDismiss,
  presentation = "rail",
  className,
}: {
  data: OverviewData;
  reducedMotion?: boolean;
  onOpenStimulus?: (id: string) => void;
  onQuickSimulate?: (id: string) => void;
  /**
   * The ＋ door — "Show them your own work". Opens the cold intake, which is the ONLY way to put
   * a stimulus the creator brought in front of the room.
   *
   * ⚠️ Absent ⇒ the row is NOT RENDERED, deliberately. It used to render unconditionally with
   * `onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}` behind it, which meant
   * two defects in one line: on an empty rail `descriptors[0]` is undefined and the ＋ was a DEAD
   * BUTTON (verified live — and it is the only control a new creator's board has), while on a
   * non-empty rail it re-armed their FIRST EXISTING CARD instead of testing anything new. A door
   * with nothing behind it is worse than no door, so a host that cannot run a brought stimulus
   * (the /dev/cards gallery, the fixture review page) shows no door.
   */
  onTestVariant?: () => void;
  /** When the board IS the whole screen (the mobile full-screen room), the header caret is the way
   *  OUT. Given ⇒ it closes; absent ⇒ the rail's inert switch caret, unchanged. */
  onDismiss?: () => void;
  presentation?: AmbientPresentation;
  className?: string;
}) {
  const { audienceName, provenance, scene, tier, watching, ranked, segments } = data;
  const sheet = presentation === "sheet";
  const gutter = ambientGutter(presentation);

  // Split the board: SEALED results on top (ranked high→low), the un-run QUEUED ones below in
  // ledger order — the adapter already ordered them, so this filter preserves what it decided.
  const sealed = ranked.filter((r) => r.state !== "queued").sort((a, b) => b.stopPct - a.stopPct);
  const queued = ranked.filter((r) => r.state === "queued");
  const barRef = sealed[0]?.stopPct ?? 0;
  // NOTHING to rank — the arrival rail, before any work exists. Not the same as "0 sealed": a
  // board with queued rows is a waiting room and already says so. This is the room at rest.
  const atRest = !watching && sealed.length === 0 && queued.length === 0;

  return (
    <div
      data-testid="ambient-overview"
      data-presentation={presentation}
      className={
        (sheet
          ? // Sheet: the host bar owns the ground, the rounding and the height cap; the surface just
            // flexes into it (min-h-0 so its scroll region can shrink below content height).
            "flex min-h-0 w-full flex-1 flex-col"
          : "flex w-full max-w-[440px] flex-col") + ` ${className ?? ""}`
      }
      style={{
        // Connected rail — fills its column top-to-bottom (part of the thread page, NOT a floating
        // card). A single left hairline divides it from the thread; no shadow, no rounding, no gaps.
        // Sheet mode inherits all three from its host instead.
        ...(sheet
          ? {}
          : { height: "100%", background: "var(--color-chrome)", borderLeft: `1px solid ${TONE.border}` }),
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* ROOM HEADER — the room's facts, not a badge.
          It used to be name + a bordered `CALIBRATED` pill, and the pill said one word about the
          room while the three things a creator actually wants to know — how many minds, how fresh
          the calibration, and where they're reading — were nowhere on the board. The pill is gone
          and the facts are the line under the name. `onDismiss` (mobile) turns the caret into the
          way out; without it the caret is the rail's inert switch. */}
      <div className={`${gutter} ${sheet ? "pt-[18px]" : "pt-[26px]"}`}>
        <div className="flex items-center gap-2.5">
          <RoomGlyph />
          <span className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.015em]">{audienceName}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={onDismiss ? "Close your audience" : "Switch audience"}
            // 24px is fine for a pointer; a touch target that closes the whole screen is not allowed
            // to be under 44px (the caret is the ONLY way out of the full-screen room).
            className={`ml-auto flex flex-none items-center justify-center rounded-full transition-colors ${
              sheet ? "-mr-2 h-11 w-11" : "h-6 w-6"
            }`}
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TONE.cream;
              e.currentTarget.style.background = TONE.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TONE.faint;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width={sheet ? "14" : "11"}
              height={sheet ? "14" : "11"}
              viewBox="0 0 12 12"
              aria-hidden
              // Dismiss points UP — the room came down over the thread, the caret sends it back.
              className={onDismiss ? "rotate-180" : ""}
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {/* "viewers", not "minds", and "simulating for", not "reads on" (owner, 2026-08-12).
            The room is a modelled audience for a platform — say which, in the product's verb. */}
        <div className="mt-[7px] text-[12px] tabular-nums" style={{ color: TONE.faint }}>
          <span className="font-medium" style={{ color: TONE.dim }}>
            {withCommas(TIER_VIEWERS[tier])} viewers
          </span>
          {" · "}
          {provenance}
          {" · simulating for "}
          {scene}
        </div>
      </div>

      {/* scroll region — watching + ranked */}
      <div className={`min-h-0 flex-1 overflow-y-auto ${gutter}`}>
        {watching ? (
          <div className="mt-[26px]">
            <SectionHead meta={TIER_LABEL[tier]} live>
              Simulating now
            </SectionHead>
            <WatchingCard run={watching} tier={tier} reducedMotion={reducedMotion} />
          </div>
        ) : null}

        <div className="mt-7">
          {/* AT REST — the arrival board. It states the room's makeup instead of an empty "Ranked",
              because the makeup is the one thing that is true before any work exists, and stating
              it costs no run (fire-on-demand: navigation never fires a sim). See
              `OverviewData.segments`. A General/uncalibrated audience has no slices, so the list is
              conditional and the line carries the state alone. */}
          {atRest ? (
            <>
              {segments.length > 0 ? (
                <>
                  <SectionHead meta={`${segments.length} groups`}>In the room</SectionHead>
                  <ul className="mt-1">
                    {segments.map((s, i) => (
                      <SegmentRow key={s.archetype} s={s} index={i} />
                    ))}
                  </ul>
                </>
              ) : null}
              <p
                data-testid="ambient-overview-rest"
                className={`${segments.length > 0 ? "mt-[18px]" : "mt-1"} text-[12px] leading-[1.5]`}
                style={{ color: TONE.faint }}
              >
                {/* NOT "results land here, ranked" (owner, 2026-08-12). Ranking is a comparison
                    ACROSS sealed runs — one send produces a verdict, not a rank — and nothing is
                    sent automatically: the creator makes something in the thread and then chooses
                    to put it in front of the room. The line has to leave the send in their hands. */}
                Nothing simulated yet. Send anything you make to the room and their verdict lands
                here.
              </p>
            </>
          ) : (
            <>
              {/* Nothing sealed ⇒ no Ranked section AT ALL. It used to render its head unconditionally,
                  so a board carrying only queued work opened on "Ranked · 0 sealed" over a void and
                  then the real content — the same failed-to-load read the resting state above exists
                  to avoid, one state over. A section with no rows is not a section. */}
              {sealed.length > 0 ? (
                <>
                  <SectionHead meta={`% who would stop · ${sealed.length} sealed`}>Ranked</SectionHead>
                  <ul className="mt-1">
                    {sealed.map((r, i) => (
                      <SealedRow key={r.id} rank={i + 1} r={r} index={i} barRef={barRef} onOpen={onOpenStimulus} />
                    ))}
                  </ul>
                </>
              ) : null}

              {/* the un-run group — an honest waiting room with a quick-simulate door, and no score */}
              {queued.length > 0 ? (
                <div className={sealed.length > 0 ? "mt-[26px]" : undefined}>
                  <SectionHead meta={`${queued.length} queued`}>Not simulated yet</SectionHead>
                  <ul className="mt-1">
                    {queued.map((r, i) => (
                      <QueuedRow key={r.id} r={r} index={sealed.length + i} onSimulate={onQuickSimulate} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

          {/* The ＋ door. Rendered only when a host can actually run what comes through it (see the
              prop doc). It carries the SAME name as Start's door — one act, one name, wherever a
              creator meets it. */}
          {onTestVariant ? (
            <button
              type="button"
              data-testid="ambient-sim-door"
              onClick={onTestVariant}
              className="mt-3.5 flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-[11px] text-left transition-colors"
              style={{ background: "rgba(255,255,255,.02)", border: `1px solid ${TONE.border}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.045)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,.13)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.02)";
                e.currentTarget.style.borderColor = TONE.border;
              }}
            >
              <span aria-hidden className="flex-none text-[15px] leading-none" style={{ color: TONE.faint }}>
                ＋
              </span>
              {/* NOT "Test something of your own" (owner, 2026-08-12): the composer's chip row a
                  few hundred px away already says "Test a draft", so two different doors were
                  wearing the same verb. Kept to ~24 chars — "Put your own work in front of them"
                  was the ruling's wording but it wraps to two lines in a 400px rail and collides
                  with the hint on its right. */}
              <span className="text-[13px]" style={{ color: TONE.dim }}>
                Show them your own work
              </span>
              <span className="ml-auto flex-none text-[11px]" style={{ color: TONE.faint }}>
                a draft, a video, or a link
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
