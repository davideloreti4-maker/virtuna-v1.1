"use client";

/**
 * HomeGreeting — the hero of the empty home (SHELL-01, THEME-04, D-19/D-20).
 *
 * Three registers, one block (the reference pattern — headline · sub · motif):
 *   1. The serif voice moment: a SHORT time-of-day greeting with the gull riding
 *      inline on the line (mark + one line — never a two-line serif question; the
 *      old "Ready to simulate your audience, {name}?" wrapped and orphaned the name).
 *   2. An Inter sub-line carrying the product promise — this is where the
 *      simulate-your-audience voice lives now (D-09/D-19: never "Reading").
 *   3. The constellation field — the audience-as-dots brand motif, breathing.
 *      Cream only (dosage LOCKED); reduced-motion freezes it.
 *
 * Time-of-day is resolved AFTER mount: the server's clock is not the creator's
 * (prod SSR runs in UTC), so rendering it on the server would either greet wrong
 * or flag a hydration mismatch on every load. SSR paints the neutral fallback.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MavenMark } from "@/components/brand/maven-logo";
import { Constellation, buildFieldDots } from "@/components/brand/constellation";
import { useProfile } from "@/hooks/queries/use-profile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Deterministic hero field — built once at module scope (buildFieldDots is seeded). */
const FIELD_VB_W = 300;
const FIELD_VB_H = 84;
const FIELD_DOTS = buildFieldDots(12, FIELD_VB_W, FIELD_VB_H);

/** 5–11 morning · 12–17 afternoon · else evening (the small hours read as evening). */
function dayPartOf(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export interface HomeGreetingProps {
  className?: string;
}

export function HomeGreeting({ className }: HomeGreetingProps) {
  const { data: profile } = useProfile();
  const reducedMotion = usePrefersReducedMotion();

  // First name only — the full display name made the headline wrap ("…, E2E Test
  // User?" across two lines); a greeting is a word, not a form field echo.
  const firstName = profile?.name?.trim().split(/\s+/)[0] || null;

  // null until mount → SSR + first client paint agree on the fallback.
  const [dayPart, setDayPart] = useState<ReturnType<typeof dayPartOf> | null>(null);
  useEffect(() => {
    setDayPart(dayPartOf(new Date().getHours()));
  }, []);

  const greeting = dayPart ? `Good ${dayPart}` : "Welcome back";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        !reducedMotion && "transition-all duration-300 ease-out",
        className,
      )}
    >
      <h1 className="flex items-baseline justify-center gap-3 font-serif text-[30px] font-normal leading-tight tracking-normal text-foreground sm:text-[34px]">
        {/* The gull rides the line (self-center against the baseline row), cream like
            the chrome — the greeting IS the brand moment, not a logo with a caption. */}
        <span aria-hidden="true" className="self-center text-foreground">
          <MavenMark size={26} />
        </span>
        <span>
          {greeting}
          {firstName ? (
            <>
              , <em>{firstName}</em>
            </>
          ) : null}
          .
        </span>
      </h1>

      {/* The promise, in chrome type — one line, muted, no hedge. */}
      <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-foreground-muted">
        Simulate your audience — see how the room reacts to an idea, a hook, or
        a video, before you post.
      </p>

      {/* The audience-as-dots field: the product's own motif as the hero's design
          element. Decorative here (the live room speaks from the composer). */}
      <div aria-hidden="true" className="mt-6">
        <Constellation
          dots={FIELD_DOTS}
          reducedMotion={reducedMotion}
          width={236}
          height={66}
          vbW={FIELD_VB_W}
          vbH={FIELD_VB_H}
          animation="cascade"
          connect
          connectMode="mesh"
          ariaLabel="Your audience"
        />
      </div>
    </div>
  );
}
