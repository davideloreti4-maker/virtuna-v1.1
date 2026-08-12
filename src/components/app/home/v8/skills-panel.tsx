"use client";

/**
 * The v8 skills panel — discovery, never obligation (spec §2 v7 revision).
 * Built from the REAL registry (SKILLS + VERB_BY_TOOL); the mock's row list is a
 * sketch (handoff §5) and its Make/Test/Research grouping is NOT used — the shipped
 * verbs are Make/Test (+General), with the default lane pinned above them.
 *
 * Desktop: two-pane popover (Perplexity reference) — list left, preview right, Use
 * arms the skill (tag in field + instruction placeholder).
 * Mobile: the same content as a bottom sheet; a row tap arms directly.
 *
 * ── The two things this panel has to teach (owner ruling 2026-08-11) ──────────────
 * It used to teach them with a two-line paragraph across the top. The owner called
 * that "not a clean solution", and it was: a disclaimer is what you write when the
 * interface won't say it for you. Both facts are structural now.
 *
 *  1. "You don't have to pick — it routes for you."  →  AUTO ROUTING is the first row,
 *     above the groups, and it is a SWITCH that reads on whenever nothing is armed. The
 *     default state is visibly a setting that is already on, not an absence.
 *  2. "You can pick with /."  →  every skill prints its own command. The previewed row
 *     shows it in the list and the preview pane sets it beside the name, so the command
 *     is on screen the whole time you are browsing. Nobody has to be told.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Ico,
  SKILLS,
  SKILL_ICON,
  VERB_BY_TOOL,
  isSkillVisible,
  type SkillMeta,
  type SkillMode,
  type ToolId,
} from "@/components/app/home/composer-controls";
import { Button } from "@/components/ui/button";

// v8 copy — owner reviews before launch (handoff §5). One honest paragraph per skill:
// what it does with what you give it, in the creator's words. Total Record so a new
// registry row cannot ship without a promise (compile error, same contract as
// PLACEHOLDER_BY_TOOL).
export const PROMISE_BY_TOOL: Record<ToolId, string> = {
  hooks:
    "Openers that stop the scroll. Give me a topic — or nothing at all — and I'll write ranked hook lines your audience would actually stop for.",
  idea: "Funnel-top ideas for your niche, ranked — cards you can take straight to a script.",
  script:
    "A beat-by-beat script with retention markers: where to hold, where to cut, where they'd drop.",
  remix:
    "Take a proven video — paste any link — and I'll decode why it worked, then rebuild its format for your niche.",
  explore: "See what's breaking out — in your niche, or any competitor's.",
  test: "Upload a real video or paste a link. SIM-1 Max watches it the way your audience would and hands back the full read.",
  account: "A read on your own posts — what's landing, what isn't, and why.",
  // The default lane's promise, rewritten for its AUTO identity. Honest about the seam:
  // the chat agent calls ideas / hooks / scripts as real tools (skill-dispatch.ts), and
  // answers in its own voice when the ask isn't one of them.
  chat: "Where you already are. Type in plain words and I'll run whatever the ask needs — ideas, hooks, a script — or just answer, when it needs none of them.",
  offer: "Test a product, a price, a positioning — before you build the funnel.",
  ad: "Pre-flight an ad concept, ROAS-framed, before you spend.",
  profile: "Build a SIM of anyone from a chat export or screenshot.",
  simulate: "Run a draft through your audience and hear who stops.",
  predict: "Put a scenario in front of the analyst panel and read the spread.",
};

/**
 * The default lane. `chat` is the registry id for "no skill armed" — it is literally
 * `DEFAULT_TOOL` in composer.tsx, and `armedSkill` is null while it is active — so listing
 * it as a peer under "Ask" was a taxonomy claim the router does not back (owner 2026-08-11:
 * "chat shouldn't be a skill right?"). It leads the panel as AUTO instead, which is what it
 * has always been: the state you are in until you pick, and the state you return to.
 *
 * The registry itself is untouched. `SKILLS` / `VERB_BY_TOOL` are the SSOT the legacy `/`
 * menu also reads, and flag-off must stay byte-identical — so this renaming lives here.
 */
const AUTO_ID: ToolId = "chat";
// "Auto routing", not "Auto" (owner 2026-08-11) — the noun says what is automatic. Its
// subline is gone with it: a switch labelled "Auto routing" does not need a sentence under
// it, and the preview pane still carries the full promise for anyone who wants it.
const AUTO_LABEL = "Auto routing";

// `Ask` is gone from the group list along with it: chat was its only member, so the verb
// now has nothing to name. Make / Test carry every skill a creator can actually arm.
const GROUPS: { label: string; verb: "Make" | "Test" | "Ask" }[] = [
  { label: "Make", verb: "Make" },
  { label: "Test", verb: "Test" },
  { label: "Ask", verb: "Ask" },
];

function visibleSkills(mode: SkillMode): SkillMeta[] {
  return SKILLS.filter((s) => s.enabled && isSkillVisible(s, mode));
}

