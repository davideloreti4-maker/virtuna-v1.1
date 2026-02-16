"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden",
        className
      )}
    >
      {/* Abstract gradient visual treatment */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        {/* Primary coral radial glow -- top center */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4 h-[800px] w-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,127,80,0.08) 0%, rgba(255,127,80,0.03) 40%, transparent 70%)",
          }}
        />
        {/* Secondary depth gradient -- bottom right */}
        <div
          className="absolute right-0 bottom-0 h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,127,80,0.04) 0%, transparent 60%)",
          }}
        />
        {/* Subtle ambient wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,127,80,0.02) 0%, transparent 50%)",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="flex flex-col items-center text-center">
          <FadeIn delay={0}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 mb-8">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm text-foreground-secondary">
                AI-powered content prediction for TikTok
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-[36px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.1] font-normal text-white max-w-4xl">
              Know what will go{" "}
              <span className="text-accent">viral</span>
              <br />
              before you post
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-lg sm:text-xl leading-[30px] font-normal text-white/80 mt-6 max-w-2xl" style={{ letterSpacing: "0.2px" }}>
              Virtuna analyzes 50+ content signals to predict engagement
              before you publish. Get a virality score, understand what
              drives performance, and create with confidence — not guesswork.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Get Started Free</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
