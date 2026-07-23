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
import type { SimTier } from "./AmbientOverview";
import { CloseButton, IntakeStep, Kick, SHEET_STYLE } from "./SimulateIntake";

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

/** The rank a `develop` entry is deepening — the tie-back (sim refines this, never contradicts it). */
export interface DevelopContext {
  band: string; // "Strong"
  value: string; // "8/10"
  lensLabel: string; // "stopped" — what the rank measured
}

export interface SimLens {
  key: "stop" | "finish" | "share" | "follow" | "buy";
  label: string;
  gloss: string; // "stop scrolling" → "Would they stop scrolling?"
  stage: string; // the funnel stage it reads — "Attention · the first 2 seconds"
}

export interface SimSegment {
  label: string;
  share: number; // 0..1 of the calibrated room
}

export interface SimulateData {
  stimulus: { text: string; kind: StimulusKind };
  room: string; // "Your audience"
  provenance: string; // what it was calibrated FROM (fact)
  scene: string; // how they ENCOUNTER this stimulus (choice)
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
  segment: string;
  n: number;
  scene: string;
  fidelity: SimTier;
}

const TIER_N: Record<SimTier, number> = { flash: 1000, max: 10000 };
const TIER_LABEL: Record<SimTier, string> = { flash: "Flash", max: "Max" };

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

function ArmCard({
  data,
  stimulus,
  develop,
  onClose,
  onBack,
  onSimulate,
  connected,
}: {
  data: SimulateData;
  stimulus: { text: string; kind: StimulusKind };
  develop?: DevelopContext;
  onClose?: () => void;
  onBack?: () => void;
  onSimulate?: (config: SimulateConfig) => void;
  /** Rail mode — render as a CONNECTED panel (fills, #181817, no card shadow/rounding), not a sheet. */
  connected?: boolean;
}) {
  const { room, provenance, lenses, segments } = data;
  const [lensIdx, setLensIdx] = useState(data.defaultLens);
  const [custom, setCustom] = useState("");
  const [segIdx, setSegIdx] = useState(0);
  const [fidelity, setFidelity] = useState<SimTier>(data.fidelity);
  const [scene, setScene] = useState(data.scene);

  // custom text overrides the chip selection, compiling to the nearest lens (shown to the user)
  const compiledIdx = custom.trim() ? compileToLens(custom, lenses) : lensIdx;
  const activeLens = lenses[compiledIdx] ?? lenses[0];
  const seg = segments[segIdx] ?? segments[0];
  if (!activeLens || !seg) return null; // degenerate fixture (no lenses/segments) — nothing to arm
  const n = Math.round(TIER_N[fidelity] * seg.share);
  const mismatch = scene.toLowerCase() !== provenance.toLowerCase();

  return (
    <div
      data-testid="ambient-simulate"
      data-phase="arm"
      className={
        connected
          ? "flex h-full w-full max-w-[440px] flex-col overflow-y-auto"
          : "flex w-full max-w-[460px] flex-col rounded-[16px]"
      }
      style={
        connected
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
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.05em]"
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

      {/* THE LENS — the one loud dial: the single behaviour we score the room for */}
      <div className="mt-7 px-[26px]">
        <div className="flex items-baseline justify-between">
          <Kick>The lens</Kick>
          <span className="text-[11.5px]" style={{ color: TONE.faint }}>
            the behaviour we score
          </span>
        </div>

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
          <div className="mt-1 text-[12.5px]" style={{ color: TONE.faint }}>
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
          <div className="mt-2 font-mono text-[11.5px]" style={{ color: TONE.faint }}>
            ↳ scored as the nearest lens · <span style={{ color: TONE.dim }}>would {activeLens.label.toLowerCase()}</span>
          </div>
        ) : null}
      </div>

      {/* THE SLICE — who in the room we screen, and how many minds that is */}
      <div className="mt-7 px-[26px]">
        <div className="flex items-baseline justify-between">
          <Kick>The slice</Kick>
          <span className="text-[11.5px]" style={{ color: TONE.faint }}>
            who we put it in front of
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
            Who are we asking?
          </span>
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
        </div>
        {/* headcount + how much of the room it is, with a slim share bar */}
        <div className="mt-3 flex items-baseline gap-2 text-[13px]" style={{ color: TONE.faint }}>
          <span className="tabular-nums text-[15px] font-medium" style={{ color: TONE.cream }}>
            {withCommas(n)}
          </span>
          <span>
            minds ·{" "}
            {seg.share < 1
              ? `the ${seg.label.toLowerCase()} slice · ${Math.round(seg.share * 100)}% of the room`
              : "the whole room"}
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
          <Dropdown
            label={scene}
            align="right"
            options={[provenance, "Instagram", "No feed"].filter((v, i, a) => a.indexOf(v) === i).map((s) => ({ key: s, label: s }))}
            onSelect={setScene}
          />
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
          <span style={{ color: TONE.dim }}>“would they {activeLens.label.toLowerCase()}”</span> · on{" "}
          <span style={{ color: TONE.dim }}>{scene}</span> · SIM-1 {TIER_LABEL[fidelity]}
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              onSimulate?.({
                lensKey: activeLens.key,
                custom: custom.trim() || undefined,
                segment: seg.label,
                n,
                scene,
                fidelity,
              })
            }
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium transition-transform hover:scale-[1.02]"
            style={{ background: TONE.cream, color: "#1c1b19" }}
          >
            Simulate <span aria-hidden>↑</span>
          </button>
          <Dropdown
            label={`SIM-1 ${TIER_LABEL[fidelity]}`}
            align="right"
            options={(["flash", "max"] as SimTier[]).map((t) => ({
              key: t,
              label: (
                <span className="flex w-full items-center justify-between gap-6">
                  <span>SIM-1 {TIER_LABEL[t]}</span>
                  <span style={{ color: TONE.faint }}>{withCommas(TIER_N[t])}</span>
                </span>
              ),
            }))}
            onSelect={(k) => setFidelity(k as SimTier)}
          />
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
}: {
  data: SimulateData;
  mode?: SimEntryMode;
  onClose?: () => void;
  onSimulate?: (config: SimulateConfig) => void;
  /** Rail mode — render the arm card as a CONNECTED panel, not a floating sheet. */
  connected?: boolean;
}) {
  // cold entry lands on the intake step; develop entry is pre-filled → straight to the arm card.
  const [picked, setPicked] = useState<IntakeOption | null>(null);
  const onIntake = mode === "cold" && !picked;

  if (onIntake) {
    return <IntakeStep data={data} onClose={onClose} onPick={setPicked} />;
  }

  // the stimulus: from the picked intake door (cold) or the pre-filled data (develop).
  const stimulus = picked?.stimulusKind ? { text: data.stimulus.text, kind: picked.stimulusKind } : data.stimulus;

  return (
    <ArmCard
      data={data}
      stimulus={stimulus}
      develop={mode === "develop" ? data.develop : undefined}
      onClose={onClose}
      onBack={mode === "cold" ? () => setPicked(null) : undefined}
      onSimulate={onSimulate}
      connected={connected}
    />
  );
}
