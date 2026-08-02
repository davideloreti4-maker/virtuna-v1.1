"use client";

/**
 * AmbientSimulate — Ambient Audience v2, surface ⑤ "the develop / spend gateway".
 *
 * The single universal place a full simulation is ARMED (2026-07-21 config/rank model). Every path to
 * a full read passes through here — nothing ever auto-sims — because ⑤ is the SPEND MOMENT and must
 * always be visible + deliberate. Two entry modes:
 *
 *   - `develop` (warm, the primary route) — opened PRE-FILLED from a skill's thin rank: the stimulus
 *     and its preset lens are already set, one tap to run. A quiet tie-back names the rank being
 *     deepened (honesty: the sim REFINES the rank, never contradicts it — same judgment, deeper
 *     resolution).
 *   - `cold` (the ④ "Test something against your audience →" door) — nothing to develop yet, so ⑤
 *     opens on an INTAKE step ("What are you testing?") that collects the stimulus first, then arms.
 *
 * The intake also names the SCREEN vs QUERY fork (domain-scaffold): video / draft = a *screen* (the
 * behavioral lens funnel → full brain/population read → Overview); ask / survey = a *query* (a
 * question to the room → a lighter arm → a results surface); A/B = a *compare* (the core run on 2+
 * stimuli → a comparative overlay). Scope 2026-07-21: the SCREEN path is fully wired; compare + query
 * are present in the intake but deferred ("soon") — their arms/outputs need their own read-templates
 * (the same per-domain-bundle work as pricing).
 *
 * Design laws honored (round-4 grammar):
 *  - The LENS is the one loud dial; everything else is quiet. Custom compiles VISIBLY to the nearest
 *    preset (#2). Scene ≠ provenance ⇒ ONE inline mono projection tag, never a gate (#8).
 *  - De-box: hairline dividers, no nested bordered tiles. Section = mono kicker + human question.
 *    Serif = voice only; the stimulus is content-under-test → stays sans. No coral (nothing lost yet).
 */

import { useEffect, useRef, useState } from "react";
import { TONE } from "./AmbientDetail";
import type { BehaviorLens } from "@/lib/engine/flash/flash-prompts";
import type { AmbientPresentation, SimTier } from "./AmbientOverview";
import { CloseButton, CollectStep, IntakeStep, SHEET_STYLE } from "./SimulateIntake";

// ── view-model ───────────────────────────────────────────────────────────────

export type StimulusKind = "hook" | "video" | "idea" | "draft";

/** How ⑤ was entered — pre-filled from a rank, or cold from the ④ door. */
export type SimEntryMode = "develop" | "cold";

/** The intake doors (cold-start). `family` names the screen/compare/query fork; `status` gates it. */
export type IntakeKind = "video" | "draft" | "ab" | "ask" | "survey";
export interface IntakeOption {
  kind: IntakeKind;
  label: string;
  sub: string;
  family: "screen" | "compare" | "query";
  status: "active" | "soon";
  stimulusKind?: StimulusKind; // what an active pick arms the run with
}

/**
 * WHAT THE CREATOR BROUGHT — the stimulus collected by the cold intake, as opposed to the one
 * a skill generated.
 *
 * Until 2026-07-28 there was no such thing: `cold` mode read `data.stimulus.text` off its
 * CALLER and only swapped the `kind`, so picking "Screen a draft" armed a run against whatever
 * text the host happened to be holding. There was not one `<input>` in the intake to type into.
 *
 * `text` is the single field every consumer can rely on — it is what the ARM screen shows as
 * the thing under test, and for a draft it IS the stimulus the run sends. A video brings a
 * `file` or a `url` beside it (the two ways in, one door) and `text` is then only its NAME:
 * a filename or the link, never something to feed a text run. The two are mutually exclusive
 * by construction — the collect step clears one when the other is set.
 */
