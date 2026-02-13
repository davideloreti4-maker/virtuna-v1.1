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
      <div className="relative max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="flex flex-col items-center text-center">
          <FadeIn delay={0}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 mb-8">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm text-foreground-secondary">
                AI-powered content intelligence for TikTok creators
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
            <p className="font-sans text-lg sm:text-xl leading-[30px] font-normal text-white/80 mt-6 max-w-2xl">
              Virtuna uses AI societies to predict how your content will perform,
              spot trending opportunities, and maximize your earnings.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
              <Button variant="primary" size="lg" asChild>
                <Link href="/auth/signup">Start free trial</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
