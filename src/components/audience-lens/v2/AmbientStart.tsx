"use client";

/**
 * AmbientStart — Ambient Audience v2, surface ④ "the instrument at rest" (L6, Option 1).
 *
 * The screen you land on with nothing running: a clean AS-style card, not a dashboard. Owner-locked
 * composition (2026-07-21 config/rank model → Option 1,
 * `docs/HANDOFF-2026-07-21-ambient-audience-v2-config-rank-model.md`):
 *
 *   - a quiet time-of-day greeting (serif = the room's voice),
 *   - the STANDING CONDITIONS block — "Testing against" · ◇ audience (locked, L1) · scene ▾ ·
 *     fidelity ▾. This is the loud-at-birth form of the persistent strip that pins to the top of the
 *     thread once you're running (same control, two intensities — L4). NO auto-rank dial: the thin
 *     rank is always-on, intrinsic to every skill, never a start-screen toggle,
 *   - the MAKE GRID — a quiet "Make something" kicker over the maker skills (Hook · Script · … ),
 *     each carrying a preset lens; grows as verticals are added,
 *   - ONE visually-distinct SIMULATE DOOR — "Test something against your audience →" — the separate,
 *     deliberate screening act (a video / a draft / ask the room). Kept its own act so simulation
 *     never reads as one more maker in the list,
 *   - the composer as the fallback ("…or just ask").
 *
 * The two verbs read as two verbs: MAKE (skills → content + a thin rank rides every output) vs
 * SIMULATE (the deliberate full read, armed through ⑤). A skill's rank DEVELOPS into a full
 * simulation through ⑤; the door is only the cold-start (nothing to develop yet). Nothing auto-sims.
 *
 * Grammar: clean card · serif reserved for the greeting voice · de-boxed hairlines · matte (no glow) ·
 * no coral (nothing is lost yet).
 */

import { useEffect, useRef, useState } from "react";
import { TONE } from "./AmbientDetail";

// ── view-model ───────────────────────────────────────────────────────────────

export type ActionIcon =
  | "sparkle"
  | "play"
  | "ask"
  | "repeat"
  | "pen"
  | "hash"
  | "doc"
  | "list"
  | "idea"
  | "frame"
  | "target"
  | "search";

export interface StartSkill {
  id: string; // the SKILL_RUN_META key (ideas · hooks · script · remix · explore · read · account · test)
  label: string;
  lens: string; // a short line: what the skill produces / the audience question it arms
  icon: ActionIcon;
}

/** Skills, grouped by verb (Make · Analyze · Discover) — the real platform set. */
export interface SkillGroup {
  label: string;
  skills: StartSkill[];
}

export interface StartConditions {
  audience: string; // "Your audience" — locked for the thread (L1)
  scene: string; // how they encounter it — tap to change
  sceneOptions: string[];
  fidelity: string; // SIM-1 Flash / SIM-1 Max — tap to change
  fidelityOptions: string[];
}

export interface StartData {
  name: string;
  conditions: StartConditions;
  skillGroups: SkillGroup[]; // every skill the user can run, grouped by verb
  composerPlaceholder: string;
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
    case "idea":
      return <svg {...s} aria-hidden><path d="M8 1.8 L14.2 8 L8 14.2 L1.8 8 Z" /></svg>;
    case "frame":
      return <svg {...s} aria-hidden><path d="M2.5 3.5 H13.5 V12.5 H2.5 Z M2.5 10.2 L6 7 L8.4 9.2 L10.6 7.4 L13.5 10" /><circle cx="5.4" cy="6" r=".9" /></svg>;
    case "target":
      return <svg {...s} aria-hidden><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2.4" /><circle cx="8" cy="8" r=".5" fill="currentColor" stroke="none" /></svg>;
    case "search":
      return <svg {...s} aria-hidden><circle cx="7" cy="7" r="4.4" /><path d="M10.3 10.3 L13.8 13.8" /></svg>;
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
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

function ConditionsStrip({
  conditions,
  onScene,
  onFidelity,
}: {
  conditions: StartConditions;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
}) {
  const [scene, setScene] = useState(conditions.scene);
  const [fidelity, setFidelity] = useState(conditions.fidelity);
  return (
    <div className="mt-7">
      <div className="font-mono text-[11px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
        Testing against
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
    </div>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientStart({
  data,
  onScene,
  onFidelity,
  onSkill,
  activeSkillId,
}: {
  data: StartData;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
  onSkill?: (skillId: string) => void;
  /** Accepted for the eventual post-pick compose step; the Start card itself has no free-text box. */
  onSubmit?: (text: string) => void;
  /** The currently-armed skill id (the composer's active tool). Shown on the selector bar. */
  activeSkillId?: string;
}) {
  const { name, conditions, skillGroups } = data;
  // client-only greeting: the wall clock differs server↔client, so resolve it after mount (lazy
  // init would run on the server and hydration-mismatch across an hour/timezone boundary).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(timeGreeting());
  }, []);

  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center"
      style={{ fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}
    >
      {/* the clean AS-style card — self-contained, floats on the darker room field */}
      <div
        data-testid="ambient-start"
        className="ambient-row-in flex w-full max-w-[640px] flex-col rounded-[20px] px-8 pb-7 pt-8"
        style={{
          color: TONE.cream,
          background: "#1f1f1e",
          border: `1px solid ${TONE.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,.4)",
        }}
      >
        {/* quiet time-of-day greeting (serif = the room's voice) */}
        <h1 className="font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.01em]">
          {greeting}, {name}
        </h1>

        {/* the standing conditions — loud once, at birth (the persistent strip in its loud form) */}
        <ConditionsStrip conditions={conditions} onScene={onScene} onFidelity={onFidelity} />

        <div className="mt-6 h-px w-full" style={{ background: TONE.border }} />

        {/* The categorized grid IS the default Start (Artificial-Societies concept): choose WHAT to
            make; the pick arms the skill + drops into the thread composer to write the topic. No
            free-text box, no modal — the grid is the surface. */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
          {skillGroups.map((group) => (
            <div key={group.label}>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: TONE.faint }}>
                {group.label}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {group.skills.map((sk) => (
                  <SkillTile
                    key={sk.id}
                    skill={sk}
                    active={sk.id === activeSkillId}
                    onPick={() => onSkill?.(sk.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A skill tile in the categorized default-Start grid — icon well + label, highlighted when it's the
 *  armed skill. A pick arms the skill; the composer then drops the creator into the thread to write. */
function SkillTile({
  skill,
  active = false,
  onPick,
}: {
  skill: StartSkill;
  active?: boolean;
  onPick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={`group flex items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors ${
        active ? "bg-[rgba(255,255,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.045)]"
      }`}
    >
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#242422] transition-colors group-hover:text-[#ece7de]"
        style={{ color: active ? TONE.cream : "rgba(236,231,222,0.75)" }}
      >
        <Icon kind={skill.icon} />
      </span>
      <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
        {skill.label}
      </span>
    </button>
  );
}