export interface BroughtStimulus {
  kind: StimulusKind;
  /** What the ARM screen prints under "testing". For a draft, also the run's actual stimulus. */
  text: string;
  /** Video door, upload path → `/api/analyze` `input_mode: "video_upload"` (Phase 4). */
  file?: File;
  /** Video door, link path → `/api/analyze` `input_mode: "tiktok_url"` (Phase 4). */
  url?: string;
}

/**
 * The run a `develop` entry came out of — the tie-back (the sim DEEPENS that read, never
 * contradicts it).
 *
 * This was `{ band, value, lensLabel }` — "Strong 8/10 · deepening your rank" — until 2026-08-02.
 * The 0/10 it quoted is dead (the engine stopped measuring it, owner call), and it was being
 * printed as a scored chip directly above the spend button, which is the worst place in the
 * product to show a number nothing stands behind. What remains is the honest half: WHERE this
 * came from.
 */
export interface DevelopContext {
  sourceLabel: string; // "Hooks run" — the skill run this card came out of
}

export interface SimLens {
  /** The engine's OWN lens union — imported, never re-declared. These two lived as separate
   *  string unions until 2026-07-28; re-typing them here is how the loud dial and the directive
   *  table it drives are kept from silently drifting apart (a mismatch is now a tsc error, not a
   *  run that quietly scores the wrong behaviour). */
  key: BehaviorLens;
  label: string;
  gloss: string; // "stop scrolling" → "Would they stop scrolling?"
  stage: string; // the funnel stage it reads — "Attention · the first 2 seconds"
}

export interface SimSegment {
  /** The engine archetype this slice reads, or null for "Everyone" (the whole-room run).
   *  `label` is creator-editable, so it names the slice for a human and identifies it to nobody. */
  archetype: string | null;
  label: string;
  share: number; // 0..1 of the calibrated room
}

export interface SimulateData {
  stimulus: { text: string; kind: StimulusKind };
  room: string; // "Your audience"
  provenance: string; // what it was calibrated FROM (fact)
  scene: string; // how they ENCOUNTER this stimulus (choice)
  /** The scenes the ENGINE can simulate — each maps to a real DomainLens. Never a superset:
   *  an option with no frame behind it runs a different simulation than the one it names. */
  sceneOptions: string[];
  fidelity: SimTier;
  lenses: SimLens[];
  defaultLens: number;
  segments: SimSegment[];
  develop?: DevelopContext; // present when entered from a rank (mode "develop")
  intake: IntakeOption[]; // the cold-start doors
}

export interface SimulateConfig {
  lensKey: SimLens["key"];
  custom?: string;
  /**
   * WHAT THE CREATOR BROUGHT — present only on a `cold` run (the ＋ door). Absent on `develop`,
   * where the stimulus is a card already in the thread and the caller resolves it from the id.
   *
   * This field is what makes the door more than a door: it carries the draft / file / link out to
   * the host, which routes it (text → `/api/tools/react`, video → `/api/analyze`). It was
   * deliberately left OFF this object in Phase 2 and added here WITH its consumer — a payload field
   * nobody reads is how the five dials came to be collected and discarded in the first place.
   */
  stimulus?: BroughtStimulus;
  /** The picked slice's ENGINE archetype, or null for the whole room. Sent to the route.
   *  (This was the display LABEL until 2026-07-28 — and every field of this object was
   *  discarded by the caller, so nothing ever caught it.) */
  segment: string | null;
  /** The picked slice's display label — for copy and for the seal's provenance line only. */
  segmentLabel: string;
  n: number;
  scene: string;
  fidelity: SimTier;
}

const TIER_N: Record<SimTier, number> = { flash: 1000, max: 10000 };
const TIER_LABEL: Record<SimTier, string> = { flash: "Flash", max: "Max" };

/** Section headers on this surface: sentence case, 13/500 — the same grammar the board uses.
 *  (No mono, no uppercase, no tracking: see AmbientOverview's `SectionHead` for the why.) */
