"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { useInView } from "react-intersection-observer";
import { HiveDemoCanvas } from "./hive-demo-canvas";

interface HiveDemoProps {
  className?: string;
}

/**
 * Landing page hive demo section.
 * Shows a lightweight (50-node) interactive hive visualization
 * that gives visitors a taste of the AI society network.
 *
 * Mobile-optimized:
 * - touch-action: auto (no scroll blocking)
 * - Pre-computed positions (no physics engine)
 * - Canvas 2D rendering (60fps on mid-range devices)
 * - IntersectionObserver lazy mounting (RAF paused when off-screen)
 */
export function HiveDemo({ className }: HiveDemoProps) {
  const { ref, inView } = useInView({
    triggerOnce: false,
    rootMargin: "200px",
  });

  return (
    <section className={cn("py-12 sm:py-16", className)}>
      <div className="mx-auto max-w-4xl px-6">
        <FadeIn>
          <div className="text-center mb-8">
            <span className="text-sm text-foreground-secondary">
              See it in action
            </span>
            <h2 className="mt-2 text-xl font-normal text-white sm:text-2xl">
              Your AI society, visualized
            </h2>
            <p className="mt-2 text-sm text-foreground-muted max-w-lg mx-auto">
              Each node represents a simulated persona reacting to your content.
              Clusters form around shared behaviors and preferences.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div
            ref={ref}
            className="relative aspect-square max-h-[400px] sm:max-h-[500px] w-full rounded-[12px] border border-white/[0.06] overflow-hidden"
            style={{
              boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
            }}
          >
            {inView ? (
              <HiveDemoCanvas />
            ) : (
              <div className="w-full h-full bg-background" />
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
