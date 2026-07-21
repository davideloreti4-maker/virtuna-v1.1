"use client";

/**
 * AmbientSimulate — Ambient Audience v2, surface ⑤ "the simulate sheet" (the run picker).
 *
 * Not a form — an instrument you ARM. The L4 Run shelf (lens · segment · stimulus) sits over the
 * inherited Thread context (room · scene · fidelity), and the choices assemble into a receipt
 * sentence you read back before the run fires. Reached from a ④ ACTIONS preset, a chat `Screen ▾`,
 * or a skill-card one-tap; on Simulate it hands off to the Overview watching-in-place state.
 *
 * Design laws honored (round-4 grammar):
 *  - The LENS is the one loud dial (the funnel of observable decisions); everything else is quiet.
 *  - Custom question compiles VISIBLY to the nearest preset (resolved open #2).
 *  - Scene ≠ provenance ⇒ ONE inline mono projection tag, never a gate (resolved open #8).
 *  - De-box: hairline dividers between sections, no nested bordered tiles.
 *  - Section = mono kicker + human question. Serif is reserved for voice — the stimulus is
 *    content-under-test, so it stays sans (quiet), never serif.
 *  - No coral: nothing is lost yet — this is the arming step, before any verdict.
 */

import { useEffect, useRef, useState } from "react";
import { TONE } from "./AmbientDetail";
import type { SimTier } from "./AmbientOverview";

// ── view-model ───────────────────────────────────────────────────────────────

export type StimulusKind = "hook" | "video" | "idea" | "draft";

export interface SimLens {
  key: "stop" | "finish" | "share" | "follow" | "buy";
  label: string;
  gloss: string; // "stop scrolling"
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

function Kick({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: TONE.faint }}>
      {children}
    </div>
  );
}

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
        <span style={{ color: TONE.faint }}>▾</span>
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

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientSimulate({
  data,
  onClose,
  onSimulate,
}: {
  data: SimulateData;
  onClose?: () => void;
  onSimulate?: (config: SimulateConfig) => void;
}) {
  const { stimulus, room, provenance, lenses, segments } = data;
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

  const receipt = `Screen to ${withCommas(n)} of ${room} · would they ${activeLens.label.toLowerCase()} · on ${scene} · SIM-1 ${TIER_LABEL[fidelity]}`;

  return (
    <div
      data-testid="ambient-simulate"
      className="flex w-full max-w-[460px] flex-col rounded-[16px]"
      style={{
        background: "#1f1f1e",
        border: `1px solid ${TONE.border}`,
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        boxShadow: "0 24px 64px rgba(0,0,0,.45)",
      }}
    >
      {/* header + the stimulus under test */}
      <div className="px-[26px] pt-[24px]">
        <div className="flex items-start justify-between">
          <Kick>Arm a simulation</Kick>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            ✕
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-[12px] p-3.5" style={{ background: TONE.well }}>
          <span
            className="mt-px flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]"
            style={{ background: "rgba(255,255,255,.05)", color: TONE.faint }}
          >
            {stimulus.kind}
          </span>
          <span className="text-[14px] leading-[1.4]" style={{ color: TONE.dim }}>
            {stimulus.text}
          </span>
        </div>
      </div>

      {/* THE LENS — the one loud dial */}
      <div className="mt-6 px-[26px]">
        <Kick>The lens</Kick>
        <div className="mt-1.5 text-[15px] font-medium" style={{ color: TONE.cream }}>
          What are we measuring?
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
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
                className="rounded-lg px-3 py-1.5 text-[14px] transition-colors"
                style={{
                  border: `1px solid ${on ? "rgba(255,255,255,.18)" : TONE.hair}`,
                  background: on ? TONE.cream : "transparent",
                  color: on ? "#1c1b19" : TONE.dim,
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        {/* selected lens spelled out as the question, + custom-compile */}
        <div className="mt-2.5 text-[13px]" style={{ color: TONE.faint }}>
          Would they <span style={{ color: TONE.dim }}>{activeLens.gloss}</span>?
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="or ask your own…"
          className="mt-3 w-full rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none transition-colors"
          style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19", color: TONE.cream }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = TONE.border)}
        />
        {custom.trim() ? (
          <div className="mt-2 font-mono text-[12px]" style={{ color: TONE.faint }}>
            ↳ nearest lens · <span style={{ color: TONE.dim }}>would {activeLens.label.toLowerCase()}</span>
          </div>
        ) : null}
      </div>

      {/* THE SLICE — who, and how many */}
      <div className="mt-6 px-[26px]">
        <Kick>The slice</Kick>
        <div className="mt-1.5 flex items-center justify-between">
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
        <div className="mt-2 text-[13px]" style={{ color: TONE.faint }}>
          {withCommas(n)} simulated minds{seg.share < 1 ? ` · the ${seg.label.toLowerCase()} slice` : " · the whole room"}
        </div>
      </div>

      {/* inherited thread context — quiet receipt, tap-to-override scene; projection tag if it drifts */}
      <div className="mt-6 px-[26px]">
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

      {/* footer — the assembling receipt + arm + fidelity override */}
      <div className="mt-6 border-t px-[26px] py-[18px]" style={{ borderColor: TONE.border }}>
        <div className="text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          {receipt}
        </div>
        <div className="mt-3 flex items-center justify-between">
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
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-opacity"
            style={{ background: TONE.cream, color: "#1c1b19" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