const HEAD = "rgba(236,231,222,.92)";
/** The stimulus card's ground and the segmented track's — a step above the sheet, below the well. */
const FILL = "#212120";
/** The settings card's ground — the same tone the board's one live card uses. */
const CARD = "#1d1d1c";

/**
 * The v1 fidelity lock, per stimulus — the tier that actually has a live path, and which way it
 * locks is MEASURED, not chosen:
 *   video → Max    there is no Flash video path at all (the react route is text-only), and the
 *                  rail already hardcodes tier "max" for video seals.
 *   text  → Flash  text→Max has no live caller anywhere in the product (only a test fixture, the
 *                  eval-runner and the unmounted legacy content-form), so offering it would ship
 *                  an unexercised engine path. The develop entry locks here too: `fireSim` has
 *                  only ever POSTed the Flash react route, so no variant has ever run Max.
 *
 * It renders as the Model ROW of the settings card, grouped with the dials it belongs beside
 * instead of floating in the footer. The reason line that used to hang under it — "text reads run
 * Flash — Max for text isn't wired yet" — does NOT ship: that is our roadmap, in our words, at the
 * spend moment. A locked row with a lock glyph already says everything a creator can act on.
 */
const FIDELITY_LOCK: Record<"text" | "video", SimTier> = { text: "flash", video: "max" };

/**
 * THE VIDEO LOCK — one line, once, under the settings card (2026-08-02).
 *
 * A brought VIDEO runs `/api/analyze` (`input_mode: video_upload | tiktok_url`), and that route
 * accepts NO lens, NO segment and NO scene: it resolves the audience server-side off the thread pin
 * and reads the whole fold. Those dials cannot reach the engine, so they render LOCKED rather than
 * as live controls that change nothing (the defect this lane exists to remove — ⑤ collected five
 * dials and discarded all five until Phase 1).
 *
 * They used to carry a reason EACH: three sentences of our plumbing stacked down the right edge of
 * the spend screen ("slices are read off a text projection"…). One line replaces all three, and it
 * spends its words on what the creator gets rather than on why our routes are shaped this way.
 * "ten reactors" is `VIDEO_PANEL_N` spelled out — the only place the video arm states its N.
 */
const VIDEO_LOCKNOTE = "A full video read locks its dials — ten reactors watch it end to end.";

/**
 * How many minds a VIDEO read really screens: ten.
 *
 * `TIER_N.max` (10,000) is the TEXT projection's number — `reactPopulation` genuinely scores ~1,000
 * sampled individuals per Flash run, which is why the text variant's headcount is literally true. A
 * video run never calls it: the fold is a 10-reactor panel, and the video adapter's own honesty
 * spine says so in as many words ("N is 10, and it says so" — ambient-v2-video-population.ts §1,
 * which refuses to clone those ten into a thousand). Printing "10,000 minds" over a ten-reactor read
 * would be the exact fabrication this screen exists to stop doing.
 */
const VIDEO_PANEL_N = 10;

