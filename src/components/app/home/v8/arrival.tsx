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

export function ArrivalV8() {
  const { data: profile } = useProfile();
  const name = profile?.name?.trim().split(/\s+/)[0] || "";
  // Client-only greeting — the SSR pass has no local hour (same dodge as AmbientStart).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);
  return (
    <div data-testid="arrival-v8" className="w-full px-1 pb-3">
      <h1 className="font-serif text-[26px] font-normal leading-tight tracking-[-0.01em] text-foreground">
        {greeting}
        {name ? `, ${name}` : ""}.
      </h1>
    </div>
  );
}
