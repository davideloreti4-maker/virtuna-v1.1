"use client";

/**
 * ComposerControls — the locked composer control row (UX-01, sketch 006 Variant 1).
 *
 *   [+]  [Skill pill ▾]  [audience]  [intent]  ······  [model]  [↑ send]
 *                                                       └─ model + send live in composer.tsx
 *
 * This module owns the LEFT cluster (`+` attach · skill pill · audience · intent) plus
 * every popover, and exports the skill SSOT (ToolId / SKILLS / MODEL_LABEL) + the shared
 * SkillRows list (reused by the composer's `/` slash menu) + the read-only ModelTag.
 *
 * Design (flat-warm THEME-06): warm charcoal surfaces, cream text, matured terracotta
 * (var(--color-foreground-secondary)) accent ONLY on the skill pill icon / active row / MAX badge. Premium line-icon
 * SVGs — NO emoji. Popover everywhere (desktop AND mobile — no bottom sheet); popovers
 * open UPWARD with max-height + scroll so 9 skills never clip.
 *
 * The skill pill is the ONE accented/bordered control. Audience + intent are icon-only,
 * borderless, quiet. The model is a read-only indicator — the SKILL decides it
 * (Test + Ad Creative → SIM-1 Max; everything else → SIM-1 Flash), so it is never a control.
 *
 * Replaces tool-chips.tsx (the old chip row + active-model field).
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Skill vocabulary (SSOT) ─────────────────────────────────────────────────
// The skill id union, including the not-yet-shipped skills: "explore" (P11),
// "offer" + "ad" (P16). They render as disabled "coming soon" rows so the
// selector is built once and lights up per phase.
export type ToolId =
  | "test"
  | "account"
  | "idea"
  | "hooks"
  | "chat"
  | "script"
  | "remix"
  | "explore"
  | "offer"
  | "ad"
  | "profile"
  | "simulate"
  | "predict";

export type SkillGroup = "creator" | "marketing";
/**
 * Which Audience mode surfaces a skill (UX-02 / D-01). The skill menu filters on
 * the active Audience's mode BEFORE the Creator/Marketing group partition, so the
 * Socials/creator render stays byte-identical and General audiences see the three
 * General verbs (Profile / Simulate / Predict) instead of the creator skills.
 */
export type SkillMode = "socials" | "general";
export type SkillModel = "Flash" | "Max";
export type Intent = "grow" | "sell";

export interface SkillMeta {
  id: ToolId;
  label: string;
  desc: string;
  /** `/` command label shown in the popover + typed into the slash menu. */
  command: string;
  group: SkillGroup;
  /** Audience mode(s) this skill belongs to (UX-02 / D-01). Creator skills are
   *  `["socials"]`; the General verbs are `["general"]`. The SkillRows filter gates
   *  on the active mode before the Creator/Marketing group partition. */
  modes: SkillMode[];
  /** SIM-1 tier the skill fires — drives the read-only ModelTag. */
  model: SkillModel;
  /** false → "coming soon", rendered disabled (ships as its phase lands). */
  enabled: boolean;
}

// Order mirrors sketch 006 + the handoff table.
export const SKILLS: SkillMeta[] = [
  // ── Socials (creator) — byte-identical render; every entry tagged ["socials"] ──
  { id: "explore", label: "Explore",          desc: "Audience-curated discovery",          command: "/explore", group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "idea",    label: "Ideas",            desc: "Funnel-top idea cards",               command: "/ideas",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "hooks",   label: "Hooks",            desc: "Ranked scroll-stoppers",              command: "/hooks",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "script",  label: "Script",           desc: "Beats + retention markers",           command: "/script",  group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "remix",   label: "Remix",            desc: "Decode a winner → your version",      command: "/remix",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "test",    label: "Test",             desc: "Full Read on a real video",           command: "/test",    group: "creator",   modes: ["socials"], model: "Max",   enabled: true  },
  { id: "account", label: "Account Read",     desc: "A Read on your own account",          command: "/account", group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "chat",    label: "Chat",             desc: "Ask Numen anything",                  command: "/chat",    group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "offer",   label: "Offer Validation", desc: "Test a product, price, positioning",  command: "/offer",   group: "marketing", modes: ["socials"], model: "Flash", enabled: false },
  { id: "ad",      label: "Ad Creative",      desc: "Pre-flight an ad, ROAS-framed",       command: "/ad",      group: "marketing", modes: ["socials"], model: "Max",   enabled: false },
  // ── General — the three verbs surfaced only when a General audience is active.
  //    `group: "creator"` is inert here (the outer filter is mode; group only sub-headers
  //    the Socials section). NO accent — reuse the existing row visual language. ──
  { id: "profile",  label: "Profile",  desc: "Build a SIM from a chat or screenshot", command: "/profile",  group: "creator", modes: ["general"], model: "Flash", enabled: true },
  { id: "simulate", label: "Simulate", desc: "Run a draft through your audience",      command: "/simulate", group: "creator", modes: ["general"], model: "Flash", enabled: true },
  { id: "predict",  label: "Predict",  desc: "Analyst-panel scenario read",            command: "/predict",  group: "creator", modes: ["general"], model: "Flash", enabled: true },
];