const labelOf = (s: SkillMeta) => (s.id === AUTO_ID ? AUTO_LABEL : s.label);
/** Auto has no command — you reach it by disarming, not by typing a word for it. */
const commandOf = (s: SkillMeta) => (s.id === AUTO_ID ? null : s.command);

/**
 * The routing switch. A switch, not a check (owner 2026-08-11): routing is a STATE the
 * product is in, not one more row you happened to select — and "on" is a truer reading of
 * the default than a tick that looks like a selection among peers.
 * Neutral cream throughout; a switch is exactly the kind of chrome the accent lock forbids.
 */
function RoutingSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors",
        on ? "bg-white/[0.22]" : "bg-white/[0.07]",
      )}
    >
      <span
        className={cn(
          "absolute h-[13px] w-[13px] rounded-full transition-transform duration-150",
          on ? "translate-x-[14px] bg-foreground" : "translate-x-[3px] bg-foreground-muted",
        )}
      />
    </span>
  );
}

function MaxBadge() {
  return (
    <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-micro font-semibold uppercase leading-none tracking-[0.06em] text-foreground-muted">
      MAX
    </span>
  );
}

export function SkillPill({
  open,
  onClick,
  anchorRef,
}: {
  open: boolean;
  onClick: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={anchorRef}
      type="button"
      data-testid="composer-skill-pill"
      aria-label="Browse skills"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        // The ROOMY pill — an explicit owner call (v8 decision 10: cramped chip rejected,
        // bare glyph rejected). Mock §3 `.skillpill`: 13px side padding, 10% edge.
        "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-white/[0.10] px-[13px]",
        "text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        "pointer-coarse:h-11",
      )}
    >
      {/* A catalogue mark, not a sparkle (owner 2026-08-11: "find a better icon"). The old ✦
          was decoration — it said "AI", which the user already knows, and its own source
          comment still called it the composer's terracotta accent glyph from a retired
          palette. This says what the pill actually opens: the set of everything available. */}
      <Ico name="grid" size={15} />
      <Ico name="chev" size={12} className="text-foreground-muted" />
    </button>
  );
}

