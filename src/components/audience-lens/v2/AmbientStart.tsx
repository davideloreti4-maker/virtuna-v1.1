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
import type { Audience } from "@/lib/audience/audience-types";
import { groupAudiences } from "@/components/audience/audience-display";
import { resolveTier } from "@/lib/audience/resolve-tier";

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
  | "search"
  | "mega"
  // the artifact set (one glyph per tile, drawn as a family: 16-box, 1.4 stroke, no fills)
  | "bulb"
  | "firstline"
  | "page"
  | "filmstrip"
  | "bubble"
  | "compass"
  | "at"
  | "ab";

export interface StartSkill {
  id: string; // the SKILL_RUN_META key (ideas · hooks · script · remix · explore · read · account · test)
  label: string;
  lens: string; // a short line: what you get back — rendered under the label
  icon: ActionIcon;
  /**
   * "soon" ⇒ the artifact is named on the grid but has NO pipeline behind it yet, so the tile is
   * inert (no `onPick`, no armed state). Mirrors the `status` field INTAKE_DOORS already uses —
   * naming a door we haven't built is honest; routing a creator into nothing is not.
   */
  status?: "active" | "soon";
}

/** Skills, grouped by what you're working on (Content · Intel) — the real platform set. */
export interface SkillGroup {
  label: string;
  skills: StartSkill[];
  /**
   * How many of the grid's 3 tracks this group occupies. Content carries ~2× the artifacts of
   * Intel, so it takes 2 tracks and flows its tiles into 2 inner columns — every column ends up
   * the same height instead of one running twice as long as the other. Default 1.
   */
  span?: 1 | 2;
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
    case "mega":
      return <svg {...s} aria-hidden><path d="M2.6 6.6 v2.8 a1 1 0 0 0 1 1 h1.6 l4.6 3 V2.6 l-4.6 3 H3.6 a1 1 0 0 0-1 1 Z M12.2 5.8 a3 3 0 0 1 0 4.4" /></svg>;
    // ── the artifact family ────────────────────────────────────────────────
    case "bulb": // Ideas — the concept before it exists
      return <svg {...s} aria-hidden><path d="M8 1.9 a4.1 4.1 0 0 1 2.4 7.4 c-.5.4-.7.9-.7 1.4 H6.3 c0-.5-.2-1-.7-1.4 A4.1 4.1 0 0 1 8 1.9 Z M6.4 12.8 h3.2 M7 14.4 h2" /></svg>;
    case "firstline": // Hooks — the OPENING line carries the weight
      return <svg {...s} aria-hidden><path d="M2.6 4.4 H13.4" strokeWidth={2.4} /><path d="M2.6 8.4 H10.2" /><path d="M2.6 11.9 H7.4" /></svg>;
    case "page": // Script — a written page, corner folded
      return <svg {...s} aria-hidden><path d="M4 1.9 H9.5 L12.3 4.7 V14.1 H4 Z M9.5 1.9 V4.7 H12.3 M6.2 8 H10.1 M6.2 10.7 H10.1" /></svg>;
    case "filmstrip": // Video test — frame by frame, literally
      return <svg {...s} aria-hidden><path d="M2.3 3.6 H13.7 V12.4 H2.3 Z M5.6 3.6 V12.4 M10.4 3.6 V12.4 M2.3 6.1 H4 M2.3 9.9 H4 M12 6.1 H13.7 M12 9.9 H13.7" /></svg>;
    case "bubble": // Draft read — text, put to the room
      return <svg {...s} aria-hidden><path d="M2.6 3.3 H13.4 V10.3 H7.3 L4.6 12.8 V10.3 H2.6 Z M5.1 5.9 H10.9 M5.1 8.1 H8.9" /></svg>;
    case "compass": // Explore — finding what's out there (frees the magnifier)
      return <svg {...s} aria-hidden><circle cx="8" cy="8" r="5.9" /><path d="M10.5 5.5 L9.1 9.1 L5.5 10.5 L6.9 6.9 Z" /></svg>;
    case "at": // Account teardown — an @handle, yours or theirs
      return <svg {...s} aria-hidden><circle cx="8" cy="8" r="2.5" /><path d="M10.5 5.5 v3.5 a1.9 1.9 0 0 0 3.8 0 V8 A6.3 6.3 0 1 0 11.7 13.1" /></svg>;
    case "ab": // Compare A/B — two panels, one winner
      return <svg {...s} aria-hidden><path d="M2.2 3.7 H6.8 V12.3 H2.2 Z M9.2 3.7 H13.8 V12.3 H9.2 Z M4.5 6.4 V9.6 M11.5 6.4 V9.6" /></svg>;
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
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] transition-colors"
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