/** Deterministic thousands separator (toLocaleString is locale-dependent → SSR/client drift). */
const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Custom questions compile to the nearest behavioral lens (resolved open #2 — shown, not hidden).
const LENS_KEYWORDS: Record<SimLens["key"], string[]> = {
  stop: ["stop", "scroll", "hook", "attention", "grab", "thumb", "first"],
  finish: ["finish", "watch", "through", "retention", "stay", "keep", "complete", "whole", "end"],
  share: ["share", "send", "repost", "viral", "spread", "tag", "dm", "forward"],
  follow: ["follow", "subscribe", "grow", "fan", "audience"],
  buy: ["buy", "purchase", "convert", "link", "shop", "sale", "sell", "checkout", "click"],
};

function compileToLens(text: string, lenses: SimLens[]): number {
  const t = text.toLowerCase();
  for (let i = 0; i < lenses.length; i++) {
    const l = lenses[i];
    if (l && LENS_KEYWORDS[l.key].some((k) => t.includes(k))) return i;
  }
  return 0; // default to stop
}

// ── small primitives ─────────────────────────────────────────────────────────

/** Lightweight de-boxed dropdown (used for segment + fidelity). Closes on outside click / Esc. */
function Dropdown({
  label,
  options,
  onSelect,
  align = "left",
}: {
  label: React.ReactNode;
  options: { key: string; label: React.ReactNode }[];
  onSelect: (key: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-[9px] px-[11px] py-1.5 text-[13px] transition-colors"
        style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.cream }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = TONE.hair)}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          className={`absolute z-10 mt-1.5 min-w-[160px] overflow-hidden rounded-[10px] py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ border: `1px solid ${TONE.border}`, background: "#212120", boxShadow: "0 12px 32px rgba(0,0,0,.4)" }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onSelect(o.key);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors"
              style={{ color: TONE.dim }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = TONE.well;
                e.currentTarget.style.color = TONE.cream;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = TONE.dim;
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── the arm card (the screen path — assembles the run + fires the spend) ───────

/**
 * THE STIMULUS ECHO — what is under test, clamped so it cannot crowd out the dial.
 *
 * Measured 2026-07-29 on a production build, cold/text, at three stimulus lengths: the preamble
 * runs 112px → 153px → 295px for a 42 / 120 / 430-character draft while THE LENS is fixed at
 * 187px. So the "preamble outweighs the lens 1.7:1" finding was never a property of the LAYOUT —
 * it is the stimulus echo growing without a bound, and it reproduces at ~430 characters (1.58:1)
 * and not at all below ~250. A draft can be 2,000 characters (`DRAFT_MAX`), so the unbounded case
 * is reachable, not hypothetical.
 *
 * Clamping is the fix that matches the cause: three lines is enough to identify what you brought —
 * you just typed it — and the full text stays one tap away and always in the DOM. Capping the echo
 * is also what keeps the card inside the rail's 858px on the `develop` entry, where the footer
 * carries the spend button and scrolling it out of view is the worst outcome on this screen.
 */
function StimulusEcho({ kind, text }: { kind: StimulusKind; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Whether it actually overflows is a LAYOUT question, so measure it rather than guessing from a
  // character count (font, width and wrapping all move that threshold). jsdom reports 0 for both,
  // so the toggle simply never appears in tests — the full text is in the DOM either way.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div
      className="mt-4 flex items-start gap-[11px] rounded-[12px] px-3.5 py-[13px]"
      style={{ background: FILL, border: `1px solid ${TONE.border}` }}
    >
      {/* an OBJECT tag — one of the two things still allowed a chip fill on these surfaces (the
          other is an action). It names what the thing under test is. */}
      <span
        className="mt-px flex-none rounded-md px-[7px] py-1 text-[10px] leading-none"
        style={{ background: "#2b2a28", color: TONE.dim }}
      >
        {kind}
      </span>
      <span className="min-w-0 flex-1">
        <span
          ref={ref}
          data-testid="sim-stimulus"
          // The clamp states itself. happy-dom drops `-webkit-line-clamp` and `display:-webkit-box`
          // from inline styles entirely, so a guard reading the style attribute would assert
          // nothing at all — and would pass just as happily with the clamp deleted.
          data-clamp={expanded ? "off" : "3"}
          className="block text-[14px] leading-[1.45]"
          style={{
            color: TONE.cream,
            ...(expanded
              ? {}
              : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }),
          }}
        >
          {text}
        </span>
        {clamped ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-[12px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * A dial that cannot reach the engine, rendered as the fact it is.
 *
 * Still a ROW in the same card as the live dials, still carrying the lock glyph — a control that
 * silently does nothing, or one that quietly disappears between variants, both read as bugs. What
 * it no longer carries is its own reason: those collapsed into ONE line under the card
 * (`VIDEO_LOCKNOTE`), because three of them stacked was the screen explaining our routing.
 *
 * No pill, no border: an unfixable value is not a control, and dressing it as one is what made the
 * old locked chips look tappable.
 */
function LockedValue({
  value,
  testId = "sim-locked",
  tier,
}: {
  value: string;
  testId?: string;
  tier?: SimTier;
}) {
  return (
    <span
      data-testid={testId}
      data-tier={tier}
      className="inline-flex flex-none items-center gap-1.5 py-1.5 text-[13px]"
      style={{ color: TONE.dim }}
    >
      {value}
      <LockGlyph />
    </span>
  );
}

/** One row of the settings card — label left, control right, hairline between. The Model row is one
 *  of these too: the locked tier belongs beside the dials it constrains, not adrift in the footer. */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3.5 py-[11px] first:border-t-0"
      style={{ borderTop: `1px solid ${TONE.border}` }}
    >
      <span className="flex-none text-[13px]" style={{ color: TONE.dim }}>
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Exported for `/dev/cards` ONLY — the app always reaches this through `AmbientSimulate`.
 *
 * The three ARM variants differ by props the gateway holds as internal state (`brought`, set by
 * the collect step), so a gallery driving `AmbientSimulate` can reach variant ① and nothing else:
 * ② and ③ are only reachable by typing into the intake. Exporting the card lets the gallery mount
 * each variant at its real geometry with real props — no seam added to the shipped path, and no
 * `initialBrought`-style prop that would exist purely for the gallery and drift from it.
 */
export function ArmCard({
  data,
  stimulus,
  brought,
  develop,
  onClose,
  onBack,
  onSimulate,
  connected,
  presentation = "rail",
}: {
  data: SimulateData;
  stimulus: { text: string; kind: StimulusKind };
  /** What the creator brought (cold only) — travels out on the config so the host can route it. */
  brought?: BroughtStimulus;
  develop?: DevelopContext;
  onClose?: () => void;
  onBack?: () => void;
  onSimulate?: (config: SimulateConfig) => void;
  /** Rail mode — render as a CONNECTED panel (fills, #181817, no card shadow/rounding), not a sheet. */
  connected?: boolean;
  /** With `connected`: `rail` (own ground + left hairline + 440 cap) vs `sheet` (host owns them). */
  presentation?: AmbientPresentation;
}) {
  const { provenance, lenses, segments } = data;
  const inSheet = connected && presentation === "sheet";
  const [lensIdx, setLensIdx] = useState(data.defaultLens);
  const [custom, setCustom] = useState("");
  // The custom question is ONE TAP away, not a permanent full-width input. It was a standing box
  // under the segmented control — a second, competing way to answer a question the control above
  // it had already answered, on the screen that spends the credit.
  const [askOpen, setAskOpen] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [scene, setScene] = useState(data.scene);

  const isVideo = stimulus.kind === "video";
  const fidelity = FIDELITY_LOCK[isVideo ? "video" : "text"];

  // custom text overrides the chip selection, compiling to the nearest lens (shown to the user)
  const compiledIdx = custom.trim() ? compileToLens(custom, lenses) : lensIdx;
  const activeLens = lenses[compiledIdx] ?? lenses[0];
  // A video read has no slice to pick, so it is always the whole room — segments[0] by construction
  // ("Everyone", archetype null), never whatever the creator last selected on a text run.
  const seg = (isVideo ? segments[0] : segments[segIdx]) ?? segments[0];
  if (!activeLens || !seg) return null; // degenerate fixture (no lenses/segments) — nothing to arm
  const n = isVideo ? VIDEO_PANEL_N : Math.round(TIER_N[fidelity] * seg.share);
  const mismatch = !isVideo && scene.toLowerCase() !== provenance.toLowerCase();

  return (
    <div
      data-testid="ambient-simulate"
      data-phase="arm"
      data-presentation={connected ? presentation : undefined}
      className={
        inSheet
          ? "flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
          : connected
            ? "flex h-full w-full max-w-[440px] flex-col overflow-y-auto"
            : "flex w-full max-w-[460px] flex-col rounded-[16px]"
      }
      style={
        inSheet
          ? { color: TONE.cream, fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }
          : connected
            ? {
                background: "#181817",
                borderLeft: `1px solid ${TONE.border}`,
                color: TONE.cream,
                fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
              }
            : SHEET_STYLE
      }
    >
      {/* THE HEADER — one act, named once. "Arm a simulation" was our word for it; this is the
          creator's. The back arrow is a bare ‹ with a label for anything that reads the DOM: the
          text it used to carry ("‹ Arm a simulation") repeated the title beside it. */}
      <div className="flex items-center gap-2 px-[26px] pt-[22px]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 flex-none pr-1 text-[14px] leading-none transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            ‹
          </button>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
          Test against your audience
        </span>
        <CloseButton onClose={onClose} />
      </div>

      {/* WHAT — the stimulus under test: content, so it reads at full strength (but bounded) */}
      <div className="px-[26px]">
        <StimulusEcho kind={stimulus.kind} text={stimulus.text} />
      </div>

      {/* The tie-back: WHERE this came from. It was a scored chip — "Strong 8/10 · deepening your
          rank" — and the score behind it is dead (see DevelopContext). One faint line of real
          provenance, directly under the thing it describes. */}
      {develop ? (
        <div className="mt-[9px] px-[26px] text-[12px]" style={{ color: TONE.faint }}>
          From your {develop.sourceLabel} — this deepens that read
        </div>
      ) : null}

      {/* THE QUESTION — the one loud dial: the single behaviour we score the room for.
          Called "The lens" until 2026-08-02, which is the name of our mechanism; "The question" is
          what the creator is actually setting. On a VIDEO it is not a dial at all (the Max fold
          measures every behaviour and the route takes no lens), so the section states that fact in
          one line rather than rendering a control that would change nothing. */}
      <div className="mt-7 px-[26px]">
        <div className="text-[13px] font-medium" style={{ color: HEAD }}>
          The question
        </div>

        {isVideo ? (
          <div className="mt-3 text-[13px]" style={{ color: TONE.cream }}>
            Every behaviour, scored at once{" "}
            <span style={{ color: TONE.faint }}>— the whole curve, not one dial</span>
          </div>
        ) : (
          <>
            {/* the behavioural funnel as a segmented control (Stop → Finish → Share → Follow → Buy) */}
            <div
              className="mt-3 flex gap-[3px] rounded-[11px] p-[3px]"
              style={{ border: `1px solid ${TONE.border}`, background: FILL }}
            >
              {lenses.map((l, i) => {
                const on = i === compiledIdx;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => {
                      setCustom("");
                      setLensIdx(i);
                    }}
                    className="flex-1 rounded-[8px] py-[7px] text-[13px] transition-colors"
                    style={{
                      background: on ? TONE.cream : "transparent",
                      color: on ? "#1c1b19" : TONE.dim,
                      fontWeight: on ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!on) e.currentTarget.style.color = TONE.cream;
                    }}
                    onMouseLeave={(e) => {
                      if (!on) e.currentTarget.style.color = TONE.dim;
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>

            {/* ONE line: the question, then what it looks at. It was two — the question at 15px and
                the funnel stage under it ("Attention — the thumb-stop in the first 2 seconds"),
                which spent a whole row naming our model of their video. */}
            <div className="mt-[13px] text-[13px]" style={{ color: TONE.cream }}>
              Would they {activeLens.gloss}?{" "}
              <span style={{ color: TONE.faint }}>— {activeLens.stage}</span>
            </div>

            {/* the custom question — one tap away, and it still compiles VISIBLY to the nearest
                behaviour (the creator is never scored against something they can't see) */}
            {askOpen ? (
              <>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  autoFocus
                  aria-label="Ask your own question"
                  placeholder="Type it — we score the nearest behaviour"
                  className="mt-2.5 w-full rounded-[10px] px-[13px] py-2.5 text-[13px] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.38)]"
                  style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19", color: TONE.cream }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = TONE.border)}
                />
                {custom.trim() ? (
                  <div className="mt-2 text-[12px]" style={{ color: TONE.faint }}>
                    ↳ scored as the nearest behaviour ·{" "}
                    <span style={{ color: TONE.dim }}>would {activeLens.label.toLowerCase()}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAskOpen(true)}
                className="mt-[9px] block text-[12px] transition-colors"
                style={{ color: TONE.faint }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
              >
                or ask your own question
              </button>
            )}
          </>
        )}
      </div>

      {/* THE SETTINGS — every dial the run uses, in one card, locked ones included.
          These were three separate full-width bands ("The slice" with its own headcount + share
          bar, an "in {room} · as" conditions line, and the fidelity chip stranded in the footer
          beside the spend button). Three bands for three dropdowns is a form pretending to be a
          dashboard; one card with a row each is the same information in a quarter of the height,
          and it puts the LOCKED tier where a creator looks for it — beside the dials it
          constrains, not floating under the button. */}
      <div
        className="mx-[26px] mt-[26px] overflow-hidden rounded-[12px]"
        style={{ background: CARD, border: `1px solid ${TONE.border}` }}
      >
        <SettingRow label="Audience">
          {isVideo ? (
            <LockedValue value="The whole room" />
          ) : (
            <Dropdown
              // The slice AND its headcount, in the control itself. The arithmetic used to be a
              // 15px number on its own line under a "Who are we asking?" question that the label
              // above it had already asked.
              label={`${seg.label} · ${withCommas(n)} minds`}
              align="right"
              options={segments.map((s, i) => ({
                key: String(i),
                label: (
                  <span className="flex w-full items-center justify-between gap-6">
                    <span>{s.label}</span>
                    <span style={{ color: TONE.faint }}>{withCommas(Math.round(TIER_N[fidelity] * s.share))}</span>
                  </span>
                ),
              }))}
              onSelect={(k) => setSegIdx(Number(k))}
            />
          )}
        </SettingRow>

        <SettingRow label="Platform">
          {/* Only scenes the engine can actually simulate (data.sceneOptions). This used to splice
              in a hardcoded "Instagram" plus the audience's provenance — neither of which has a
              reaction frame behind it, so picking either ran the TikTok simulation under a
              different name. A VIDEO run reaches `/api/analyze`, which takes no scene at all. */}
          {isVideo ? (
            <LockedValue value={scene} />
          ) : (
            <Dropdown
              label={scene}
              align="right"
              options={data.sceneOptions.map((s) => ({ key: s, label: s }))}
              onSelect={setScene}
            />
          )}
        </SettingRow>

        <SettingRow label="Model">
          <LockedValue value={`SIM-1 ${TIER_LABEL[fidelity]}`} testId="sim-fidelity-locked" tier={fidelity} />
        </SettingRow>
      </div>

      {/* AT MOST ONE line under the card. A video says why its dials are fixed; a text run says
          nothing unless the scene it will be read in differs from the room's calibration — which
          is a real fact about the answer, so it survives, in words instead of a mono tag. */}
      {isVideo ? (
        <div className="mt-[9px] px-[26px] text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          {VIDEO_LOCKNOTE}
        </div>
      ) : mismatch ? (
        <div className="mt-[9px] px-[26px] text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          Modeled on {scene} — your audience is {provenance}-calibrated.
        </div>
      ) : null}

      {/* GO — the spend moment: the wait, then the one button.
          THE WAIT is the one fact here that is not already on the screen. This line used to be an
          "assembling receipt" ("Screening 1,000 of General for 'would they stop' · on TikTok ·
          SIM-1 Flash"): measured 2026-07-29, all five of those facts appear above it, and the
          receipt cost 145–161px — 16–20% of the card — restating the form it sat under. How long
          the creator is about to wait is what the screen never said, and it is the thing that
          actually differs between the two paths a Simulate ↑ can start.

          The button is FULL WIDTH now. It shared a row with the locked fidelity chip, which put a
          disabled-looking control beside the only action on the screen and made the primary act
          look like one of two choices. The tier moved into the settings card where it belongs. */}
      <div className="mt-6 border-t px-[26px] pb-5 pt-[15px]" style={{ borderColor: TONE.border }}>
        <div className="text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          {isVideo
            ? "Takes 1–3 minutes — it lands on your board when it’s done."
            : "Reads in a few seconds."}
        </div>
        <button
          type="button"
          onClick={() =>
            onSimulate?.({
              lensKey: activeLens.key,
              custom: custom.trim() || undefined,
              segment: seg.archetype,
              segmentLabel: seg.label,
              n,
              scene,
              fidelity,
              // The brought stimulus rides the config — this is the field that turns the ＋ door
              // from a door into a run. Absent on `develop` (the caller resolves that from the id).
              ...(brought ? { stimulus: brought } : {}),
            })
          }
          className="mt-[11px] w-full rounded-[10px] py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: TONE.cream, color: "#1c1b19" }}
        >
          Simulate <span aria-hidden>↑</span>
        </button>
      </div>
    </div>
  );
}

// ── the gateway ────────────────────────────────────────────────────────────────

export function AmbientSimulate({
  data,
  mode = "develop",
  onClose,
  onSimulate,
  connected,
  presentation = "rail",
}: {
  data: SimulateData;
  mode?: SimEntryMode;
  onClose?: () => void;
  onSimulate?: (config: SimulateConfig) => void;
  /** Rail mode — render the arm card as a CONNECTED panel, not a floating sheet. */
  connected?: boolean;
  /** With `connected`: `rail` (own ground + left hairline + 440 cap) vs `sheet` (host owns them). */
  presentation?: AmbientPresentation;
}) {
  // COLD is now THREE steps, not two: pick a door → bring the thing → arm it.
  //
  // The middle one is new (2026-07-28). Cold used to jump from the door straight to the arm card
  // and take its stimulus from `data.stimulus.text` — the CALLER's text, with only the `kind`
  // swapped to the door's. So "Screen a draft" armed a run against whatever the host happened to
  // be holding, and there was no way to bring anything of your own. `brought` is what the creator
  // actually typed/dropped/pasted, and on the cold path it is the ONLY source of the stimulus.
  const [picked, setPicked] = useState<IntakeOption | null>(null);
  const [brought, setBrought] = useState<BroughtStimulus | null>(null);

  if (mode === "cold" && !picked) {
    return <IntakeStep data={data} onClose={onClose} onPick={setPicked} />;
  }

  if (mode === "cold" && picked && !brought) {
    return (
      <CollectStep
        data={data}
        opt={picked}
        onClose={onClose}
        // Back to the doors clears what was collected under the OLD door — a link pasted for
        // "Test a real video" is not a draft, and carrying it across would arm the wrong thing.
        onBack={() => {
          setBrought(null);
          setPicked(null);
        }}
        onCollect={setBrought}
      />
    );
  }

  // The stimulus: what the creator BROUGHT (cold), or the pre-filled rank (develop). Cold never
  // falls back to `data.stimulus` — reaching the arm card cold without a brought stimulus is not
  // a state this component can produce, and silently showing the caller's text would be the exact
  // bug this step exists to remove.
  const stimulus = brought ?? data.stimulus;

  return (
    <ArmCard
      data={data}
      stimulus={stimulus}
      // Only a COLD entry has a brought stimulus to route; `develop` deliberately passes none, so
      // its config keeps the exact shape its caller has always received.
      brought={brought ?? undefined}
      develop={mode === "develop" ? data.develop : undefined}
      onClose={onClose}
      // Cold: back to the COLLECT step (keep the door), so a creator fixing a typo in their draft
      // does not get sent all the way out to "What are you testing?".
      onBack={mode === "cold" ? () => setBrought(null) : undefined}
      onSimulate={onSimulate}
      connected={connected}
      presentation={presentation}
    />
  );
}
