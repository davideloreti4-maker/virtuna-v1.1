"use client";

/**
 * AmbientStart — Ambient Audience v2, surface ④ "the instrument at rest" (L6, variant B).
 *
 * The screen you land on with nothing running: a cockpit, not a dashboard. Configuration is loud
 * exactly once, here at the thread's birth. Owner-locked composition (2026-07-21 config/rank model,
 * `docs/HANDOFF-2026-07-21-ambient-audience-v2-config-rank-model.md`):
 *
 *   - a quiet time-of-day greeting (serif = the room's voice),
 *   - the STANDING CONDITIONS block — "Testing against" · ◇ audience (locked, L1) · scene ▾ ·
 *     fidelity ▾ · the AUTO-RANK toggle. This is the loud-at-birth form of the persistent strip
 *     that pins to the top of the thread once you're running (same control, two intensities — L4),
 *   - the SKILL GRID as the hero — "what would you like to simulate?" (Societies-explicit), each
 *     skill carrying a preset lens; grows as verticals are added,
 *   - the composer as the fallback ("…or just type").
 *
 * Firing model: a skill fires content + a THIN RANK automatically (unless auto-rank is off); the full
 * simulation is DEVELOPED from that rank through ⑤. Nothing here ever auto-sims.
 *
 * Grammar: one hero (the grid) · serif reserved for the greeting voice · de-boxed hairlines · no
 * coral (nothing is lost yet).
 */

import { useEffect, useRef, useState } from "react";
import { TONE } from "./AmbientDetail";

// ── view-model ───────────────────────────────────────────────────────────────

export type ActionIcon = "sparkle" | "play" | "ask" | "repeat" | "pen" | "hash" | "doc" | "list";

export interface StartSkill {
  label: string;
  lens: string; // the preset question this skill arms ("would stop" …)
  icon: ActionIcon;
}

export interface StartCategory {
  label: string; // "Make" · "Test" · "Ask"
  skills: StartSkill[];
}

export interface StartConditions {
  audience: string; // "Your audience" — locked for the thread (L1)
  scene: string; // how they encounter it — tap to change
  sceneOptions: string[];
  fidelity: string; // SIM-1 Flash / SIM-1 Max — tap to change
  fidelityOptions: string[];
  autoRank: boolean; // the room ranks every skill output automatically
}

export interface StartData {
  name: string;
  conditions: StartConditions;
  composerPlaceholder: string;
  categories: StartCategory[];
}

