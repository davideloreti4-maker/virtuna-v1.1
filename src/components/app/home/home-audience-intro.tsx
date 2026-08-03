"use client";

/**
 * HomeAudienceIntro — the first-run moment, and the only place the product says out loud what
 * the audience is FOR.
 *
 * Onboarding now ends with a calibrated audience (the /welcome rebuild, 2026-08-02). Nothing
 * then told the creator it existed. They arrived on an empty home holding the one thing that
 * makes this product different from a prompt box, and the six starter cards — correctly — say
 * only what the app DOES, never what it knows about them. So the differentiator was invisible
 * on exactly the run where it is most worth seeing.
 *
 * ── Why this is not a seventh card ──────────────────────────────────────────────────────────
 * THE STARTER CONTRACT (home-starter.tsx) is explicit: the six are constant furniture, one card
 * anatomy, no prose, and the grid must not redraw itself. A first-run affordance inside the grid
 * would break all four. This sits BESIDE it, in the same quiet footer slot HomeFirstRunDemo
 * occupies — beneath the composer, never a gate, dismissible, show-once.
 *
 * ── Why the action is conditional ───────────────────────────────────────────────────────────
 * Onboarding has two doors. The handle door calibrates from a real scrape and leaves a
 * connected account behind (`source_account_id`); the describe door does not, because there is
 * no account to connect. Offering "Read my recent posts" to a describing creator would hand
 * them a first action that cannot work — the exact species of dishonesty the rest of this
 * surface is careful about. So the account read is offered only when an account actually
 * exists, and everyone else is pointed at a skill that needs nothing but the composer.
 *
 * Show-once is localStorage, single-device — the same D-04 tradeoff HomeFirstRunDemo accepts.
 */

import { useCallback, useEffect, useState } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { cn } from "@/lib/utils";

/** Show-once flag. Distinct from HomeFirstRunDemo's — they are different moments. */
const SEEN_KEY = "numen.home.audience-intro.seen";

function readSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode / quota — the intro simply shows again */
  }
}

export interface HomeAudienceIntroProps {
  /** The resolved audience, or null for General. General is not an achievement — no intro. */
  audience: Audience | null;
  /** Runs the Account read (arms AND sends — it takes no input). */
  onReadAccount: () => void;
  /** Arms the Ideas skill for creators with no connected account to read. */
  onArmIdeas: () => void;
  className?: string;
}

export function HomeAudienceIntro({
  audience,
  onReadAccount,
  onArmIdeas,
  className,
}: HomeAudienceIntroProps) {
  // Mounted gate so the server render and the first client render agree — localStorage is
  // client-only and reading it during render is a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
    setMounted(true);
  }, []);

  const dismiss = useCallback(() => {
    markSeen();
    setSeen(true);
  }, []);

  const run = useCallback(
    (action: () => void) => {
      markSeen();
      setSeen(true);
      action();
    },
    [],
  );

  const personaCount = audience?.personas?.length ?? 0;

  // Nothing to introduce unless a real calibration actually landed. `personas.length` is the
  // app's own calibrated test (select-persona-targets.ts:111) — a bare draft row is not an
  // audience, and General is the uncalibrated default rather than something to announce.
  if (!mounted || seen || !audience || audience.is_general || personaCount === 0) {
    return null;
  }

  const hasAccount = Boolean(audience.source_account_id);
  const source =
    audience.type === "personal" && audience.name
      ? `built from ${audience.name}`
      : "built from your description";

  return (
    <div
      className={cn(
        "mx-auto flex max-w-[560px] flex-col items-center gap-3 border-t border-white/[0.06] pt-4 text-center",
        className,
      )}
      data-testid="home-audience-intro"
    >
      {/* No "Your audience:" label — the Start surface already carries one (with the picker
          chip) a few hundred pixels above this, and saying it twice on one screen reads as two
          different things. Lead with the fact it does NOT already state: the size, the origin,
          and what the audience is actually FOR. */}
      <p className="text-body leading-relaxed text-foreground-secondary">
        <span className="text-foreground">
          {personaCount} {personaCount === 1 ? "person" : "people"}
        </span>
        , {source}. Every card you make is written for one of them.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => run(hasAccount ? onReadAccount : onArmIdeas)}
          className="rounded-lg bg-action px-3 py-2 text-body font-medium text-action-foreground transition-colors hover:bg-action/90"
        >
          {hasAccount ? "Read my recent posts" : "Get content ideas"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-label font-normal text-foreground-muted transition-colors hover:text-foreground-secondary"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
