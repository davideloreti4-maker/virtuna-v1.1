"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";
import { HeroBackground } from "./hero-background";
import { BrowserFrame } from "./browser-frame";
import { ArrowRight } from "@phosphor-icons/react";

interface HeroSectionProps {
  className?: string;
}

/**
 * Hero section for the Virtuna landing page.
 *
 * Requirements: HERO-01, HERO-02, HERO-03, HERO-04, HERO-06
 * - Bold headline with "social media intelligence" value proposition
 * - Subtitle explaining what Virtuna does
 * - Primary "Get started" CTA + secondary "Learn more" action
 * - Product screenshot in browser chrome frame
 * - Animated gradient/mesh/noise background
 */
export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center overflow-hidden",
        className
      )}
    >
      {/* HERO-06: Animated gradient background */}
      <HeroBackground />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl w-full px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        {/* Text content - centered */}
        <div className="mx-auto max-w-3xl text-center">
          {/* HERO-01: Bold headline */}
          <FadeIn delay={0}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-display font-semibold leading-tight tracking-tight text-foreground">
              Social Media Intelligence,{" "}
              <span className="text-accent">Decoded.</span>
            </h1>
          </FadeIn>

          {/* HERO-02: Subtitle */}
          <FadeIn delay={0.1}>
            <p className="mt-6 text-lg sm:text-xl leading-relaxed text-foreground-secondary max-w-2xl mx-auto">
              Track viral trends, analyze content performance, and discover what
              makes videos go viral — powered by AI that understands social media
              at scale.
            </p>
          </FadeIn>

          {/* HERO-03: CTAs */}
          <FadeIn delay={0.2}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="primary" size="lg" asChild>
                <Link href="/auth/signup">
                  Get started
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="#features">Learn more</Link>
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* HERO-04: Product screenshot in browser frame */}
        <FadeIn delay={0.4} duration={0.8}>
          <div className="mt-16 sm:mt-20 mx-auto max-w-4xl">
            <BrowserFrame
              src="/images/landing/DC_dark-CPn4aTvq.png"
              alt="Virtuna dashboard showing social media analytics and trend tracking"
              width={1920}
              height={1080}
              priority
              className="shadow-2xl"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
