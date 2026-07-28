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
import { CloseButton, CollectStep, IntakeStep, Kick, SHEET_STYLE } from "./SimulateIntake";

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

/** The rank a `develop` entry is deepening — the tie-back (sim refines this, never contradicts it). */
export interface DevelopContext {
  band: string; // "Strong"
  value: string; // "8/10"
  lensLabel: string; // "stopped" — what the rank measured
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

/** The v1 fidelity lock, per stimulus — the tier that actually has a live path, and why. */
const FIDELITY_LOCK: Record<"text" | "video", { tier: SimTier; reason: string }> = {
  text: { tier: "flash", reason: "text reads run Flash — Max for text isn’t wired yet" },
  video: { tier: "max", reason: "video reads run Max — there is no Flash video path" },
};

/**
 * THE VIDEO LOCKS — measured against the route, not chosen (2026-07-28, Phase 4).
 *
 * A brought VIDEO runs `/api/analyze` (`input_mode: video_upload | tiktok_url`), and that route
 * accepts NO lens, NO segment and NO scene: it resolves the audience server-side off the thread pin
 * and reads the whole fold. So on the video variant those three dials cannot reach the engine at
 * all — and a live dropdown that changes nothing is exactly the defect this lane exists to remove
 * (⑤ collected five dials and discarded all five until Phase 1). They render LOCKED with the
 * reason, the same treatment fidelity already gets. The text variant is untouched: every one of
 * these IS honoured by `/api/tools/react`.
 */
const VIDEO_LOCK = {
  lens: "a full video read scores every behaviour at once — the whole curve, not one dial",
  slice: "a video read is scored by the whole room; slices are read off a text projection",
  scene: "a video is read in the feed it was made for — the scene isn’t a dial here",
} as const;

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
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] transition-colors"
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

/** A dial that cannot reach the engine, rendered as the fact it is: the value, then WHY it is fixed.
 *  Same treatment the fidelity chip already gets — a control that silently does nothing, or one that
 *  quietly disappears between variants, both read as bugs. */
function Locked({ value, reason }: { value: string; reason: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        data-testid="sim-locked"
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px]"
        style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.dim }}
      >
        {value}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
          <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </span>
      <span className="max-w-[260px] text-right text-[11px]" style={{ color: TONE.faint }}>
        {reason}
      </span>
    </div>
  );
}

