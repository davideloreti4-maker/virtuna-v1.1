"use client";

/**
 * HomeGreeting — the one serif voice moment on the home (SHELL-01, THEME-04,
 * D-19/D-20).
 *
 * Renders the NumenMark stele glyph above a serif greeting. The name comes from
 * useProfile(); the name itself is italic (`<em>`) per the UI-SPEC display row.
 *
 * Shown only on the empty-state start screen; removed entirely once conversation
 * content exists (see HomePageLayout + Composer onConversationChange).
 */

import { cn } from "@/lib/utils";
import { NumenMark } from "@/components/brand/numen-logo";
import { useProfile } from "@/hooks/queries/use-profile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export interface HomeGreetingProps {
  className?: string;
}

export function HomeGreeting({ className }: HomeGreetingProps) {
  const { data: profile, isLoading } = useProfile();
  const name = profile?.name?.trim() || null;
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        !reducedMotion && "transition-all duration-300 ease-out",
        className,
      )}
    >
      {/* Brand mark — logo is a sanctioned accent home (dosage LOCKED). */}
      <span
        className={cn(
          "mb-5 text-accent",
          !reducedMotion && "transition-all duration-300",
        )}
        aria-hidden="true"
      >
        <NumenMark size={40} />
      </span>

      <h1
        className={cn(
          "font-serif text-[28px] font-normal leading-tight tracking-normal text-foreground sm:text-[38px]",
          !reducedMotion && "transition-all duration-300",
        )}
      >
        {isLoading || !name ? (
          <>Ready to simulate your audience?</>
        ) : (
          <>
            Ready to simulate your audience, <em>{name}</em>?
          </>
        )}
      </h1>
    </div>
  );
}
