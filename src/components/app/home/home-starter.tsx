"use client";

/**
 * THE STARTER CONTRACT — the ONE empty state, for every skill.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Before this file, the empty home had FOUR empty states in THREE idioms, because
 * each was built alone with nothing to conform to:
 *
 *   Make     centered greeting + 2-col grid   cards: icon-LEFT,  filled,  14/12.5px
 *   Ask      left prose block, NO cards       —
 *   Explore  left prose + its own grid        cards: icon-ABOVE, no fill, 16/14px
 *   Account  CENTERED block + a <Button>      —
 *
 * Three alignments, two card anatomies, three type scales — and picking any of the
 * three skills that owned an idle view ALSO flipped `hasThread` in composer.tsx, which
 * tore the page into a half-thread layout: greeting pinned top, composer pinned bottom,
 * a dead gap between. (Fixed at the source — see `hasThread` in composer.tsx.)
 *
 * So the idle state is now ONE shape, and skills only choose WHAT fills it:
 *
 *     greeting          ← HomePageLayout (unchanged, centered, serif)
 *     lede?             ← optional single muted line. The grid usually says enough.
 *     starter grid      ← StarterCard × N. THE one card anatomy. 2-col ≥sm.
 *     composer          ← the field the grid ramps INTO
 *
 * RULES — a new skill adds a STARTERS entry. It does NOT invent a layout.
 *   1. One card anatomy: `StarterCard`. Icon left, filled sunken surface, r12,
 *      title 14px/medium, desc 12.5px/muted. Never a second card component.
 *   2. Cards NEVER auto-fire (D-05/D-07). onSelect runs on tap, only on tap.
 *   3. Matte, NO accent (dosage rule) — the presence's liveness dot is the only
 *      sanctioned accent on this surface.
 *   4. A skill with nothing to offer gets the DEFAULT set — never a bare screen.
 *
 * HomeFirstRunDemo (below) is unrelated to the contract: a show-once footer, gated
 * on HORIZONTAL_ENABLED by its caller.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Ico, type ToolId } from "./composer-controls";
import type { ExploreQuickActionParams } from "@/components/thread/explore-thread-view";

/** Show-once localStorage flag for the first-run demo (D-04 — single-device is acceptable). */
const DEMO_SEEN_KEY = "numen.home.demo.seen";

// ── The one card ──────────────────────────────────────────────────────────────

/** One starter card. `wide` spans both columns (a lone action shouldn't sit half-width). */
interface StarterCardModel {
  id: string;
  /** Line-icon key from the composer's SSOT icon set (composer-controls `Ico`). */
  icon: string;
  /** Action-phrased — what the creator GETS, never the internal skill name. */
  title: string;
  /** One line of proof / honest degrade. */
  desc: string;
  onSelect?: () => void;
  disabled?: boolean;
  wide?: boolean;
}

const CARD_CLASS =
  "group flex items-start gap-3 rounded-[12px] border border-white/[0.06] bg-surface-sunken px-4 py-4 " +
  "text-left transition-[colors,transform] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20";

const CARD_ENABLED = "hover:border-white/[0.10] hover:bg-surface-elevated";
/** The quiet degrade — the card still SAYS what it would do, it just can't yet. */
const CARD_DISABLED = "cursor-default opacity-50";