/**
 * The audience selector on the Start (pre-thread) surface. On Start there is NO thread yet, so the
 * audience is a real CHOICE here — this is where a new user should pick their calibrated room (or
 * stay on General). Grouped Socials/General like the in-thread presence switcher, with the honest
 * neutral tier badge. In-thread the SAME conditions strip pins the audience LOCKED (a new audience
 * means a new thread) — the locked span below covers that reuse (no switch props passed).
 */
function AudiencePick({
  label,
  audiences,
  selectedAudienceId,
  onSelectAudience,
}: {
  label: string;
  audiences: Audience[];
  selectedAudienceId: string | null;
  onSelectAudience: (a: Audience) => void;
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

  const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);
  // Socials (baseline General + presets + your socials rows) then General SIMs — mirrors the dock.
  const socials = [...baseline, ...templates, ...yours.filter((a) => a.mode !== "general")];
  const general = [...generalTemplates, ...yours.filter((a) => a.mode === "general")];
  const isActive = (a: Audience) => (a.is_general ? selectedAudienceId === null : a.id === selectedAudienceId);

  const Row = ({ a }: { a: Audience }) => {
    const on = isActive(a);
    return (
      <button
        type="button"
        role="menuitemradio"
        aria-checked={on}
        onClick={() => {
          onSelectAudience(a);
          setOpen(false);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
        style={{ color: on ? TONE.cream : TONE.dim }}
        onMouseEnter={(e) => (e.currentTarget.style.background = TONE.well)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span className="min-w-0 flex-1 truncate">{a.name}</span>
        <span className="shrink-0 text-[11px]" style={{ color: TONE.faint }}>
          {resolveTier(a)}
        </span>
        <span aria-hidden className="w-3 shrink-0 text-center" style={{ color: TONE.cream, opacity: on ? 1 : 0 }}>
          ✓
        </span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Audience: ${label}. Switch audience`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] transition-colors"
        style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.cream }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = TONE.hair)}
      >
        {/* the room is live — accent as a LIVENESS signal only (the locked dosage rule: a live dot
            is on the allow-list; this is the one accent mark on the whole Start surface) */}
        <span
          aria-hidden
          className="h-[5px] w-[5px] flex-none rounded-full"
          style={{ background: "var(--color-accent)", boxShadow: "0 0 0 3px var(--color-accent-soft)" }}
        />
        {label}
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden style={{ color: TONE.faint }}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Your audiences"
          className="absolute left-0 z-20 mt-1.5 max-h-[320px] min-w-[240px] overflow-y-auto rounded-[10px] py-1"
          style={{ border: `1px solid ${TONE.border}`, background: "#212120", boxShadow: "0 12px 32px rgba(0,0,0,.4)" }}
        >
          {socials.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
                Socials
              </p>
              {socials.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </>
          ) : null}
          {general.length > 0 ? (
            <>
              <p className="mt-1 px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
                General
              </p>
              {general.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConditionsStrip({
  conditions,
  onScene,
  onFidelity,
  audiences,
  selectedAudienceId,
  onSelectAudience,
}: {
  conditions: StartConditions;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
  // When these are supplied (the pre-thread Start surface), the audience is a real CHOICE (picker).
  // Absent (the in-thread reuse / dev fixture) → the audience stays LOCKED (non-interactive span).
  audiences?: Audience[];
  selectedAudienceId?: string | null;
  onSelectAudience?: (a: Audience) => void;
}) {
  const [scene, setScene] = useState(conditions.scene);
  const [fidelity, setFidelity] = useState(conditions.fidelity);
  const audienceSelectable = !!onSelectAudience && !!audiences;
  return (
    <div className="mt-7">
      <div className="font-mono text-[11px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
        Testing against
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
        {audienceSelectable ? (
          // Pre-thread Start: pick the audience here (no thread yet to lock to).
          <AudiencePick
            label={conditions.audience}
            audiences={audiences!}
            selectedAudienceId={selectedAudienceId ?? null}
            onSelectAudience={onSelectAudience!}
          />
        ) : (
          // In-thread reuse: audience is locked for the thread (L1) — no ▾, dimmer, non-interactive.
          <span
            className="flex cursor-default items-center gap-2 rounded-full px-3.5 py-2"
            style={{ border: `1px solid ${TONE.border}`, background: "transparent", color: TONE.dim }}
            title="Locked for this thread — a new audience means a new thread"
          >
            <span
              aria-hidden
              className="h-[5px] w-[5px] flex-none rounded-full"
              style={{ background: "var(--color-accent)", boxShadow: "0 0 0 3px var(--color-accent-soft)" }}
            />
            {conditions.audience}
            <span aria-hidden style={{ color: TONE.ghost, fontSize: 11 }}>⤫</span>
          </span>
        )}
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
  audiences,
  selectedAudienceId,
  onSelectAudience,
}: {
  data: StartData;
  onScene?: (v: string) => void;
  onFidelity?: (v: string) => void;
  onSkill?: (skillId: string) => void;
  /** Accepted for the eventual post-pick compose step; the Start card itself has no free-text box. */
  onSubmit?: (text: string) => void;
  /** The currently-armed skill id (the composer's active tool). Shown on the selector bar. */
  activeSkillId?: string;
  // Audience switching on the pre-thread Start surface. When provided, the "Testing against"
  // audience chip becomes a real picker (a new user chooses their room here). Omitted → locked.
  audiences?: Audience[];
  selectedAudienceId?: string | null;
  onSelectAudience?: (a: Audience) => void;
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
        // 760 — the composer dock's width. Start sits directly ABOVE the field on the empty home,
        // so the two must share an edge; a wider card would float off the column it introduces.
        className="ambient-row-in flex w-full max-w-[760px] flex-col rounded-[20px] px-7 pb-6 pt-7"
        style={{
          color: TONE.cream,
          background: "#1f1f1e",
          border: `1px solid ${TONE.border}`,
          // matte system: a shadow that SEPARATES, not one that floats. The card now sits directly
          // above the composer, and a heavy drop read as two unrelated slabs.
          boxShadow: "0 4px 16px rgba(0,0,0,.16)",
        }}
      >
        {/* quiet time-of-day greeting (serif = the room's voice) */}
        <h1 className="font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.01em]">
          {greeting}, {name}
        </h1>

        {/* the standing conditions — loud once, at birth (the persistent strip in its loud form) */}
        <ConditionsStrip
          conditions={conditions}
          onScene={onScene}
          onFidelity={onFidelity}
          audiences={audiences}
          selectedAudienceId={selectedAudienceId}
          onSelectAudience={onSelectAudience}
        />

        <div className="mt-6 h-px w-full" style={{ background: TONE.border }} />

        {/* The categorized grid IS the default Start (Artificial-Societies concept): choose WHAT to
            make; the pick arms the skill + drops into the thread composer to write the topic. No
            free-text box, no modal — the grid is the surface. */}
        <div className="mt-6 grid grid-cols-1 items-start gap-x-6 gap-y-6 sm:grid-cols-3">
          {skillGroups.map((group) => (
            <div key={group.label} className={group.span === 2 ? "sm:col-span-2" : undefined}>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: TONE.faint }}>
                {group.label}
              </div>
              <div
                className={`mt-3 grid gap-x-5 gap-y-1 ${group.span === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}
              >
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

/** A skill tile in the categorized default-Start grid — icon well + label + the `lens` line saying
 *  what you get back. Highlighted when it's the armed skill. A pick arms the skill; the composer then
 *  drops the creator into the thread to write. A `soon` tile is inert (named, but nothing to run). */
function SkillTile({
  skill,
  active = false,
  onPick,
}: {
  skill: StartSkill;
  active?: boolean;
  onPick?: () => void;
}) {
  const soon = skill.status === "soon";
  return (
    <button
      type="button"
      onClick={soon ? undefined : onPick}
      disabled={soon}
      aria-pressed={soon ? undefined : active}
      className={`group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors ${
        soon
          ? "cursor-default"
          : active
            ? "bg-[rgba(255,255,255,0.06)]"
            : "hover:bg-[rgba(255,255,255,0.045)]"
      }`}
      style={soon ? { opacity: 0.45 } : undefined}
    >
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-[rgba(255,255,255,0.08)] bg-[#242422] transition-colors"
        style={{ color: active ? TONE.cream : "rgba(236,231,222,0.75)" }}
      >
        <Icon kind={skill.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="flex items-center gap-2 whitespace-nowrap text-[14.5px] font-medium leading-[1.2]"
          style={{ color: TONE.cream }}
        >
          {skill.label}
          {soon ? (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
              Soon
            </span>
          ) : null}
        </span>
        {/* one line, never wrapped — the lens is a glance, not a paragraph */}
        <span className="mt-0.5 block truncate text-[11.5px] leading-[1.3]" style={{ color: TONE.faint }}>
          {skill.lens}
        </span>
      </span>
    </button>
  );
}
