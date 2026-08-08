"use client";

/**
 * The v8 skills panel — discovery, never obligation (spec §2 v7 revision).
 * Built from the REAL registry (SKILLS + VERB_BY_TOOL); the mock's row list is a
 * sketch (handoff §5) and its Make/Test/Research grouping is NOT used — the shipped
 * verbs are Make/Test/Ask (+General). Taxonomy naming is an open owner call (§7.6).
 *
 * Desktop: two-pane popover (Perplexity reference) — list left, preview right, Use
 * arms the skill (tag in field + instruction placeholder).
 * Mobile: the same content as a bottom sheet; a row tap arms directly.
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
  chat: "Ask anything in your context — your niche, your audience, an idea you're weighing.",
  offer: "Test a product, a price, a positioning — before you build the funnel.",
  ad: "Pre-flight an ad concept, ROAS-framed, before you spend.",
  profile: "Build a SIM of anyone from a chat export or screenshot.",
  simulate: "Run a draft through your audience and hear who stops.",
  predict: "Put a scenario in front of the analyst panel and read the spread.",
};

const GROUPS: { label: string; verb: "Make" | "Test" | "Ask" }[] = [
  { label: "Make", verb: "Make" },
  { label: "Test", verb: "Test" },
  { label: "Ask", verb: "Ask" },
];

function visibleSkills(mode: SkillMode): SkillMeta[] {
  return SKILLS.filter((s) => s.enabled && isSkillVisible(s, mode));
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
        "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] px-3",
        "text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        "pointer-coarse:h-11",
      )}
    >
      <Ico name="spark" size={15} />
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
}: {
  open: boolean;
  onClose: () => void;
  active: ToolId;
  activeMode: SkillMode;
  onUse: (id: ToolId) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
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

  // Desktop anchoring — bottom-left of the trigger, growing upward (composer-controls
  // Popover math: portaled to <body> so the dock's overflow clip can't cut it).
  useEffect(() => {
    if (!open || !isWide) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: Math.max(12, r.left - 8), bottom: window.innerHeight - r.top + 12 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, isWide, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  const skills = visibleSkills(activeMode);
  const general = skills.filter((s) => s.modes.includes("general"));
  const socials = skills.filter((s) => !s.modes.includes("general"));
  const preview = SKILLS.find((s) => s.id === previewId) ?? skills[0]!;

  const listRow = (s: SkillMeta, direct: boolean) => (
    <button
      key={s.id}
      type="button"
      data-skill={s.id}
      onClick={() => (direct ? onUse(s.id) : setPreviewId(s.id))}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors",
        !direct && s.id === preview.id
          ? "bg-white/[0.10] ring-1 ring-inset ring-white/[0.10]"
          : "hover:bg-white/[0.035]",
      )}
    >
      <Ico name={SKILL_ICON[s.id]} size={15} className="shrink-0 text-foreground-secondary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-reading font-medium text-foreground">{s.label}</span>
        {direct && (
          <span className="mt-[2px] block text-label leading-snug text-foreground-muted">
            {s.desc}
          </span>
        )}
      </span>
      {s.model === "Max" && (
        <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-micro font-semibold uppercase leading-none tracking-[0.06em] text-foreground-muted">
          MAX
        </span>
      )}
    </button>
  );

  const groupedList = (direct: boolean) => (
    <>
      {GROUPS.map(({ label, verb }) => {
        const rows = socials.filter((s) => VERB_BY_TOOL[s.id] === verb);
        if (rows.length === 0) return null;
        return (
          <div key={verb}>
            <div className="px-2.5 pb-1 pt-2.5 text-micro font-semibold uppercase tracking-[0.1em] text-foreground-muted/60">
              {label}
            </div>
            {rows.map((s) => listRow(s, direct))}
          </div>
        );
      })}
      {general.length > 0 && (
        <div>
          <div className="px-2.5 pb-1 pt-2.5 text-micro font-semibold uppercase tracking-[0.1em] text-foreground-muted/60">
            General
          </div>
          {general.map((s) => listRow(s, direct))}
        </div>
      )}
      {/* v8 copy — owner reviews before launch (handoff §5). */}
      <p className="px-2.5 pb-1 pt-3 text-center text-label text-foreground-muted">
        Or just type — Maven routes it.
      </p>
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
          className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] max-h-[78dvh] overflow-y-auto rounded-t-[22px] border border-b-0 border-white/[0.10] bg-surface-sunken px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-2 h-1 w-[34px] rounded-full bg-surface-elevated" />
          {groupedList(true)}
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      data-testid="skills-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Skills"
      style={{ left: pos?.left ?? 0, bottom: pos?.bottom ?? 0 }}
      className={cn(
        "fixed z-[var(--z-modal)] flex w-[560px] max-w-[calc(100vw-28px)] overflow-hidden",
        "rounded-2xl border border-white/[0.10] bg-surface-elevated",
        "shadow-[0_16px_40px_rgba(0,0,0,0.4)]",
      )}
    >
      <div className="max-h-[420px] w-[46%] overflow-y-auto border-r border-white/[0.06] p-2">
        {groupedList(false)}
      </div>
      <div className="flex min-h-[300px] flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-reading font-semibold text-foreground">
          <Ico name={SKILL_ICON[preview.id]} size={15} className="text-foreground-secondary" />
          {preview.label}
          {preview.model === "Max" && (
            <span className="rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-micro font-semibold uppercase leading-none tracking-[0.06em] text-foreground-muted">
              MAX
            </span>
          )}
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-foreground-secondary">
          {PROMISE_BY_TOOL[preview.id]}
        </p>
        <div className="mt-auto self-end pt-4">
          <Button variant="primary" size="sm" onClick={() => onUse(preview.id)}>
            Use
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