function ArmCard({
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
  const { room, provenance, lenses, segments } = data;
  const inSheet = connected && presentation === "sheet";
  const [lensIdx, setLensIdx] = useState(data.defaultLens);
  const [custom, setCustom] = useState("");
  const [segIdx, setSegIdx] = useState(0);
  const [scene, setScene] = useState(data.scene);

  // FIDELITY IS LOCKED IN v1, and which way it locks is measured, not chosen:
  //   video → Max   there is no Flash video path at all (the react route is text-only), and the
  //                 rail already hardcodes tier "max" for video seals.
  //   text  → Flash text→Max has no live caller anywhere in the product (only a test fixture,
  //                 eval-runner, and the unmounted legacy content-form), so offering it would
  //                 ship an unexercised engine path. The develop entry locks here too: `fireSim`
  //                 has only ever POSTed the Flash react route, so no variant has ever run Max.
  // Rendered as a locked chip WITH its reason — a dial that silently does nothing, or one that
  // quietly disappears between variants, both read as bugs.
  const isVideo = stimulus.kind === "video";
  const lock = FIDELITY_LOCK[isVideo ? "video" : "text"];
  const fidelity = lock.tier;

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
      {/* header + the stimulus under test */}
      <div className="px-[26px] pt-[24px]">
        <div className="flex items-start justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex items-center gap-1 text-[12px] font-mono uppercase tracking-[0.08em] transition-colors"
              style={{ color: TONE.faint }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
            >
              ‹ Arm a simulation
            </button>
          ) : (
            <Kick>Arm a simulation</Kick>
          )}
          <CloseButton onClose={onClose} />
        </div>

        {/* develop tie-back — the rank this sim is deepening (refines, never contradicts) */}
        {develop ? (
          <div
            className="mt-3.5 inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[12px]"
            style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${TONE.hair}`, color: TONE.faint }}
          >
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em]"
              style={{ background: TONE.well, color: TONE.dim }}
            >
              {develop.band} {develop.value}
            </span>
            <span>
              deepening your rank — refines it, never overturns it
            </span>
          </div>
        ) : null}

        {/* the stimulus under test — content, so it reads at full strength */}
        <div
          className="mt-3.5 flex items-start gap-3 rounded-[12px] p-3.5"
          style={{ background: TONE.well, border: `1px solid ${TONE.border}` }}
        >
          <span
            className="mt-[1px] flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]"
            style={{ background: "rgba(255,255,255,.06)", color: TONE.faint }}
          >
            {stimulus.kind}
          </span>
          <span className="text-[14px] leading-[1.45]" style={{ color: TONE.cream }}>
            {stimulus.text}
          </span>
        </div>
      </div>

      {/* THE LENS — the one loud dial: the single behaviour we score the room for.
          On a VIDEO it is not a dial at all (the Max fold measures every behaviour and the route
          takes no lens), so the band stays — same layout, same place — carrying the locked fact
          instead of a control that would change nothing. */}
      <div className="mt-7 px-[26px]">
        <div className="flex items-baseline justify-between">
          <Kick>The lens</Kick>
          <span className="text-[12px]" style={{ color: TONE.faint }}>
            the behaviour we score
          </span>
        </div>

        {isVideo ? (
          <div className="mt-3 flex items-start justify-between gap-4">
            <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
              Every behaviour
            </span>
            <Locked value="Whole curve" reason={VIDEO_LOCK.lens} />
          </div>
        ) : (
          <>
        {/* the behavioural funnel as a segmented control (Stop → Finish → Share → Follow → Buy) */}
        <div
          className="mt-3 flex gap-1 rounded-[11px] p-1"
          style={{ border: `1px solid ${TONE.border}`, background: TONE.well }}
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
                className="flex-1 rounded-[8px] py-1.5 text-[13px] transition-colors"
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

        {/* the active lens, spelled out — the measured question + its funnel stage */}
        <div className="mt-3.5">
          <div className="text-[15px] font-medium" style={{ color: TONE.cream }}>
            Would they {activeLens.gloss}?
          </div>
          <div className="mt-1 text-[12px]" style={{ color: TONE.faint }}>
            {activeLens.stage}
          </div>
        </div>

        {/* custom question — compiles VISIBLY to the nearest behavioural lens */}
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="or ask your own question…"
          className="mt-3.5 w-full rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.38)]"
          style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19", color: TONE.cream }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = TONE.border)}
        />
        {custom.trim() ? (
          <div className="mt-2 font-mono text-[12px]" style={{ color: TONE.faint }}>
            ↳ scored as the nearest lens · <span style={{ color: TONE.dim }}>would {activeLens.label.toLowerCase()}</span>
          </div>
        ) : null}
          </>
        )}
      </div>

      {/* THE SLICE — who in the room we screen, and how many minds that is */}
      <div className="mt-7 px-[26px]">
        <div className="flex items-baseline justify-between">
          <Kick>The slice</Kick>
          <span className="text-[12px]" style={{ color: TONE.faint }}>
            who we put it in front of
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
            Who are we asking?
          </span>
          {isVideo ? (
            <Locked value="The whole room" reason={VIDEO_LOCK.slice} />
          ) : (
            <Dropdown
              label={seg.label}
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
        </div>
        {/* headcount + how much of the room it is, with a slim share bar */}
        <div className="mt-3 flex items-baseline gap-2 text-[13px]" style={{ color: TONE.faint }}>
          <span className="tabular-nums text-[15px] font-medium" style={{ color: TONE.cream }}>
            {withCommas(n)}
          </span>
          <span>
            {isVideo ? (
              // Ten REACTORS, not ten "minds out of a thousand": the video fold is a 10-archetype
              // panel watching it end to end. Saying so is the whole point of VIDEO_PANEL_N.
              <>reactors · the whole room, watching it end to end</>
            ) : seg.share < 1 ? (
              `minds · the ${seg.label.toLowerCase()} slice · ${Math.round(seg.share * 100)}% of the room`
            ) : (
              "minds · the whole room"
            )}
          </span>
        </div>
        <div className="relative mt-2.5 h-[3px] overflow-hidden rounded-full" style={{ background: TONE.ghost }}>
          <span
            className="absolute inset-0 block origin-left rounded-full transition-transform"
            style={{ transform: `scaleX(${seg.share})`, background: "rgba(236,231,222,.5)" }}
          />
        </div>
      </div>

      {/* inherited thread context — quiet receipt, tap-to-override scene; projection tag if it drifts */}
      <div className="mt-7 px-[26px]">
        <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: TONE.border }}>
          <span className="text-[13px]" style={{ color: TONE.faint }}>
            in <span style={{ color: TONE.dim }}>{room}</span> · as
          </span>
          {/* Only scenes the engine can actually simulate (data.sceneOptions). This used to splice
              in a hardcoded "Instagram" plus the audience's provenance — neither of which has a
              reaction frame behind it, so picking either ran the TikTok simulation under a
              different name. Provenance is still shown, as the FACT it is, by the mismatch tag.
              A VIDEO run reaches `/api/analyze`, which takes no scene at all — locked, with why. */}
          {isVideo ? (
            <Locked value={scene} reason={VIDEO_LOCK.scene} />
          ) : (
            <Dropdown
              label={scene}
              align="right"
              options={data.sceneOptions.map((s) => ({ key: s, label: s }))}
              onSelect={setScene}
            />
          )}
        </div>
        {mismatch ? (
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: TONE.faint }}>
            modeled · {scene} scene, {provenance}-calibrated
          </div>
        ) : null}
      </div>

      {/* footer — the spend moment: the assembling receipt + arm + fidelity override */}
      <div className="mt-7 border-t px-[26px] py-[18px]" style={{ borderColor: TONE.border }}>
        <div className="text-[12px] leading-[1.6]" style={{ color: TONE.faint }}>
          Screening{" "}
          <span className="tabular-nums" style={{ color: TONE.dim }}>{withCommas(n)}</span> of{" "}
          <span style={{ color: TONE.dim }}>{room}</span> for{" "}
          {isVideo ? (
            // The video receipt cannot claim one behaviour — the fold measures all of them.
            <span style={{ color: TONE.dim }}>every behaviour</span>
          ) : (
            <span style={{ color: TONE.dim }}>“would they {activeLens.label.toLowerCase()}”</span>
          )}{" "}
          · on <span style={{ color: TONE.dim }}>{scene}</span> · SIM-1 {TIER_LABEL[fidelity]}
        </div>
        <div className="mt-3.5 flex items-center justify-between">
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
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium transition-transform hover:scale-[1.02]"
            style={{ background: TONE.cream, color: "#1c1b19" }}
          >
            Simulate <span aria-hidden>↑</span>
          </button>
          {/* LOCKED, not hidden — the reason rides with it (see FIDELITY_LOCK). */}
          <div className="flex flex-col items-end gap-1">
            <span
              data-testid="sim-fidelity-locked"
              data-tier={fidelity}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px]"
              style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.dim }}
            >
              SIM-1 {TIER_LABEL[fidelity]}
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
                <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </span>
            <span className="text-right text-[11px]" style={{ color: TONE.faint }}>
              {lock.reason}
            </span>
          </div>
        </div>
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
