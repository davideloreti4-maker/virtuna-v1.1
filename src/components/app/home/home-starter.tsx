"use client";

/**
 * HomeStarter — the home empty-state starter block (UX-05 / D-04).
 *
 * Renders BELOW the greeting + composer in the previously-LOCKED-empty region
 * (P5 D-18/D-25 deferred the chips + demo to Phase 5; P7 unlocks them):
 *
 *   - 3 LOCKED-verbatim chips (always render): the Test / Profile / Predict trio
 *     (exact strings live in the JSX below — single source), each wired to a
 *     composer-internal flow via the on* props (no cross-sibling plumbing — the
 *     composer hosts this so the handlers reach the real flows).
 *
 *   - A one-tap, show-once first-run demo BENEATH the chips: "See it in action"
 *     POSTs a small CANNED chat fixture to /api/tools/profile (the cold-start wow,
 *     no chat-export friction — VISION §15.5), then reloads the open thread so the
 *     profile-read card surfaces. "Dismiss" is a muted text link. A localStorage
 *     flag (`numen.home.demo.seen`) hides the demo on the NEXT mount — set on first
 *     run OR on Dismiss. The chips are NOT gated by the flag (only the demo is).
 *
 * Matte, NO accent (dosage rule) — the single liveness dot in the presence is the
 * only sanctioned accent on the surface.
 */

import { useCallback, useEffect, useState } from "react";

/** Show-once localStorage flag for the first-run demo (D-04 — single-device is acceptable). */
const DEMO_SEEN_KEY = "numen.home.demo.seen";

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

export interface HomeStarterProps {
  onChipTest: () => void;
  onChipProfile: () => void;
  onChipPredict: () => void;
  /** Fired after the first-run demo POST lands so the host can reload the open thread. */
  onDemoComplete?: () => void;
}

const CHIP_CLASS =
  "rounded-[8px] border border-white/[0.06] bg-[#2f2e2b] px-3 py-2 text-[14px] font-normal text-foreground " +
  "transition-colors hover:border-white/[0.10] hover:bg-[#34322f] focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-white/20";

export function HomeStarter({
  onChipTest,
  onChipProfile,
  onChipPredict,
  onDemoComplete,
}: HomeStarterProps) {
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

  const showDemo = mounted && !demoSeen;

  return (
    <div className="flex w-full flex-col items-center gap-4 pt-8">
      {/* 3 LOCKED chips — always render (only the demo is show-once). */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={onChipTest} className={CHIP_CLASS}>
          Test an idea on your audience
        </button>
        <button type="button" onClick={onChipProfile} className={CHIP_CLASS}>
          Profile a chat
        </button>
        <button type="button" onClick={onChipPredict} className={CHIP_CLASS}>
          Predict an outcome
        </button>
      </div>

      {/* First-run, show-once demo beneath the chips. */}
      {showDemo && (
        <div className="flex items-center gap-3">
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
      )}
    </div>
  );
}
