"use client";

/**
 * AmbientDetail — Ambient Audience v2, the DETAIL view (one stimulus, two tabs).
 *
 * L3 two-page instrument: `The brain` (out-Sapient) | `The audience` (out-AS). Detail is ALWAYS
 * one stimulus (comparison lives on the Overview). Shared header: back-to-overview · `N of M`
 * pager · the verdict hero · tab switch. Same fixed height as every v2 surface.
 *
 * Round-4 grammar, with the owner's mark applied: the little bar-chart glyph beside the % is GONE
 * (it added no value — build handoff §4). The verdict stands alone as the biggest type = the answer.
 */

import { useState } from "react";
import { AMBIENT_PANEL_HEIGHT } from "./AmbientOverview";
import { BrainFrame } from "./BrainTab";
import { PopulationFrame } from "./AudienceTab";
import type { DomainTemplate } from "./domain-template";

// ── view-model ───────────────────────────────────────────────────────────────

export interface AttentionData {
  hold: number;
  transcript: string;
  peakWordIndex: number;
  clipSeconds: number;
  points: number[]; // 0..80 attention over the clip
  moments: { t: string; v: number; dip?: boolean }[];
}

export interface SignalRow {
  label: string;
  score: number; // 0..100
  band: "strong" | "okay" | "weak";
}

export interface NetworkRow {
  label: string;
  z: number; // z-score σ; negative = below the system's resting level
  loss?: boolean;
}

/** One taste cluster on the terrain (nodes = people, 1 node ≈ 10 agents). */
export interface TerrainCluster {
  name: string;
  cx: number; // layout anchor in the 380×210 terrain viewBox
  cy: number;
  spread: number;
  n: number; // nodes in this cluster
  lit: number; // 0..1 share that stopped (lights the cluster)
}

/** Attention tri-state split (%). NOTE: the live engine's attention axis is binary stop/scroll —
 *  the "skimmed" middle is a NEW contract (build handoff §6); r4 fixture carries it as the target. */
export interface TriState {
  stopped: number;
  skimmed: number;
  scrolled: number;
}

export interface SegmentStop {
  label: string;
  pct: number;
  loss?: boolean; // the loudest-no segment (coral)
}

/** A coded objection/endorsement — the reason speaks for N; the persona is its exemplar voice. */
export interface CodedReason {
  label: string;
  count: number;
  quote: string; // serif verbatim
  who: string; // "Maya · skeptic"
  loss?: boolean; // the dominant objection (coral count)
}

// shared r4 tone system
export const TONE = {
  cream: "#ece7de",
  dim: "rgba(236,231,222,.62)",
  faint: "rgba(236,231,222,.38)",
  ghost: "rgba(236,231,222,.16)",
  coral: "#FF6363",
  border: "rgba(255,255,255,.06)",
  hair: "rgba(255,255,255,.08)",
  well: "#262624",
} as const;

// shared kicker + "human question owns its number" heads (r4 grammar)
export function Kick({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[12px] uppercase tracking-[0.08em]">
      <span style={{ color: TONE.faint }}>{children}</span>
      {tag ? <span style={{ color: "rgba(236,231,222,.28)", letterSpacing: "0.06em" }}>{tag}</span> : null}
    </div>
  );
}

export function SecHead({
  q,
  ownLabel,
  ownValue,
  weak,
}: {
  q: string;
  ownLabel: string;
  ownValue: string;
  weak?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between">
      <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
        {q}
      </span>
      <span className="text-[13px]" style={{ color: TONE.faint }}>
        {ownLabel}{" "}
        <b className="text-[16px] font-medium" style={{ color: weak ? TONE.coral : TONE.cream }}>
          {ownValue}
        </b>
      </span>
    </div>
  );
}

export function HowToRead() {
  return (
    <button
      type="button"
      className="mt-[30px] flex w-full items-center justify-between pt-4 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors"
      style={{ borderTop: `1px solid ${TONE.border}`, color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.dim)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      <span>How to read these numbers</span>
      <span>›</span>
    </button>
  );
}

// ── the detail view ──────────────────────────────────────────────────────────

type Tab = "brain" | "audience";

export function AmbientDetail({
  template,
  initialTab = "brain",
  reducedMotion = false,
  onBack,
  className,
}: {
  template: DomainTemplate;
  initialTab?: Tab;
  reducedMotion?: boolean;
  onBack?: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { backLabel, pager, verdict, brain, population } = template;

  return (
    <div
      data-testid="ambient-detail"
      className={`flex w-full max-w-[380px] flex-col rounded-[16px] ${className ?? ""}`}
      style={{
        height: AMBIENT_PANEL_HEIGHT,
        background: "#1f1f1e",
        border: `1px solid ${TONE.border}`,
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* header */}
      <div className="px-[26px] pt-[26px]">
        <div className="flex items-baseline justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-[13px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            ← {backLabel}
          </button>
          <span className="font-mono text-[12px] tracking-[0.06em]" style={{ color: TONE.faint }}>
            {pager}
          </span>
        </div>

        {/* verdict hero — stands alone (glyph removed per owner mark). The value is pre-formatted per
            domain (creator "38.2%" · pricing "$24") so the hero never hardcodes a unit; label swaps too. */}
        <div className="mt-[18px] flex items-end">
          <span className="text-[42px] font-light leading-none tracking-[-0.015em]">{verdict.value}</span>
          <span className="ml-2 text-[16px]" style={{ color: TONE.faint }}>
            {verdict.label}
          </span>
        </div>

        {/* tabs */}
        <div className="mt-[22px] flex gap-[22px]" style={{ borderBottom: `1px solid ${TONE.border}` }}>
          {(["brain", "audience"] as const).map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative pb-2.5 text-[14px]"
                style={{ color: on ? TONE.cream : TONE.faint }}
              >
                {t === "brain" ? "The brain" : "The audience"}
                {on ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: TONE.cream }} />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-[26px]">
        {tab === "brain" ? (
          <BrainFrame brain={brain} reducedMotion={reducedMotion} />
        ) : population ? (
          <PopulationFrame population={population} reducedMotion={reducedMotion} />
        ) : (
          <div
            className="flex h-full items-center justify-center py-16 text-center text-[13px]"
            style={{ color: TONE.faint }}
          >
            The audience — no run yet.
          </div>
        )}
      </div>
    </div>
  );
}