function timeGreeting(): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}`;
}

// minimal line glyphs (matte, no emoji)
function Icon({ kind }: { kind: ActionIcon }) {
  const s = {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "sparkle":
      return <svg {...s} aria-hidden><path d="M8 1.6 L9.3 6.7 L14.4 8 L9.3 9.3 L8 14.4 L6.7 9.3 L1.6 8 L6.7 6.7 Z" /></svg>;
    case "play":
      return <svg {...s} aria-hidden><path d="M5 3.5 L12.5 8 L5 12.5 Z" /></svg>;
    case "ask":
      return <svg {...s} aria-hidden><path d="M2.5 3.5 h11 v7 h-6 l-3 2.5 v-2.5 h-2 Z" /></svg>;
    case "repeat":
      return <svg {...s} aria-hidden><path d="M3 6 a5 5 0 0 1 9-2 M13 3.5 V6 h-2.5 M13 10 a5 5 0 0 1-9 2 M3 12.5 V10 h2.5" /></svg>;
    case "pen":
      return <svg {...s} aria-hidden><path d="M3 13 L3.6 10.4 L10.8 3.2 L12.8 5.2 L5.6 12.4 Z M9.8 4.2 L11.8 6.2" /></svg>;
    case "hash":
      return <svg {...s} aria-hidden><path d="M6.2 2.5 L4.8 13.5 M11.2 2.5 L9.8 13.5 M2.8 5.6 H13.4 M2.6 10.4 H13.2" /></svg>;
    case "doc":
      return <svg {...s} aria-hidden><path d="M4 2 H12 V14 H4 Z M6.4 6 H9.6 M6.4 9 H9.6 M6.4 11.6 H9.6" /></svg>;
    case "list":
      return <svg {...s} aria-hidden><path d="M6 4 H13.4 M6 8 H13.4 M6 12 H13.4" /><circle cx="3" cy="4" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="8" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r=".7" fill="currentColor" stroke="none" /></svg>;
  }
}

// ── conditions strip (loud-at-birth here; the same control pins thin in-thread) ────────────────

/** Lightweight de-boxed picker — the scene / fidelity dials. Closes on outside click / Esc. */
function Pick({ value, options, onSelect }: { value: string; options: string[]; onSelect: (v: string) => void }) {
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
        {value}
        <span style={{ color: TONE.faint }}>▾</span>
      </button>
      {open ? (
        <div
          className="absolute left-0 z-10 mt-1.5 min-w-[150px] overflow-hidden rounded-[10px] py-1"
          style={{ border: `1px solid ${TONE.border}`, background: "#212120", boxShadow: "0 12px 32px rgba(0,0,0,.4)" }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onSelect(o);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors"
              style={{ color: o === value ? TONE.cream : TONE.dim }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TONE.well)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Auto-rank switch — the thread default for whether skills auto-produce a thin rank. */
function AutoRankToggle({ on, onToggle }: { on: boolean; onToggle: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="group flex items-center gap-2.5"
    >
      <span
        className="relative inline-flex h-[18px] w-[32px] flex-none items-center rounded-full transition-colors"
        style={{ background: on ? "rgba(236,231,222,.28)" : "rgba(255,255,255,.06)", border: `1px solid ${TONE.hair}` }}
      >
        <span
          className="inline-block h-[12px] w-[12px] rounded-full transition-transform"
          style={{
            background: on ? TONE.cream : TONE.faint,
            transform: on ? "translateX(15px)" : "translateX(3px)",
          }}
        />
      </span>
      <span className="text-[13px]" style={{ color: on ? TONE.dim : TONE.faint }}>
        Auto-rank
      </span>
    </button>
  );
}

function ConditionsStrip({
  conditions,
  onScene,
  onFidelity,
  onToggleAutoRank,
}: {
  conditions: StartConditions;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
  onToggleAutoRank?: (next: boolean) => void;
}) {
  const [scene, setScene] = useState(conditions.scene);
  const [fidelity, setFidelity] = useState(conditions.fidelity);
  const [autoRank, setAutoRank] = useState(conditions.autoRank);
  return (
    <div className="mt-7">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
          Testing against
        </div>
        <AutoRankToggle
          on={autoRank}
          onToggle={(v) => {
            setAutoRank(v);
            onToggleAutoRank?.(v);
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
        {/* audience — locked for the thread (L1); no ▾, dimmer, non-interactive */}
        <span
          className="flex cursor-default items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ border: `1px solid ${TONE.border}`, background: "transparent", color: TONE.dim }}
          title="Locked for this thread — a new audience means a new thread"
        >
          <span aria-hidden style={{ color: TONE.faint }}>◇</span>
          {conditions.audience}
          <span aria-hidden style={{ color: TONE.ghost, fontSize: 11 }}>⤫</span>
        </span>
        <span aria-hidden style={{ color: TONE.faint }}>as</span>
        <Pick
          value={scene}
          options={conditions.sceneOptions}
          onSelect={(v) => {
            setScene(v);
            onScene?.(v);
          }}
        />
        <span aria-hidden className="mx-1 inline-block h-3.5 w-px" style={{ background: TONE.hair }} />
        <Pick
          value={fidelity}
          options={conditions.fidelityOptions}
          onSelect={(v) => {
            setFidelity(v);
            onFidelity?.(v);
          }}
        />
      </div>
      <div className="mt-2.5 text-[12px]" style={{ color: TONE.faint }}>
        {autoRank
          ? "The room scores every output — develop a rank into a full simulation anytime."
          : "The room stays quiet — nothing runs until you simulate."}
      </div>
    </div>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientStart({
  data,
  onScene,
  onFidelity,
  onToggleAutoRank,
  onSkill,
  onSubmit,
}: {
  data: StartData;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
  onToggleAutoRank?: (next: boolean) => void;
  onSkill?: (categoryIdx: number, skillIdx: number) => void;
  onSubmit?: (text: string) => void;
}) {
  const { name, conditions, composerPlaceholder, categories } = data;
  // client-only greeting: the wall clock differs server↔client, so resolve it after mount (lazy
  // init would run on the server and hydration-mismatch across an hour/timezone boundary).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the browser clock
    setGreeting(timeGreeting());
  }, []);

  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center"
      style={{ fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}
    >
      <div data-testid="ambient-start" className="flex w-full max-w-[540px] flex-col" style={{ color: TONE.cream }}>
        {/* brand glyph */}
        <svg viewBox="0 0 22 16" className="h-4 w-[22px]" aria-hidden>
          <circle cx="3" cy="12" r="1.6" fill="#ece7de" opacity=".9" />
          <circle cx="9" cy="5" r="1.3" fill="#ece7de" opacity=".55" />
          <circle cx="15" cy="10" r="1.6" fill="#ece7de" opacity=".8" />
          <circle cx="19" cy="3" r="1.2" fill="#FF6363" opacity=".9" />
          <line x1="3" y1="12" x2="9" y2="5" stroke="#ece7de" strokeOpacity=".25" />
          <line x1="9" y1="5" x2="15" y2="10" stroke="#ece7de" strokeOpacity=".25" />
          <line x1="15" y1="10" x2="19" y2="3" stroke="#ece7de" strokeOpacity=".25" />
        </svg>

        {/* quiet time-of-day greeting (serif = the room's voice) — demoted so the grid is the hero */}
        <h1 className="mt-5 font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.01em]">
          {greeting}, {name}
        </h1>

        {/* the standing conditions — loud once, at birth (the persistent strip in its loud form) */}
        <ConditionsStrip
          conditions={conditions}
          onScene={onScene}
          onFidelity={onFidelity}
          onToggleAutoRank={onToggleAutoRank}
        />

        <div className="mt-7 h-px w-full" style={{ background: TONE.border }} />

        {/* THE HERO — what would you like to simulate? (Societies-explicit skill menu) */}
        <div className="mt-7 text-[17px] font-medium" style={{ color: TONE.cream }}>
          What would you like to simulate?
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-3">
          {categories.map((cat, ci) => (
            <div key={cat.label}>
              <div className="font-mono text-[11px] uppercase tracking-[0.07em]" style={{ color: TONE.faint }}>
                {cat.label}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {cat.skills.map((sk, si) => (
                  <button
                    key={sk.label}
                    type="button"
                    onClick={() => onSkill?.(ci, si)}
                    className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
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
                    <span className="flex-none" style={{ color: TONE.faint }}>
                      <Icon kind={sk.icon} />
                    </span>
                    <span className="text-[14px]">{sk.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* composer — the fallback: type anything, develop it into a simulation */}
        <ComposerRow placeholder={composerPlaceholder} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function ComposerRow({ placeholder, onSubmit }: { placeholder: string; onSubmit?: (t: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (text.trim()) onSubmit?.(text.trim());
  };
  return (
    <div
      className="mt-8 flex items-center gap-2 rounded-[12px] py-2 pl-4 pr-2"
      style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19" }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        style={{ color: TONE.cream }}
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Simulate"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] transition-opacity"
        style={{ background: TONE.cream, color: "#1c1b19", opacity: text.trim() ? 1 : 0.4 }}
      >
        ↑
      </button>
    </div>
  );
}
