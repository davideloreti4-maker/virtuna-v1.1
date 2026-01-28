"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import Image from "next/image";

interface BackerItem {
  name: string;
  logo: string;
  displayName?: string;
}

const primaryBackers: BackerItem[] = [
  { name: "Point72 Ventures", logo: "/logos/point72.svg" },
  { name: "Kindred Capital", logo: "/logos/kindred.svg" },
  { name: "Y Combinator", logo: "/logos/yc.svg", displayName: "Combinator" },
];

const investors: BackerItem[] = [
  { name: "Sequoia", logo: "/logos/sequoia.svg" },
  { name: "Google", logo: "/logos/google.svg" },
  { name: "DeepMind", logo: "/logos/deepmind.svg" },
  { name: "Prolific", logo: "/logos/prolific.svg" },
  { name: "Strava", logo: "/logos/strava.svg" },
];

interface BackersSectionProps {
  className?: string;
}

/**
 * BackersSection displays investor/backer logos in two rows:
 * - "Backed by" row with primary investors (larger, with text)
 * - "With Investors from" row with additional investors (smaller)
 *
 * Features scroll-triggered fade-in animations with stagger effect.
 */
export function BackersSection({ className }: BackersSectionProps) {
  return (
    <section
      className={cn(
        "border-t border-white/10 py-16",
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Backed by */}
        <FadeIn>
          <div className="mb-12">
            <span className="px-4 font-sans text-sm text-foreground-secondary">
              Backed by
            </span>
            <div className="mt-4 flex flex-wrap items-center gap-6 md:gap-8">
              {primaryBackers.map((backer, index) => (
                <FadeIn key={backer.name} delay={index * 0.1}>
                  <div className="flex items-center gap-3">
                    <Image
                      src={backer.logo}
                      alt={backer.name}
                      width={24}
                      height={24}
                      className="h-6 w-6 brightness-0 invert"
                    />
                    <span className="font-sans text-sm text-white md:text-base">
                      {backer.displayName || backer.name}
                    </span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* With Investors from */}
        <FadeIn delay={0.2}>
          <div>
            <span className="px-4 font-sans text-sm text-foreground-secondary">
              With Investors from
            </span>
            <div className="mt-4 flex flex-wrap items-center gap-4 md:gap-6">
              {investors.map((investor, index) => (
                <FadeIn key={investor.name} delay={0.3 + index * 0.08}>
                  <div className="flex items-center gap-2">
                    <Image
                      src={investor.logo}
                      alt={investor.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 brightness-0 invert"
                    />
                    <span className="font-sans text-sm text-white">
                      {investor.name}
                    </span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
