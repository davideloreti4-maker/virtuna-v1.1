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
 * Design (flat-warm THEME-06): warm charcoal surfaces, cream text, matte. Premium
 * line-icon SVGs — NO emoji. Popover everywhere (desktop AND mobile — no bottom sheet);
 * popovers open UPWARD with max-height + scroll so 9 skills never clip.
 *
 * The composer surface carries NO accent: the cream send disc is its only bright element,
 * so the verb pill is a quiet filled capsule (no border, no terracotta) and every other
 * control is a bare glyph. The model is a read-only indicator — the SKILL decides it
 * (Test + Ad Creative → SIM-1 Max; everything else → SIM-1 Flash), so it is never a control.
 *
 * Replaces tool-chips.tsx (the old chip row + active-model field).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";

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

// Order mirrors the Phase 3 sketch (Make → Test → Ask), so the verb-grouped popover
// AND the `/` slash menu render in that intent order. Row LABELS under Test/Ask read
// as their verb flavor ("A real video" / "Your account" / "The room") — a "Test" row
// under a "Test" header would be redundant; the underlying skill id + /command are the
// stable SSOT (VERB_BY_TOOL is the id→verb map; SkillRows groups on it).
export const SKILLS: SkillMeta[] = [
  // ── Make — create net-new (Socials/creator). Grouped under the "Make" verb. ──
  { id: "hooks",   label: "Hooks",   desc: "Ranked scroll-stoppers",         command: "/hooks",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "idea",    label: "Ideas",   desc: "Funnel-top idea cards",          command: "/ideas",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "script",  label: "Script",  desc: "Beats + retention markers",      command: "/script",  group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "remix",   label: "Remix",   desc: "Decode a winner → your version", command: "/remix",   group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  { id: "explore", label: "Explore", desc: "Audience-curated discovery",     command: "/explore", group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  // ── Test — judge something real (a video · your own account). ──
  { id: "test",    label: "A real video", desc: "Watch-through + full Read",  command: "/test",    group: "creator",   modes: ["socials"], model: "Max",   enabled: true  },
  { id: "account", label: "Your account", desc: "A Read on your posts",       command: "/account", group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  // ── Ask — converse / probe. ──
  { id: "chat",    label: "The room", desc: "Drop a raw thought",             command: "/chat",    group: "creator",   modes: ["socials"], model: "Flash", enabled: true  },
  // ── Marketing — hidden until enabled (enabled:false → SkillRows never renders them). ──
  { id: "offer",   label: "Offer Validation", desc: "Test a product, price, positioning",  command: "/offer",   group: "marketing", modes: ["socials"], model: "Flash", enabled: false },
  { id: "ad",      label: "Ad Creative",      desc: "Pre-flight an ad, ROAS-framed",       command: "/ad",      group: "marketing", modes: ["socials"], model: "Max",   enabled: false },
  // ── The HORIZONTAL (GSI) verbs — HIDDEN behind HORIZONTAL_ENABLED (owner call 2026-07-13:
  //    the product commits to the creator vertical for MVP). `enabled:false` is the same lever
  //    the marketing rows above use: the pill menu, the `/` slash menu, and Enter-to-select all
  //    filter on `s.enabled`, so a false here closes every composer door at once. The rows,
  //    routes, runners and blocks all STAY — flip the flag to bring them back. ──
  { id: "profile",  label: "Profile",  desc: "Build a SIM from a chat or screenshot", command: "/profile",  group: "creator", modes: ["general"], model: "Flash", enabled: HORIZONTAL_ENABLED },
  { id: "simulate", label: "Simulate", desc: "Run a draft through your audience",      command: "/simulate", group: "creator", modes: ["general"], model: "Flash", enabled: HORIZONTAL_ENABLED },
  { id: "predict",  label: "Predict",  desc: "Analyst-panel scenario read",            command: "/predict",  group: "creator", modes: ["general"], model: "Flash", enabled: HORIZONTAL_ENABLED },
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
  // The verb-chip mark (v6 Room prototype `.vi` ✦) — a 4-point sparkle, the composer's
  // ONE accent glyph (terracotta). Line-icon form (stroked) to stay on the no-emoji system.
  spark: '<path d="M8 3c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z"/>',
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

/**
 * The intent verb each skill sits under (v6 IA — THE-ROOM-HANDOFF §3.5/§7). SSOT for
 * BOTH the chip face AND the Phase 3 verb-grouped popover (SkillRows groups on this):
 *   Make = create net-new · Test = judge something real · Ask = converse / probe.
 * LOCKED mapping — Explore stays under Make (discovery feeds what you make); Account
 * Read stays under Test (it judges something real — your own posts). The General verbs
 * (profile/simulate/predict) keep "Make" here for the chip, but the menu renders them
 * in their own "General" group, not folded into Make. Keep in sync with SKILLS.
 */
export const VERB_BY_TOOL: Record<ToolId, "Make" | "Test" | "Ask"> = {
  test: "Test",
  account: "Test", // Account Read = judge something real (your own posts) — owner-locked
  chat: "Ask",
  idea: "Make",
  hooks: "Make",
  script: "Make",
  remix: "Make",
  explore: "Make", // discovery feeds what you make — owner-locked under Make
  offer: "Make",
  ad: "Make",
  profile: "Make",
  simulate: "Make",
  predict: "Make",
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
// Opens UPWARD, anchored bottom-left of its trigger. PORTALED to <body> with
// fixed positioning (mirrors <AudiencePresence>) so the upward popover is NOT
// clipped by the composer dock's `overflow-hidden` rounded-corner clip — the tall
// skill menu would otherwise lose its top rows. max-h + scroll caps the height;
// position is pinned above the trigger and kept in sync on scroll/resize.
// NOTE: because it lives outside the controls root, the host's outside-click
// handler must exclude it via `menuRef` (else the mousedown closes it before a
// row's click fires).
function Popover({
  open,
  anchorRef,
  menuRef,
  children,
  className,
  labelledBy,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      // Anchor bottom-left of the trigger, 12px gap, growing upward.
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 12 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-labelledby={labelledBy}
      style={{ left: pos?.left ?? 0, bottom: pos?.bottom ?? 0 }}
      className={cn(
        "fixed z-[60]",
        "min-w-[296px] max-w-[calc(100vw-28px)] max-h-[60vh] overflow-y-auto",
        "rounded-xl border border-white/[0.06] bg-surface-elevated p-1.5",
        "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        "origin-bottom-left animate-[composer-pop_.14s_ease-out]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-muted/60">
      {children}
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
  /** Active Audience mode (UX-02 / D-01). Gates the list BEFORE the Make/Test/Ask verb
   *  partition (socials) vs the General group. Defaults to "socials". */
  activeMode?: SkillMode;
}) {
  const q = (filter ?? "").trim().toLowerCase();
  const match = (s: SkillMeta) =>
    !q || s.label.toLowerCase().includes(q) || s.command.includes(q);
  const mode = activeMode ?? "socials";
  // Phase 3 (v6 IA): the Socials skills collapse under three INTENT verbs — Make
  // (create net-new) · Test (judge something real) · Ask (converse). VERB_BY_TOOL is
  // the id→verb SSOT the menu groups on. Disabled skills (Offer/Ad) are HIDDEN until
  // enabled (`s.enabled` filter — no "coming soon" rows). The three General verbs keep
  // their own always-visible "General" group so they stay discoverable from a creator
  // context. isSkillVisible() keeps this list + the `/` slash menu in lock-step.
  const socials = SKILLS.filter(
    (s) => s.modes.includes("socials") && s.enabled && isSkillVisible(s, mode) && match(s),
  );
  const make = socials.filter((s) => VERB_BY_TOOL[s.id] === "Make");
  const test = socials.filter((s) => VERB_BY_TOOL[s.id] === "Test");
  const ask = socials.filter((s) => VERB_BY_TOOL[s.id] === "Ask");
  const general = SKILLS.filter(
    (s) => s.modes.includes("general") && s.enabled && isSkillVisible(s, mode) && match(s),
  );
  const hasSocials = make.length + test.length + ask.length > 0;

  const Row = (s: SkillMeta) => {
    const isActive = s.id === active;
    return (
      <button
        key={s.id}
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        aria-disabled={!s.enabled || undefined}
        disabled={!s.enabled}
        data-skill={s.id}
        onClick={() => {
          if (s.enabled) onSelect(s.id);
        }}
        className={cn(
          // Full-row surface — active is a persistent subtle fill (was a broken
          // partial bar painted behind just the label span); hover is a lighter tint.
          "group/row flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-100",
          !s.enabled && "cursor-not-allowed opacity-45",
          s.enabled && !isActive && "cursor-pointer hover:bg-white/[0.035]",
          s.enabled && isActive && "cursor-pointer bg-white/[0.06]",
        )}
      >
        <Ico
          name={SKILL_ICON[s.id]}
          className={cn(
            "shrink-0 transition-colors",
            isActive
              ? "text-foreground"
              : "text-foreground-secondary group-hover/row:text-foreground",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium leading-tight text-foreground">
            {s.label}
            {s.model === "Max" && (
              <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-[8.5px] font-semibold uppercase leading-none tracking-[0.06em] text-foreground-muted">
                MAX
              </span>
            )}
          </span>
          <span className="mt-[3px] block truncate text-[11.5px] leading-tight text-foreground-muted">
            {s.desc}
          </span>
        </span>
        {/* Right rail — /command (or "soon"), then a reserved check slot so the
            commands stay right-aligned whether or not a row carries the check. */}
        {s.enabled ? (
          <span
            className={cn(
              "shrink-0 font-mono text-[11px] tracking-tight transition-colors",
              isActive
                ? "text-foreground-secondary"
                : "text-foreground-muted/45 group-hover/row:text-foreground-muted/70",
            )}
          >
            {s.command}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-foreground-muted/45">
            soon
          </span>
        )}
        <Ico
          name="check"
          size={15}
          className={cn(
            "shrink-0 text-foreground transition-opacity",
            isActive ? "opacity-100" : "opacity-0",
          )}
        />
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5 text-[11px] text-foreground-muted/45">
        <Ico name="search" size={13} className="text-foreground-muted/40" />
        <span>type to filter</span>
        <span className="text-foreground-muted/25">·</span>
        <span>↵ to select</span>
      </div>
      <div className="mx-1 mb-1 h-px bg-white/[0.05]" />
      {/* Make / Test / Ask — the three intent verbs (Socials mode). Section headers
          alone separate them (no dividers); each row is a skill under that verb. */}
      {make.length > 0 && <GroupLabel>Make</GroupLabel>}
      {make.map(Row)}
      {test.length > 0 && <GroupLabel>Test</GroupLabel>}
      {test.map(Row)}
      {ask.length > 0 && <GroupLabel>Ask</GroupLabel>}
      {ask.map(Row)}
      {/* General verbs — always shown so they stay discoverable from a creator
          context. A divider separates them from the verb sections; in general mode
          (no Socials skills) they are the only group. */}
      {general.length > 0 && (
        <>
          {hasSocials && <div className="mx-1 my-1.5 h-px bg-white/[0.05]" />}
          <GroupLabel>General</GroupLabel>
        </>
      )}
      {general.map(Row)}
      {!hasSocials && general.length === 0 && (
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
        "inline-flex select-none items-center px-1 text-[12.5px]",
        className,
      )}
    >
      {/* "SIM-1" is the constant; the tier is what changes — so the tier reads cream
          and the family name recedes (mirrors "Haiku 4.5 Extended": bright model, muted mode).
          The space rides INSIDE the first span (a flex gap is invisible to textContent), and
          whitespace-pre keeps flex layout from collapsing that trailing space away. */}
      <span className="whitespace-pre text-foreground-muted">{"SIM-1 "}</span>
      <span className="font-medium text-foreground-secondary">{getSkill(activeTool).model}</span>
    </span>
  );
}

// ─── ComposerControls — the LEFT cluster ([+] · skill · audience · intent) ────
// "search" added (P11): the Explore-only params popover trigger sits beside the
// audience control; only mounts when activeTool === "explore".
type PopId = "skill" | "search" | null;

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
  //
  // Task C (v6 clean composer): the intent control retired too — intent is now a
  // property of the audience's goal (`goal_intent`), never a per-run composer toggle
  // (THE-ROOM-HANDOFF §3.5). And the `+` attach retired — Test absorbs the upload
  // (selecting Test reveals the drop zone in the composer host), so `onUploadClick`
  // is gone. The chip is now a VERB chip (Make / Test / Ask) over the same SkillRows.

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
  onRunExplore,
  className,
}: ComposerControlsProps) {
  const [pop, setPop] = useState<PopId>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The open popover is PORTALED to <body> (see Popover) so it lives outside
  // rootRef — the outside-click handler below must also spare `menuRef`, else the
  // mousedown on a menu row closes the popover before the row's click fires.
  const menuRef = useRef<HTMLDivElement>(null);
  // One trigger ref per control so the portaled popover can anchor above it.
  const skillRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);

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
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setPop(null);
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
      {/* Verb chip (v6) — Make / Test / Ask over the same SkillRows menu. The composer's
          ONE accented control: a terracotta ✦ spark + the verb + a chevron. Opens the skill
          popover, now grouped under the same three verbs (Phase 3). aria-label keeps
          "Skill: …" so the picker stays discoverable to assistive tech + the tests reach it. */}
      <div className="relative">
        <button
          ref={skillRef}
          id="composer-skill-pill"
          type="button"
          aria-label={`Skill: ${skill.label}`}
          aria-haspopup="menu"
          aria-expanded={pop === "skill"}
          onClick={() => toggle("skill")}
          className={cn(
            "inline-flex h-[34px] items-center gap-1.5 rounded-full bg-white/[0.05] px-3",
            "text-[13.5px] font-medium text-foreground transition-colors hover:bg-white/[0.08]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 pointer-coarse:h-11",
          )}
        >
          <Ico name="spark" size={15} className="text-foreground-muted" />
          <span>{VERB_BY_TOOL[activeTool]}</span>
          <Ico name="chev" size={13} className="text-foreground-muted" />
        </button>
        <Popover open={pop === "skill"} anchorRef={skillRef} menuRef={menuRef} labelledBy="composer-skill-pill">
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
            ref={searchRef}
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
          <Popover open={pop === "search"} anchorRef={searchRef} menuRef={menuRef} className="min-w-[300px]">
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

    </div>
  );
}
