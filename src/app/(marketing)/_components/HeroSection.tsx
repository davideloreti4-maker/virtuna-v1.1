"use client";

import { HeroBookend } from "@/app/(marketing)/_components/HeroBookend";

/**
 * HeroSection (HERO-01, HERO-08) — above-fold Hero shell.
 *
 * Wraps HeroBookend in the <section id="hero"> landmark required by
 * LandingHeader's #hero anchor link. Delegates height (min-h-[100dvh] iOS
 * Safari address-bar fix per HERO-08) and the canonical <h1> (default
 * headingAs="h1") to HeroBookend.
 *
 * Anchor ID #hero MUST be preserved — LandingHeader.tsx anchor href depends on it.
 *
 * Notes:
 * - className="relative" establishes positioning context for HeroBookend's
 *   absolutely-positioned Spotlight.
 * - bg-background (#07080a) matches UI-SPEC § Color "Hero + Final CTA section bg".
 * - No <h1> here — HeroBookend owns the H1 (default headingAs="h1").
 * - No min-h-[100dvh] here — HeroBookend's outer div applies it (reducedHeight=false default).
 * - No explicit headingAs= or reducedHeight= — both are defaults; explicit props add noise.
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      aria-label="Hero section"
      className="relative bg-background"
    >
      <HeroBookend />
    </section>
  );
}
