"use client";

/**
 * Home empty-state starter (UX-05 / D-04) — split into two independently-placed
 * pieces so the quick actions can lead INTO the composer while the first-run demo
 * stays a quiet footer beneath it:
 *
 *   - HomeQuickActions — the QUICK-ACTIONS grid: the highest-value creator
 *     jobs-to-be-done, each wired to a composer skill via `onQuickAction(tool)` →
 *     handleUserSelectTool. The model (QUICK_ACTIONS) is the single source: one
 *     entry = one card = one skill. Cards read as an ACTION the creator wants
 *     ("Write scroll-stopping hooks"), not the internal skill name — the skill id
 *     stays the stable wiring key. Rendered ABOVE the composer on the empty home.
 *
 *   - HomeFirstRunDemo — the one-tap, show-once first-run demo: "See it in action"
 *     POSTs a small CANNED chat fixture to /api/tools/profile (the cold-start wow,
 *     no chat-export friction — VISION §15.5), then reloads the open thread so the
 *     profile-read card surfaces. "Dismiss" is a muted text link. A localStorage
 *     flag (`numen.home.demo.seen`) hides the demo on the NEXT mount — set on first
 *     run OR on Dismiss. Only the demo is gated by the flag; the grid always shows.
 *
 * Matte, NO accent (dosage rule) — the single liveness dot in the presence is the
 * only sanctioned accent on the surface. Line-icons reuse the composer's SSOT set.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Ico, type ToolId } from "./composer-controls";

/** Show-once localStorage flag for the first-run demo (D-04 — single-device is acceptable). */
const DEMO_SEEN_KEY = "numen.home.demo.seen";

/**
 * The quick-actions model — the valuable creator jobs surfaced on a fresh thread.
 * Ordered by how a creator's week actually flows: idea → hook → script → remix,
 * then the two "judge something real" reads (a video · your own posts). Each `tool`
 * maps to a real composer skill (see SKILLS in composer-controls); selecting a card
 * arms that skill's flow on the active audience. `icon` reuses the composer's
 * line-icon SSOT so the home matches the skill menu.
 */
interface QuickAction {
  tool: ToolId;
  icon: string;
  /** Action-phrased label — what the creator gets, not the internal skill name. */
  title: string;
  /** One-line proof of the payoff. */
  desc: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { tool: "idea",    icon: "bulb",      title: "Get content ideas",           desc: "Fresh angles for your niche" },
  { tool: "hooks",   icon: "anchor",    title: "Write scroll-stopping hooks", desc: "Ranked strongest-first" },
  { tool: "script",  icon: "doc",       title: "Script a video",              desc: "Beats + retention markers" },
  { tool: "remix",   icon: "shuffle",   title: "Remix a viral video",         desc: "Decode a winner → your version" },
  { tool: "test",    icon: "crosshair", title: "Test a video",                desc: "Watch-through + full audience Read" },
  { tool: "account", icon: "search",    title: "Read my recent posts",        desc: "See what's landing, and why" },
];

/**
 * A short, believable chat fixture run through Profile→Read on first tap. Static
 * in-repo string (no user input) — the /api/tools/profile route re-validates + caps
 * it regardless (T-07-06-01).
 */
const DEMO_FIXTURE = [
  "Maya: ok I finally cancelled the gym lol",
  "Jordan: noooo you were doing so well",
  "Maya: I know but I just never go after work, I'm dead by 6",
  "Jordan: fair. honestly same. the morning people scare me",
  "Maya: maybe I just do the home workout thing instead",
  "Jordan: the 15 min ones? those actually slap",
  "Maya: yeah and no commute excuse. starting monday (for real this time)",
].join("\n");

function readDemoSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markDemoSeen(): void {
  try {
    window.localStorage.setItem(DEMO_SEEN_KEY, "1");
  } catch {
    // localStorage unavailable (private mode) — degrade gracefully, still hide for session.
  }
}

const CARD_CLASS =
  "group flex items-start gap-3 rounded-[12px] border border-white/[0.06] bg-surface-sunken px-4 py-4 " +
  "text-left transition-[colors,transform] duration-150 hover:border-white/[0.10] hover:bg-surface-elevated " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20";

export interface HomeQuickActionsProps {
  /** Launch a quick action's skill flow (wired to handleUserSelectTool). */
  onQuickAction: (tool: ToolId) => void;
  className?: string;
}

/**
 * The creator quick-actions grid — always rendered on the empty home (only the
 * first-run demo is show-once). Two columns ≥sm, one column on mobile. Sits ABOVE
 * the composer so the actions read as the on-ramp INTO the field.
 */
export function HomeQuickActions({ onQuickAction, className }: HomeQuickActionsProps) {
  return (
    <div className={cn("grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2", className)}>
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.tool}
          type="button"
          onClick={() => onQuickAction(action.tool)}
          aria-label={action.title}
          className={CARD_CLASS}
        >
          <span className="mt-px shrink-0 text-foreground-secondary transition-colors group-hover:text-foreground">
            <Ico name={action.icon} size={18} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px] font-medium leading-snug text-foreground">
              {action.title}
            </span>
            <span className="truncate text-[12.5px] leading-snug text-foreground-muted">
              {action.desc}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export interface HomeFirstRunDemoProps {
  /** Fired after the first-run demo POST lands so the host can reload the open thread. */
  onDemoComplete?: () => void;
  className?: string;
}

/**
 * The one-tap, show-once first-run demo. Renders nothing once the localStorage flag
 * is consumed (first run OR Dismiss). A quiet footer beneath the composer — never a
 * gate — so the empty home reads greeting → actions → composer → (optional) demo.
 */
export function HomeFirstRunDemo({ onDemoComplete, className }: HomeFirstRunDemoProps) {
  // Gate the demo behind a mounted flag so server + first client render agree
  // (localStorage is client-only — avoids a hydration mismatch on the demo block).
  const [mounted, setMounted] = useState(false);
  const [demoSeen, setDemoSeen] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setDemoSeen(readDemoSeen());
    setMounted(true);
  }, []);

  const handleSeeItInAction = useCallback(async () => {
    if (running) return;
    setRunning(true);
    // Set the show-once flag immediately so a reload never re-shows it, even if the
    // POST is slow / the user navigates away mid-run.
    markDemoSeen();
    setDemoSeen(true);
    try {
      await fetch("/api/tools/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", text: DEMO_FIXTURE }),
      });
      onDemoComplete?.();
    } catch {
      // Best-effort cold-start demo — a failed POST still consumes the show-once flag.
    } finally {
      setRunning(false);
    }
  }, [running, onDemoComplete]);

  const handleDismiss = useCallback(() => {
    markDemoSeen();
    setDemoSeen(true);
  }, []);

  if (!mounted || demoSeen) return null;

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <button
        type="button"
        onClick={handleSeeItInAction}
        disabled={running}
        className="rounded-lg bg-action px-3 py-2 text-[13px] font-medium text-action-foreground transition-colors hover:bg-action/90 disabled:opacity-60"
      >
        See it in action
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-[12px] font-normal text-foreground-muted transition-colors hover:text-foreground-secondary"
      >
        Dismiss
      </button>
    </div>
  );
}