export function SkillsPanel({
  open,
  onClose,
  active,
  activeMode,
  onUse,
  anchorRef,
  placeAboveRef,
}: {
  open: boolean;
  onClose: () => void;
  active: ToolId;
  activeMode: SkillMode;
  onUse: (id: ToolId) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Element the desktop popover sits ABOVE (the composer's field region). Anchoring to the
   *  pill alone dropped the panel's bottom edge INTO the box, covering the field it serves —
   *  measured 2026-08-09. Falls back to `anchorRef`. */
  placeAboveRef?: React.RefObject<HTMLElement | null>;
}) {
  const isWide = useMediaQuery("(min-width: 640px)");
  const [previewId, setPreviewId] = useState<ToolId>(active);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  // Re-seed the preview on the armed skill every time the panel opens.
  useEffect(() => {
    if (open) setPreviewId(active);
  }, [open, active]);

  // Escape + outside-mousedown close (the anchor's own click toggles, so exclude it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  // Desktop anchoring — the panel sits ABOVE the whole composer box (never over the field),
  // left-aligned with it, growing upward. Portaled to <body> so the dock's overflow clip
  // can't cut it.
  useEffect(() => {
    if (!open || !isWide) return;
    const place = () => {
      const r = (placeAboveRef?.current ?? anchorRef.current)?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: Math.max(12, r.left), bottom: window.innerHeight - r.top + 10 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, isWide, anchorRef, placeAboveRef]);

  if (!open || typeof document === "undefined") return null;

  const skills = visibleSkills(activeMode);
  const auto = skills.find((s) => s.id === AUTO_ID) ?? null;
  const general = skills.filter((s) => s.id !== AUTO_ID && s.modes.includes("general"));
  const socials = skills.filter((s) => s.id !== AUTO_ID && !s.modes.includes("general"));
  const preview = SKILLS.find((s) => s.id === previewId) ?? auto ?? skills[0]!;

  const listRow = (s: SkillMeta, direct: boolean) => {
    const selected = !direct && s.id === preview.id;
    const cmd = commandOf(s);
    return (
      <button
        key={s.id}
        type="button"
        data-skill={s.id}
        onClick={() => (direct ? onUse(s.id) : setPreviewId(s.id))}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
          selected ? "bg-white/[0.07]" : "hover:bg-white/[0.035]",
        )}
      >
        <Ico
          name={SKILL_ICON[s.id]}
          size={15}
          className={cn(
            "shrink-0 transition-colors",
            selected ? "text-foreground" : "text-foreground-muted",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-reading font-medium text-foreground">
            {labelOf(s)}
          </span>
          {direct && (
            <span className="mt-[2px] block text-label leading-snug text-foreground-muted">
              {s.desc}
            </span>
          )}
        </span>
        {s.model === "Max" && <MaxBadge />}
        {/* Every row carries its command on mobile, where the sheet is full-width. On desktop
            only the SELECTED row does — eight commands stacked in a 270px column would be a
            second list competing with the first, but one, moving with the selection, teaches
            the same thing without the noise. */}
        {(direct || selected) && cmd && (
          <span className="shrink-0 font-mono text-micro text-foreground-muted">{cmd}</span>
        )}
      </button>
    );
  };

  /**
   * AUTO ROUTING — pinned above the groups, and the panel's answer to "do I have to pick
   * one?". It is a real switch: clicking it turns routing back on, which is exactly
   * `onUse(chat)` — arming the default lane IS disarming whatever was armed. So unlike the
   * skill rows it acts on both viewports rather than only seeding the desktop preview; a
   * visible switch that did nothing until you pressed "Use" would be a lie.
   */
  const autoOn = active === AUTO_ID;
  const autoRow = () =>
    auto && (
      <div className="border-b border-white/[0.06] pb-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={autoOn}
          data-skill={auto.id}
          data-auto-row=""
          onClick={() => onUse(auto.id)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left transition-colors",
            "hover:bg-white/[0.035]",
          )}
        >
          <Ico
            name="spark"
            size={15}
            className={cn("shrink-0", autoOn ? "text-foreground" : "text-foreground-muted")}
          />
          <span className="min-w-0 flex-1 truncate text-reading font-medium text-foreground">
            {AUTO_LABEL}
          </span>
          <RoutingSwitch on={autoOn} />
        </button>
      </div>
    );

  const groupedList = (direct: boolean) => (
    <>
      {autoRow()}
      {GROUPS.map(({ label, verb }) => {
        const rows = socials.filter((s) => VERB_BY_TOOL[s.id] === verb);
        if (rows.length === 0) return null;
        return (
          <div key={verb}>
            <div className="px-2.5 pb-1 pt-3 text-micro font-semibold uppercase tracking-[0.1em] text-foreground-muted/70">
              {label}
            </div>
            {rows.map((s) => listRow(s, direct))}
          </div>
        );
      })}
      {general.length > 0 && (
        <div>
          <div className="px-2.5 pb-1 pt-3 text-micro font-semibold uppercase tracking-[0.1em] text-foreground-muted/70">
            General
          </div>
          {general.map((s) => listRow(s, direct))}
        </div>
      )}
    </>
  );

  if (!isWide) {
    return createPortal(
      // The dialog role lives on the SHEET itself, not a wrapper — a zero-height
      // wrapper around fixed children reads as "hidden" to visibility checks.
      <>
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40" onMouseDown={onClose} />
        <div
          ref={panelRef}
          data-testid="skills-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Skills"
          className="ambient-room-in fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[78dvh] flex-col rounded-t-2xl border border-b-0 border-white/[0.10] bg-surface-elevated px-2.5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-1.5 h-1 w-[34px] shrink-0 rounded-full bg-white/[0.14]" />
          <div className="min-h-0 flex-1 overflow-y-auto pb-1">{groupedList(true)}</div>
        </div>
      </>,
      document.body,
    );
  }

  const previewCmd = commandOf(preview);

  return createPortal(
    <div
      ref={panelRef}
      data-testid="skills-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Skills"
      style={{ left: pos?.left ?? 0, bottom: pos?.bottom ?? 0 }}
      className={cn(
        "ambient-room-in fixed z-[var(--z-modal)] flex w-[600px] max-w-[calc(100vw-28px)] flex-col overflow-hidden",
        "rounded-lg border border-white/[0.10] bg-surface-elevated",
        "shadow-[0_16px_40px_rgba(0,0,0,0.4)]",
      )}
    >
      <div className="flex min-h-0">
        <div className="flex max-h-[430px] w-[47%] flex-col border-r border-white/[0.06]">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{groupedList(false)}</div>
        </div>
        {/* The preview pane (mock §3): visual · name · command · one-paragraph promise · Use.
            The tile stands in for the mock's illustration slot — the skill's own mark at
            figure scale, never a fabricated screenshot. */}
        <div className="flex min-h-[320px] flex-1 flex-col p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
            <Ico
              name={preview.id === AUTO_ID ? "spark" : SKILL_ICON[preview.id]}
              size={20}
              className="text-foreground-secondary"
            />
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-title font-medium text-foreground">{labelOf(preview)}</span>
            {preview.model === "Max" && <MaxBadge />}
            {/* Half of the owner's ask, said by the interface instead of about it: every
                skill wears the command that arms it from the keyboard. */}
            {previewCmd && (
              <span className="rounded-[5px] bg-white/[0.05] px-1.5 py-px font-mono text-caption text-foreground-secondary">
                {previewCmd}
              </span>
            )}
          </div>
          <p className="mt-2.5 text-body leading-relaxed text-foreground-secondary">
            {PROMISE_BY_TOOL[preview.id]}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <span className="text-caption text-foreground-muted">
              Runs on SIM-1 {preview.model ?? "Flash"}
            </span>
            <Button variant="primary" size="sm" onClick={() => onUse(preview.id)}>
              Use
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
