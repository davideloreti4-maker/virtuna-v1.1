"use client";

import Image from "next/image";
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
      {/* Background dot grid pattern is applied to body in globals.css */}

      <div className="relative max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
          {/* Left: Text content */}
          <div className="max-w-xl text-center lg:text-left order-2 lg:order-1">
            <FadeIn delay={0}>
              <h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading-[1.15] font-[350] text-white">
                Human Behavior,
                <br />
                <span className="text-accent">Simulated.</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.1}>
              <p className="font-sans text-lg sm:text-xl leading-[30px] font-[450] text-white/90 mt-6 max-w-md">
                AI personas that replicate real-world attitudes, beliefs, and opinions.
              </p>
            </FadeIn>

            <FadeIn delay={0.2}>
              <Button className="mt-8" size="md">
                Get in touch
              </Button>
            </FadeIn>
          </div>

          {/* Right: Network visualization */}
          <div className="relative order-1 lg:order-2">
            <FadeIn delay={0.3}>
              <div className="relative w-[280px] sm:w-[400px] lg:w-[480px] xl:w-[550px] aspect-square">
                {/* Network visualization */}
                <Image
                  src="/images/network-visualization.svg"
                  alt="AI persona network visualization"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