export const getSkill = (id: ToolId): SkillMeta =>
  SKILLS.find((s) => s.id === id) ?? SKILLS[1]!; // fall back to Ideas (never reached)

/**
 * Whether a skill is visible in the menu for the given active Audience mode.
 *
 * The three General verbs (Profile / Simulate / Predict) are ALWAYS visible — they
 * stay discoverable from a creator (socials) context instead of vanishing until a
 * General audience is selected (the "merged-but-not-visible" gap). Selecting one
 * without a General audience funnels the user to Build (composer §16.4), matching
 * the always-present Home chips. Creator/Marketing skills surface only in socials
 * mode. Shared by the skill popover AND the `/` slash menu so the two never drift.
 */
export const isSkillVisible = (s: SkillMeta, mode: SkillMode): boolean =>
  s.modes.includes("general") || (mode !== "general" && s.modes.includes(mode));

// ─── Model labels (D-09) — the skill decides the model; this is read-only ────
export const MODEL_LABEL: Record<ToolId, string> = SKILLS.reduce(
  (acc, s) => ({ ...acc, [s.id]: `SIM-1 ${s.model}` }),
  {} as Record<ToolId, string>,
);

// ─── Line-icon SVGs (premium, no emoji) — paths from sketch 006 ──────────────
const ICONS: Record<string, string> = {
  plus: '<path d="M8 3v10M3 8h10"/>',
  chev: '<path d="M4 6.2l4 4 4-4"/>',
  chevR: '<path d="M6 4l4 4-4 4"/>',
  check: '<path d="M3 8.5l3.2 3.2L13 5"/>',
  people:
    '<circle cx="6" cy="6" r="2.2"/><path d="M2.3 13c0-2 1.7-3.2 3.7-3.2S9.7 11 9.7 13"/><path d="M10.6 4.2a2 2 0 010 3.6M11.2 13c0-1.4-.5-2.4-1.3-3"/>',
  target: '<circle cx="8" cy="8" r="5.2"/><circle cx="8" cy="8" r="2"/>',
  compass: '<circle cx="8" cy="8" r="6"/><path d="M10.5 5.5L9 9l-3.5 1.5L7 7z"/>',
  bulb: '<path d="M5.5 10a3.5 3.5 0 115 0c-.6.5-1 1-1 2H6.5c0-1-.4-1.5-1-2z"/><path d="M6.5 14h3"/>',
  anchor:
    '<circle cx="8" cy="3.5" r="1.5"/><path d="M8 5v8M3.5 9a4.5 4.5 0 009 0M3.5 9H5M11 9h1.5"/>',
  doc: '<path d="M4 2.5h5L12 5.5V13.5H4z"/><path d="M9 2.5V6h3M6 9h4M6 11h4"/>',
  shuffle:
    '<path d="M2.5 4.5h3l5 7h3M2.5 11.5h3l1.5-2M11 9.5l2.5 2-2.5 2M11 2.5l2.5 2-2.5 2"/>',
  crosshair:
    '<circle cx="8" cy="8" r="5.2"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8h2.5M12 8h2.5"/>',
  chat: '<path d="M2.5 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H7l-3 2.5V11H4.5a2 2 0 01-2-2z"/>',
  tag: '<path d="M2.5 7.5l5-5H13V8l-5 5z"/><circle cx="10" cy="5" r="0.8"/>',
  mega: '<path d="M2.5 6.5v3l7 3V3.5z"/><path d="M9.5 5.5a3 3 0 010 5M3 9.5v2.5h2"/>',
  video: '<rect x="2" y="4" width="8" height="8" rx="1.5"/><path d="M10 7l4-2v6l-4-2z"/>',
  image:
    '<rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><circle cx="6" cy="6.5" r="1"/><path d="M3 11l3-2.5 3 2 2-1.5 3 2.5"/>',
  camera:
    '<rect x="2" y="4.5" width="12" height="8" rx="1.5"/><circle cx="8" cy="8.5" r="2.3"/><path d="M5.5 4.5l1-1.5h3l1 1.5"/>',
  search: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>',
};

