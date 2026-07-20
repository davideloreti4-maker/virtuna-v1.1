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
 * So the idle state is now ONE shape — and, since the owner call of 2026-07-14, ONE SET:
 *
 *     greeting          ← HomePageLayout (unchanged, centered, serif)
 *     starter grid      ← the SAME SIX cards, always. THE one card anatomy. 2-col ≥sm.
 *     composer          ← the field the grid ramps INTO
 *
 * ⚠️ THE SIX ARE CONSTANT. They do not change with the armed skill. The first pass gave
 * each skill its own set (Ask got 4 questions, Explore 3 pulls, Account 1 button) — which
 * fixed the *shape* but kept the surface shifting under the creator: arm a skill, and the
 * six things you could do became four different things. The grid is the map of what this
 * app DOES; a map that redraws itself when you turn is not a map. So the grid is now fixed
 * furniture, and the ARMED skill is told by the composer instead:
 *
 *     what the app can do   → these six cards (constant)
 *     what is armed RIGHT NOW → the skill chip, which now names the SKILL
 *     what that skill wants → the placeholder, which is now the per-skill instruction
 *
 * That split is why PLACEHOLDER_BY_TOOL in composer.tsx is load-bearing copy, not flavour.
 *
 * RULES:
 *   1. One card anatomy: `StarterCard`. Kicker row (icon + mono-caps skill name) over a
 *      14px/medium title, hairline border, NO fill at rest, r12 — and NOTHING ELSE.
 *      Never a second card component. (Anatomy revised 2026-07-20, owner call — the old
 *      icon-left filled brick read as six identical gray slabs; the kicker/title pair is
 *      the reference quick-action grammar and matches the thread cards' own kickers.)
 *   2. NO PROSE. No lede above the grid, no sub-line under a title. The titles are verbs;
 *      the kicker is the skill's NAME (the /command noun), never a sentence.
 *      (The earlier `disabledReason` escape hatch went with Explore's competitors card —
 *      there are no dead cards left, so there is nothing left to explain. If a future card
 *      CAN be dead, it must say why: a card that cannot fire and does not say so reads as
 *      broken rather than honest, which is D-02, not a style rule.)
 *   3. Cards NEVER auto-fire (D-05/D-07). onSelect runs on tap, only on tap.
 *   4. Matte, NO accent (dosage rule) — the presence's liveness dot is the only
 *      sanctioned accent on this surface.
 *   5. A card either ARMS a skill or RUNS one. Account runs (it takes no input); the other
 *      five arm, because they need the field. No card is a dead end.
 *
 * HomeFirstRunDemo (below) is unrelated to the contract: a show-once footer, gated
 * on HORIZONTAL_ENABLED by its caller.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Ico, type ToolId } from "./composer-controls";

/** Show-once localStorage flag for the first-run demo (D-04 — single-device is acceptable). */
const DEMO_SEEN_KEY = "numen.home.demo.seen";

// ── The one card ──────────────────────────────────────────────────────────────

/** One starter card. `wide` spans both columns (a lone action shouldn't sit half-width). */
interface StarterCardModel {
  id: string;
  /** Line-icon key from the composer's SSOT icon set (composer-controls `Ico`). */
  icon: string;
  /** Mono-caps kicker — the skill's NAME (the /command noun), one word. */
  kicker: string;
  /** Action-phrased — what the creator GETS, never the internal skill name. */
  title: string;
  onSelect: () => void;
  /** Spans both columns. Unused by the six (they pair evenly) — kept for a future odd set. */
  wide?: boolean;
}

const CARD_CLASS =
  "group flex flex-col items-start gap-1.5 rounded-[12px] border border-white/[0.06] px-4 py-3.5 " +
  "text-left transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20";

const CARD_ENABLED = "hover:border-white/[0.10] hover:bg-white/[0.02]";

function StarterCard({ card }: { card: StarterCardModel }) {
  return (
    <button
      type="button"
      onClick={card.onSelect}
      aria-label={card.title}
      className={cn(CARD_CLASS, CARD_ENABLED, card.wide && "sm:col-span-2")}
    >
      <span className="flex items-center gap-1.5 text-foreground-muted transition-colors group-hover:text-foreground-secondary">
        <Ico name={card.icon} size={13} />
        <span className="text-[10.5px] font-medium uppercase leading-none tracking-[0.08em]">
          {card.kicker}
        </span>
      </span>
      <span className="text-[14px] font-medium leading-snug text-foreground">
        {card.title}
      </span>
    </button>
  );
}

// ── The six ──────────────────────────────────────────────────────────────────

/**
 * THE SIX — constant under every skill. The creator's week, in the order it actually
 * flows: idea → hook → script → remix, then the two "judge something real" reads (a
 * video · your own posts).
 *
 * `run: true` means the card FIRES the skill instead of arming it. Only Account does,
 * because only Account takes no input — arming it would leave the creator staring at a
 * field with nothing to type. Every other card arms and hands off to the placeholder.
 */
const THE_SIX: { tool: ToolId; icon: string; kicker: string; title: string; run?: boolean }[] = [
  { tool: "idea",    icon: "bulb",      kicker: "Ideas",  title: "Get content ideas" },
  { tool: "hooks",   icon: "anchor",    kicker: "Hooks",  title: "Write scroll-stopping hooks" },
  { tool: "script",  icon: "doc",       kicker: "Script", title: "Script a video" },
  { tool: "remix",   icon: "shuffle",   kicker: "Remix",  title: "Remix a viral video" },
  { tool: "test",    icon: "crosshair", kicker: "Test",   title: "Test a video" },
  { tool: "account", icon: "search",    kicker: "Read",   title: "Read my recent posts", run: true },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HomeStarterProps {
  /** Arm a skill (handleUserSelectTool). Five of the six do this. */
  onSelectTool: (tool: ToolId) => void;
  /**
   * Arm AND run the Account read. Tap-only, never on render (D-05) — and it spends a
   * Reading, so the tap has to be the creator's, not ours.
   */
  onAccountRun: () => void;
  className?: string;
}

/**
 * The empty-home starter: the same six cards, always. What is ARMED is told by the skill
 * chip and the placeholder — not by this grid rearranging itself.
 */
export function HomeStarter({ onSelectTool, onAccountRun, className }: HomeStarterProps) {
  const cards: StarterCardModel[] = THE_SIX.map((c) => ({
    id: c.tool,
    icon: c.icon,
    kicker: c.kicker,
    title: c.title,
    onSelect: c.run ? onAccountRun : () => onSelectTool(c.tool),
  }));

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
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
