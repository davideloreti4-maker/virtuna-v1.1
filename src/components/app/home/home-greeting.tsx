"use client";

/**
 * HomeGreeting — the one serif voice moment on the home (SHELL-01, THEME-04,
 * D-19/D-20).
 *
 * Renders the NumenMark stele glyph above a serif greeting. The name comes from
 * useProfile(); the name itself is italic (`<em>`) per the UI-SPEC display row.
 *
 * `compact` — receded form when a thread is active (P0 greeting recede).
 * Empty home keeps the full hero anchor; thread state shrinks + fades.
 */

import { cn } from "@/lib/utils";
import { NumenMark } from "@/components/brand/numen-logo";
import { useProfile } from "@/hooks/queries/use-profile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export interface HomeGreetingProps {
  className?: string;
  /** Refined compact form when conversation owns the screen. */
  compact?: boolean;
}

export function HomeGreeting({ className, compact = false }: HomeGreetingProps) {
  const { data: profile, isLoading } = useProfile();
  const name = profile?.name?.trim() || null;
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        !reducedMotion && "transition-all duration-300 ease-out",
        compact ? "opacity-70" : "opacity-100",
        className,
      )}
    >
      {/* Brand mark — logo is a sanctioned accent home (dosage LOCKED). */}
      <span
        className={cn(
          "text-accent",
          compact ? "mb-2" : "mb-5",
          !reducedMotion && "transition-all duration-300",
        )}
        aria-hidden="true"
      >
        <NumenMark size={compact ? 24 : 40} />
      </span>

      <h1
        className={cn(
          "font-serif font-normal leading-tight tracking-normal text-foreground",
          compact ? "text-lg" : "text-[28px] sm:text-[38px]",
          !reducedMotion && "transition-all duration-300",
        )}
      >
        {isLoading || !name ? (
          <>Ready to simulate your audience?</>
        ) : compact ? (
          <>Ready, <em>{name}</em>?</>
        ) : (
          <>
            Ready to simulate your audience, <em>{name}</em>?
          </>
        )}
      </h1>
    </div>
  );
}