/** Map each skill id → its line-icon key. */
const SKILL_ICON: Record<ToolId, string> = {
  explore: "compass",
  idea: "bulb",
  hooks: "anchor",
  script: "doc",
  remix: "shuffle",
  test: "crosshair",
  account: "search",
  chat: "chat",
  offer: "tag",
  ad: "mega",
  profile: "people",
  simulate: "target",
  predict: "crosshair",
};

export function Ico({
  name,
  size = 18,
  className,
}: {
  name: keyof typeof ICONS | string;
  size?: number;
  className?: string;
}) {
  const d = ICONS[name] ?? "";
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

// ─── Popover shell ───────────────────────────────────────────────────────────
// Opens UPWARD, anchored bottom-left of its trigger. max-h + scroll so 9 rows
// never clip. Mobile: clamps to viewport width (NO bottom sheet — popover everywhere).
function Popover({
  open,
  children,
  className,
  labelledBy,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  if (!open) return null;
  return (
    <div
      role="menu"
      aria-labelledby={labelledBy}
      className={cn(
        "absolute bottom-[calc(100%+12px)] left-0 z-50",
        "min-w-[296px] max-w-[calc(100vw-28px)] max-h-[60vh] overflow-y-auto",
        "rounded-xl border border-white/[0.06] bg-[#211f1d] p-1.5",
        "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        "origin-bottom-left animate-[composer-pop_.14s_ease-out]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function GroupLabel({ children, badge }: { children: React.ReactNode; badge?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground-muted/70">
      {children}
      {badge && (
        <span className="rounded-full border border-border px-1.5 text-[9px] tracking-[0.04em] text-foreground-secondary">
          MARKETING
        </span>
      )}
    </div>
  );
}

// ─── SkillRows — shared by the skill popover AND the `/` slash menu ───────────
export function SkillRows({
  active,
  filter,
  onSelect,
  activeMode = "socials",
}: {
  active: ToolId;
  filter?: string;
  onSelect: (id: ToolId) => void;
  /** Active Audience mode (UX-02 / D-01). Gates the list BEFORE the Creator/Marketing
   *  group partition. Defaults to "socials" so the live Socials render is byte-identical
   *  until 07-04 threads the real mode. */
  activeMode?: SkillMode;
}) {
  const q = (filter ?? "").trim().toLowerCase();
  const match = (s: SkillMeta) =>
    !q || s.label.toLowerCase().includes(q) || s.command.includes(q);
  // Visibility partition (UX-02 / D-01, refine lane): the General verbs are ALWAYS
  // shown in their own group; Creator/Marketing surface only in socials mode. The
  // shared isSkillVisible() keeps this list and the `/` slash menu in lock-step.
  const mode = activeMode ?? "socials";
  const general = SKILLS.filter(
    (s) => s.modes.includes("general") && isSkillVisible(s, mode) && match(s),
  );
  const creator = SKILLS.filter(
    (s) => s.group === "creator" && s.modes.includes("socials") && isSkillVisible(s, mode) && match(s),
  );
  const marketing = SKILLS.filter(
    (s) => s.group === "marketing" && isSkillVisible(s, mode) && match(s),
  );

  const Row = (s: SkillMeta) => (
    <button
      key={s.id}
      type="button"
      role="menuitemradio"
      aria-checked={s.id === active}
      aria-disabled={!s.enabled || undefined}
      disabled={!s.enabled}
      data-skill={s.id}
      onClick={() => {
        if (s.enabled) onSelect(s.id);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        s.enabled
          ? "cursor-pointer hover:bg-[#2b2926]"
          : "cursor-not-allowed opacity-45",
      )}
    >
      <Ico name={SKILL_ICON[s.id]} className="text-foreground-secondary" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] font-medium",
            s.id === active ? "text-foreground bg-white/[0.06]" : "text-foreground",
          )}
        >
          {s.label}
          {s.model === "Max" && (
            <span className="rounded bg-surface-elevated border border-border px-1.5 py-px text-[9px] font-semibold tracking-[0.03em] text-foreground-secondary">
              MAX
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-foreground-muted">{s.desc}</span>
      </span>
      {s.enabled ? (
        <span className="shrink-0 font-mono text-[11px] text-foreground-muted/55">
          {s.command}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-foreground-muted/45">
          soon
        </span>
      )}
      <Ico
        name="check"
        size={16}
        className={cn("text-foreground-secondary", s.id === active ? "opacity-100" : "opacity-0")}
      />
    </button>
  );

  return (
    <>
      <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[11px] text-foreground-muted/45">
        <Ico name="search" size={14} />
        type to filter · ↵ to select
      </div>
      {creator.length > 0 && <GroupLabel>Creator</GroupLabel>}
      {creator.map(Row)}
      {marketing.length > 0 && (
        <>
          <div className="mx-1 my-1.5 h-px bg-white/[0.06]" />
          <GroupLabel badge>Marketing</GroupLabel>
        </>
      )}
      {marketing.map(Row)}
      {/* General verbs — always shown so they stay discoverable from a creator
          context. Divider/label drop when this is the only group (general mode). */}
      {general.length > 0 && (
        <>
          {(creator.length > 0 || marketing.length > 0) && (
            <div className="mx-1 my-1.5 h-px bg-white/[0.06]" />
          )}
          <GroupLabel>General</GroupLabel>
        </>
      )}
      {general.map(Row)}
      {creator.length === 0 && marketing.length === 0 && general.length === 0 && (
        <div className="px-2.5 py-3 text-[12px] text-foreground-muted">No skills match.</div>
      )}
    </>
  );
}

// ─── ModelTag — read-only SIM-1 indicator (the skill decides it) ─────────────
export function ModelTag({ activeTool, className }: { activeTool: ToolId; className?: string }) {
  return (
    <span
      data-testid="active-model-label"
      title="The skill decides the model — Max for video, Flash for text"
      className={cn(
        "inline-flex select-none items-center gap-1.5 px-2 text-[12.5px]",
        "text-foreground-muted",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-foreground-muted" />
      <span className="font-medium">{MODEL_LABEL[activeTool]}</span>
    </span>
  );
}

// ─── ComposerControls — the LEFT cluster ([+] · skill · audience · intent) ────
// "search" added (P11): the Explore-only params popover trigger sits beside the
// audience control; only mounts when activeTool === "explore".
type PopId = "attach" | "skill" | "intent" | "search" | null;

/**
 * Params the Explore "Search" popover passes up to onRunExplore (forwarded to
 * useExploreStream.start by the composer). Structural so the composer threads it
 * straight through (mirrors ExploreStartParams). serendipity is 0..1 (0 = on-niche,
 * 1 = widen beyond niche — the valve, D-06).
 */
export interface ExploreParams {
  niche?: string;
  accounts?: string;
  timeWindow?: string;
  serendipity?: number;
}

export interface ComposerControlsProps {
  activeTool: ToolId;
  onSelectTool: (id: ToolId) => void;

  /** Active Audience mode (UX-02 / D-01) — gates the skill menu. Defaults to
   *  "socials" so the live composer is byte-identical until 07-04 threads the real
   *  mode from the selected audience. */
  activeMode?: SkillMode;

  // Audience identity + switching moved to <AudiencePresence> (P13 fork #3) — the
  // composer's icon-only audience chip retired. These controls no longer take it.

  intent: Intent;
  onIntentChange: (intent: Intent) => void;

  /** Reveal the upload drop zone (the SIM-1 Max Test path). */
  onUploadClick: () => void;

  /**
   * Run an Explore pull from the params popover (P11 / EXPLORE-01). Wired by the
   * composer to useExploreStream.start. The apply button calls this then closes the
   * popover. Optional so non-Explore composers (none today) stay valid.
   * CRITICAL (Pitfall 5): the skill pill is NEVER a submit — only this explicit
   * "Run Explore" apply fires a pull.
   */
  onRunExplore?: (params: ExploreParams) => void;

  className?: string;
}

export function ComposerControls({
  activeTool,
  onSelectTool,
  activeMode = "socials",
  intent,
  onIntentChange,
  onUploadClick,
  onRunExplore,
  className,
}: ComposerControlsProps) {
  const [pop, setPop] = useState<PopId>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Explore params popover local state (P11 / EXPLORE-01, D-06) ─────────────
  // Kept local to ComposerControls; the apply button lifts the values via
  // onRunExplore then closes the popover. serendipity defaults to 0 (on-niche).
  const [exNiche, setExNiche] = useState("");
  const [exAccounts, setExAccounts] = useState("");
  const [exWindow, setExWindow] = useState("today");
  const [exSerendipity, setExSerendipity] = useState(0);

  // Outside-click / Escape closes any open popover.
  useEffect(() => {
    if (!pop) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPop(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPop(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pop]);

  const skill = getSkill(activeTool);

  const toggle = (id: PopId) => setPop((cur) => (cur === id ? null : id));

  // Icon-only control (+, audience, intent) — borderless, quiet.
  const ctl =
    "grid h-[34px] w-[34px] place-items-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-elevated hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11";

  return (
    <div ref={rootRef} className={cn("flex items-center gap-1.5", className)}>
      {/* + attach / upload */}
      <div className="relative">
        <button
          type="button"
          aria-label="Upload or attach"
          aria-haspopup="menu"
          aria-expanded={pop === "attach"}
          onClick={() => toggle("attach")}
          className={ctl}
        >
          <Ico name="plus" />
        </button>
        <Popover open={pop === "attach"}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onUploadClick();
              setPop(null);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#2b2926]"
          >
            <Ico name="video" className="text-foreground-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-foreground">Upload video</span>
              <span className="mt-0.5 block text-[11.5px] text-foreground-muted">
                Runs a full SIM-1 Max Test
              </span>
            </span>
            <span className="shrink-0 rounded border border-white/[0.06] px-1.5 py-px text-[10px] text-foreground-muted/55">
              ⌘U
            </span>
          </button>
          {[
            { icon: "image", label: "Add files or photos" },
            { icon: "camera", label: "Take a screenshot" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              disabled
              aria-disabled
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-left opacity-45"
            >
              <Ico name={o.icon} className="text-foreground-secondary" />
              <span className="flex-1 text-[13.5px] font-medium text-foreground">{o.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-foreground-muted/45">soon</span>
            </button>
          ))}
        </Popover>
      </div>

      {/* Skill pill — the ONE accented, bordered control */}
      <div className="relative">
        <button
          id="composer-skill-pill"
          type="button"
          aria-label={`Skill: ${skill.label}`}
          aria-haspopup="menu"
          aria-expanded={pop === "skill"}
          onClick={() => toggle("skill")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-elevated px-2.5 py-1.5",
            "text-[13.5px] font-medium text-foreground transition-colors hover:border-white/[0.1]",
          )}
        >
          <Ico name={SKILL_ICON[activeTool]} className="text-foreground-secondary" />
          <span>{skill.label}</span>
          <Ico name="chev" size={14} className="text-foreground-muted" />
        </button>
        <Popover open={pop === "skill"} labelledBy="composer-skill-pill">
          <SkillRows
            active={activeTool}
            activeMode={activeMode}
            onSelect={(id) => {
              onSelectTool(id);
              setPop(null);
            }}
          />
        </Popover>
      </div>

      {/* Audience identity + switching live in <AudiencePresence> now (P13 fork #3) —
          the icon-only audience chip retired from this LEFT cluster. */}

      {/* Search — Explore-only params popover (P11 / EXPLORE-01, D-06, UI-SPEC §Surface 4).
          Icon-only borderless control beside the audience picker; mounts ONLY when the
          Explore skill is active. The popover refines niche/accounts/time-window + the
          serendipity valve; "Run Explore" (the popover's ONE terracotta accent) lifts the
          params via onRunExplore then closes. The skill pill is NEVER a submit (Pitfall 5). */}
      {activeTool === "explore" && (
        <div className="relative">
          <button
            type="button"
            aria-label="Search"
            title="Search · refine the Explore pull"
            aria-haspopup="menu"
            aria-expanded={pop === "search"}
            onClick={() => toggle("search")}
            className={cn(ctl, pop === "search" && "text-foreground")}
          >
            <Ico name="search" size={16} />
          </button>
          <Popover open={pop === "search"} className="min-w-[300px]">
            <div className="flex flex-col gap-3 p-2.5">
              {/* Niche or keywords */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">Niche or keywords</span>
                <input
                  type="text"
                  value={exNiche}
                  onChange={(e) => setExNiche(e.target.value)}
                  placeholder="e.g. gym beginners, myth-busting"
                  className="h-[42px] w-full rounded-lg border border-white/[0.05] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-white/[0.1] focus:outline-none"
                />
              </label>

              {/* Accounts */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">Accounts</span>
                <input
                  type="text"
                  value={exAccounts}
                  onChange={(e) => setExAccounts(e.target.value)}
                  placeholder="@handle, @handle"
                  className="h-[42px] w-full rounded-lg border border-white/[0.05] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-white/[0.1] focus:outline-none"
                />
              </label>

              {/* Time window — segmented control */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">Time window</span>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "week", label: "This week" },
                      { id: "month", label: "This month" },
                    ] as const
                  ).map((o) => {
                    const on = exWindow === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setExWindow(o.id)}
                        className={cn(
                          "flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors",
                          on
                            ? "border-border-hover bg-hover text-foreground"
                            : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1]",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Serendipity slider — the widen-beyond-niche valve (D-06). Terracotta
                  active track via accent-color. Range 0..1 (0 = on-niche, 1 = surprise). */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">Serendipity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={exSerendipity}
                  onChange={(e) => setExSerendipity(Number(e.target.value))}
                  aria-label="Serendipity — on-niche to surprise me"
                  className="w-full accent-foreground-muted"
                />
                <div className="flex justify-between text-[11px] text-foreground-muted">
                  <span>On-niche</span>
                  <span>Surprise me</span>
                </div>
                <span className="text-[11px] text-foreground-muted/70">
                  Slide right to widen beyond your niche.
                </span>
              </div>

              {/* Run Explore — the popover's ONE terracotta accent (apply). */}
              <button
                type="button"
                onClick={() => {
                  onRunExplore?.({
                    niche: exNiche.trim() || undefined,
                    accounts: exAccounts.trim() || undefined,
                    timeWindow: exWindow,
                    serendipity: exSerendipity,
                  });
                  setPop(null);
                }}
                className="mt-0.5 rounded-lg bg-action px-3 py-2 text-[13px] font-medium text-action-foreground transition-colors hover:bg-action/90"
              >
                Run Explore
              </button>
            </div>
          </Popover>
        </div>
      )}

      {/* Intent — icon-only, borderless (Grow / Sell segmented popover) */}
      <div className="relative">
        <button
          type="button"
          aria-label={`Intent: ${intent === "sell" ? "Sell" : "Grow"}`}
          title={`Intent · ${intent === "sell" ? "Sell" : "Grow"}`}
          aria-haspopup="menu"
          aria-expanded={pop === "intent"}
          onClick={() => toggle("intent")}
          className={ctl}
        >
          <Ico name={intent === "sell" ? "tag" : "target"} size={16} />
        </button>
        <Popover open={pop === "intent"} className="min-w-[260px]">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] text-foreground-muted/55">
            How should your audience judge this?
          </div>
          <div className="flex gap-1.5 p-1.5">
            {(
              [
                { id: "grow", icon: "target", label: "Grow", sub: "watch · share" },
                { id: "sell", icon: "tag", label: "Sell", sub: "would-buy · price" },
              ] as const
            ).map((o) => {
              const on = intent === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onIntentChange(o.id);
                    setPop(null);
                  }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
                    on
                      ? "border-border-hover bg-hover text-foreground"
                      : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1]",
                  )}
                >
                  <Ico name={o.icon} size={16} />
                  <span className="font-medium">{o.label}</span>
                  <span className={cn("text-[10.5px]", on ? "text-foreground-secondary" : "text-foreground-muted")}>
                    {o.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </Popover>
      </div>
    </div>
  );
}
