"use client";

/**
 * HomeGreeting — the one serif voice moment on the home (SHELL-01, THEME-04,
 * D-19/D-20).
 *
 * Renders the NumenMark stele glyph (D-20 — coral via the parent text-accent,
 * NOT an asterisk) above a serif (font-serif = Newsreader, wired in 01-01)
 * greeting. The name comes from useProfile(); the name itself is italic
 * (`<em>`) per the UI-SPEC display row.
 *
 * Loading state (RESEARCH Open Q3): while useProfile is loading we render the
 * name-less form ("Ready to simulate your audience?") — never the "[Name]"
 * placeholder, never a flash of an empty name slot.
 *
 * Copy is [UAT] (D-19) — it locks at the THEME-06 human gate (plan 01-05).
 */

import { cn } from "@/lib/utils";
import { NumenMark } from "@/components/brand/numen-logo";
import { useProfile } from "@/hooks/queries/use-profile";

export interface HomeGreetingProps {
  className?: string;
}

export function HomeGreeting({ className }: HomeGreetingProps) {
  const { data: profile, isLoading } = useProfile();
  const name = profile?.name?.trim() || null;

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {/* Stele glyph — coral via text-accent on this parent (D-20). */}
      <span className="mb-5 text-accent" aria-hidden="true">
        <NumenMark size={40} />
      </span>

      {/* Serif voice moment. ~38px desktop / ~28-30px mobile (UI-SPEC Typography). */}
      <h1
        className={cn(
          "font-serif font-normal leading-tight tracking-normal text-foreground",
          "text-[28px] sm:text-[38px]",
        )}
      >
        {isLoading || !name ? (
          // No "[Name]" flash while loading or when the profile has no name.
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
