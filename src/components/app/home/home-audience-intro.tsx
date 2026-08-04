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
 * ── Why there is now ONE action, not a conditional pair ─────────────────────────────────────
 * This offered "Read my recent posts" when a connected account existed and "Get content ideas"
 * otherwise. Walking a real signup on a production build (2026-08-04) showed the first branch
 * returns 402: `account` costs 5 credits, the free tier's allowance is 0, and
 * BILLING_ENFORCE_QUOTA is on in production. So the ONE action in the ONE sentence of in-app
 * onboarding opened a paywall — after the creator had waited ~135s for calibration.
 *
 * Both doors now get the same action, and it is the cheap one: an ideas pack drafted against
 * the personas calibration just produced. It is covered by the activation entitlement
 * (lib/pricing.ts), needs no connected account, and makes no Apify call — so it works
 * identically for the handle door and the describe door, which is what the old conditional was
 * trying and failing to achieve.
 *
 * ── Why it is not below the fold any more ───────────────────────────────────────────────────
 * Measured at 390×844: this sat at y=998, entirely below the fold. DESIGN §2a says traffic is
 * organic social and mobile is the default rather than the adaptation — so the product's whole
 * spoken introduction was invisible to its primary audience. It now scrolls itself into view on
 * mount, which is content-length independent (the starter grid above it is nine tiles and grows).
 *
 * Show-once is localStorage, single-device — the same D-04 tradeoff HomeFirstRunDemo accepts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Runs the free activation card (arms AND sends — Auto mode takes no input). */
  onFirstCard: () => void;
  className?: string;
}

export function HomeAudienceIntro({
  audience,
  onFirstCard,
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

  // Whether there is anything true to say. Computed BEFORE the effect below because the effect
  // depends on it — see the note there.
  const visible =
    mounted && !seen && Boolean(audience) && !audience?.is_general && personaCount > 0;

  // ── Make sure it is actually SEEN ───────────────────────────────────────────────────────────
  // Measured at 390×844: this rendered at y=998 — wholly below the fold — so the product's one
  // spoken introduction was invisible on the viewport §2a calls the default. Scrolling it into
  // view is the content-length-independent fix: the starter grid above is nine tiles and will
  // keep changing, so any hard-coded placement goes stale.
  //
  // ⚠️ `visible` is in the deps, and that is the whole fix. A first attempt depended on
  // [mounted, seen] alone and did nothing: the audience is FETCHED, so at the moment `mounted`
  // flips true this component still renders null and `introRef.current` is null. The effect ran
  // once against nothing, and never re-ran when the audience arrived. Re-measured after that
  // version: still y=998.
  //
  // `block: "nearest"` so a viewport that ALREADY shows it does not jump — on desktop it is in
  // view at 1512×982 and must stay still. Honours prefers-reduced-motion via `behavior: auto`
  // for those users; a surprise smooth scroll is exactly what that setting is asking us not to do.
  const introRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!visible || scrolled.current) return;
    const el = introRef.current;
    if (!el) return;
    scrolled.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }, [visible]);

  // Nothing to introduce unless a real calibration actually landed. `personas.length` is the
  // app's own calibrated test (select-persona-targets.ts:111) — a bare draft row is not an
  // audience, and General is the uncalibrated default rather than something to announce.
  //
  // Repeats `visible`'s conditions rather than testing it, so `audience` stays NARROWED for the
  // render below.
  if (!mounted || seen || !audience || audience.is_general || personaCount === 0) {
    return null;
  }

  const source =
    audience.type === "personal" && audience.name
      ? `built from ${audience.name}`
      : "built from your description";

  return (
    <div
      ref={introRef}
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
        {/* One action, both doors, and it is FREE for a creator who just calibrated (the
            activation entitlement). The label names what they get, not the skill that makes
            it — "Ideas" is the product's word, "something to post" is theirs. */}
        <button
          type="button"
          onClick={() => run(onFirstCard)}
          className="rounded-lg bg-action px-3 py-2 text-body font-medium text-action-foreground transition-colors hover:bg-action/90"
        >
          Write me something to post
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