function StarterCard({ card }: { card: StarterCardModel }) {
  const disabled = card.disabled || !card.onSelect;
  return (
    <button
      type="button"
      onClick={card.onSelect}
      disabled={disabled}
      aria-label={card.title}
      className={cn(
        CARD_CLASS,
        disabled ? CARD_DISABLED : CARD_ENABLED,
        card.wide && "sm:col-span-2",
      )}
    >
      <span
        className={cn(
          "mt-px shrink-0 text-foreground-secondary transition-colors",
          !disabled && "group-hover:text-foreground",
        )}
      >
        <Ico name={card.icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium leading-snug text-foreground">
          {card.title}
        </span>
        {/* Wraps, never truncates. The desc used to be `truncate`, which was invisible
            while the only set was the 6 short default lines — then Explore's "Widen beyond
            your niche — something unexpected" landed alone on a half-width row and clipped
            to "something unexp…". A card that eats its own sentence is worse than a card
            two lines tall; grid rows stretch together, so heights still line up. */}
        <span className="text-[12.5px] leading-snug text-foreground-muted">
          {card.desc}
        </span>
      </span>
    </button>
  );
}

// ── The starter sets ──────────────────────────────────────────────────────────

/**
 * DEFAULT — the creator's week, in order: idea → hook → script → remix, then the two
 * "judge something real" reads (a video · your own posts). Each card arms a real skill.
 * Shown for every skill that has no idle offer of its own (idea/hooks/script/remix/test),
 * so it doubles as the skill switcher on a fresh home.
 */
const DEFAULT_CARDS: { tool: ToolId; icon: string; title: string; desc: string }[] = [
  { tool: "idea",    icon: "bulb",      title: "Get content ideas",           desc: "Fresh angles for your niche" },
  { tool: "hooks",   icon: "anchor",    title: "Write scroll-stopping hooks", desc: "Ranked strongest-first" },
  { tool: "script",  icon: "doc",       title: "Script a video",              desc: "Beats + retention markers" },
  { tool: "remix",   icon: "shuffle",   title: "Remix a viral video",         desc: "Decode a winner → your version" },
  { tool: "test",    icon: "crosshair", title: "Test a video",                desc: "Watch-through + full audience Read" },
  { tool: "account", icon: "search",    title: "Read my recent posts",        desc: "See what's landing, and why" },
];

/**
 * ASK — was a paragraph telling the creator that Maven is grounded. A paragraph is a
 * claim; a question they can send is proof. These PREFILL the field (never auto-send),
 * so the ramp is: read one → it's already typed → send.
 *
 * Scoped to what chat actually knows — the niche + the calibrated audience. Nothing here
 * promises account analytics; that's the Account read's job, and claiming it here would
 * be the same dishonesty the card contract exists to prevent.
 */
const ASK_PROMPTS: { icon: string; title: string; desc: string }[] = [
  { icon: "target", title: "What should I post this week?",     desc: "Angles your audience is primed for" },
  { icon: "people", title: "What is my audience tired of?",     desc: "Saturation, from their side" },
  { icon: "chat",   title: "Pressure-test an idea for me",      desc: "Before you spend a shoot on it" },
  { icon: "bulb",   title: "What makes a hook land in my niche?", desc: "The mechanics, not the platitudes" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HomeStarterProps {
  /** The armed skill. Chooses WHICH set fills the grid — never the layout. */
  tool: ToolId;
  /** Arm a skill (handleUserSelectTool) — the DEFAULT set's action. */
  onSelectTool: (tool: ToolId) => void;
  /** Fire an Explore pull (explore.start). Tap-only, never on render (D-07). */
  onExplore: (params: ExploreQuickActionParams) => void;
  /** Run the one-tap Account read (account.start). Tap-only, never on render (D-05). */
  onAccountRun: () => void;
  /** Drop a prompt into the composer field + focus it. NEVER submits. */
  onPrefill: (text: string) => void;
  /** Gates Explore's competitors card into its honest degrade (CR-02). */
  hasTrackedAccounts: boolean;
  /** Active audience's niche, threaded into the Explore pull params. */
  audienceNiche?: string;
  className?: string;
}

/**
 * The empty-home starter. ONE shape for every skill (see THE STARTER CONTRACT above);
 * the armed skill only picks which cards fill it.
 */
export function HomeStarter({
  tool,
  onSelectTool,
  onExplore,
  onAccountRun,
  onPrefill,
  hasTrackedAccounts,
  audienceNiche,
  className,
}: HomeStarterProps) {
  const niche = (audienceNiche || "").trim() || undefined;

  let lede: string | null = null;
  let cards: StarterCardModel[];

  if (tool === "chat") {
    lede =
      "Grounded on your niche and your audience — not a generic chatbot.";
    cards = ASK_PROMPTS.map((p) => ({
      id: p.title,
      icon: p.icon,
      title: p.title,
      desc: p.desc,
      onSelect: () => onPrefill(p.title),
    }));
  } else if (tool === "explore") {
    lede =
      "Outliers from your niche and your competitors, scored for your people — not borrowed view counts.";
    cards = [
      {
        id: "explore-top",
        icon: "compass",
        title: "Top performers in my niche today",
        desc: "Fresh outliers, scored for your audience",
        onSelect: () => onExplore({ niche, timeWindow: "today" }),
      },
      {
        id: "explore-competitors",
        icon: "people",
        title: "What competitors shipped",
        // The degrade SAYS what's missing, so the disabled card still teaches.
        desc: hasTrackedAccounts
          ? "Recent posts from accounts you track"
          : "Track an account first",
        disabled: !hasTrackedAccounts,
        onSelect: hasTrackedAccounts
          ? () => onExplore({ tracked: true, timeWindow: "week" })
          : undefined,
      },
      {
        id: "explore-surprise",
        icon: "spark",
        title: "Surprise me",
        desc: "Widen beyond your niche — something unexpected",
        onSelect: () => onExplore({ niche, serendipity: 1 }),
        // Three cards in a 2-col grid leaves the third orphaned at half width on its own
        // row, where its longer desc wraps and it stands 16px taller than its siblings for
        // no reason a reader can see. Spanning the row makes the 2+1 read as composed.
        wide: true,
      },
    ];
  } else if (tool === "account") {
    lede =
      "Maven reads your latest posts and maps what is working, what is falling flat, and where to double down — grounded in your real account.";
    cards = [
      {
        id: "account-run",
        icon: "search",
        title: "Read my recent posts",
        desc: "One tap — no input needed, it resolves your handle",
        onSelect: onAccountRun,
        wide: true,
      },
    ];
  } else {
    cards = DEFAULT_CARDS.map((c) => ({
      id: c.tool,
      icon: c.icon,
      title: c.title,
      desc: c.desc,
      onSelect: () => onSelectTool(c.tool),
    }));
  }

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      {lede && (
        <p className="mx-auto max-w-[520px] text-center text-[13px] leading-normal text-foreground-muted">
          {lede}
        </p>
      )}
      <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {cards.map((card) => (
          <StarterCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

// ── First-run demo (unrelated to the starter contract) ────────────────────────

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

export interface HomeFirstRunDemoProps {
  /** Fired after the first-run demo POST lands so the host can reload the open thread. */
  onDemoComplete?: () => void;
  className?: string;
}

/**
 * The one-tap, show-once first-run demo. Renders nothing once the localStorage flag
 * is consumed (first run OR Dismiss). A quiet footer beneath the composer — never a
 * gate — so the empty home reads greeting → starter → composer → (optional) demo.
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
