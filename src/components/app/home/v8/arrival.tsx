"use client";

/**
 * The v8 arrival — Phase 1 is the GREETING ONLY: serif voice-moment over the docked
 * composer, nothing else (spec §0b restraint: greeting · drops · composer). The shelf
 * ("Tonight's remixes") lands in Phase 2 — naming it before the drops exist would
 * promise content that isn't there. Replaces AmbientStartHome under CONCEPT_V8_ENABLED.
 */
import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/queries/use-profile";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function ArrivalV8({ shelfReady = false }: { shelfReady?: boolean }) {
  const { data: profile } = useProfile();
  const name = profile?.name?.trim().split(/\s+/)[0] || "";
  // Client-only greeting — the SSR pass has no local hour (same dodge as AmbientStart).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);
  // v8 copy — owner reviews before launch (handoff §5). The shelf headline only ever
  // shows over REAL cards (shelfReady) — an empty arrival keeps the honest time
  // greeting rather than promising content that isn't there.
  const headline = shelfReady ? "Tonight's remixes" : greeting;
  return (
    <div data-testid="arrival-v8" className="w-full px-1 pb-3">
      <h1 className="font-serif text-[26px] font-normal leading-tight tracking-[-0.01em] text-foreground">
        {headline}
        {name ? `, ${name}` : ""}.
      </h1>
      {shelfReady ? (
        <p className="mt-1.5 text-caption text-foreground-muted">
          Proven videos · rebuilt for your niche
        </p>
      ) : null}
    </div>
  );
}
