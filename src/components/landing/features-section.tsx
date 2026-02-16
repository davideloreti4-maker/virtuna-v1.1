"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { FeatureCard } from "./feature-card";
import {
  ChartLineUp,
  Lightning,
  Handshake,
  Target,
} from "@phosphor-icons/react";

const features = [
  {
    icon: <ChartLineUp size={28} weight="light" />,
    title: "Viral prediction",
    description:
      "AI societies simulate how thousands of people react to your content — before you hit publish. Know your viral potential in seconds.",
  },
  {
    icon: <Lightning size={28} weight="light" />,
    title: "Trend intelligence",
    description:
      "Real-time trend analysis powered by AI. See what's blowing up in your niche and create content that rides the wave.",
  },
  {
    icon: <Handshake size={28} weight="light" />,
    title: "Referral rewards",
    description:
      "Earn money by sharing Virtuna with fellow creators. Track referrals, conversions, and payouts from your dashboard.",
  },
  {
    icon: <Target size={28} weight="light" />,
    title: "Audience insights",
    description:
      "Understand exactly who engages with your content and why. Build a loyal following with data-driven creator strategy.",
  },
] as const;

interface FeaturesSectionProps {
  className?: string;
}

export function FeaturesSection({ className }: FeaturesSectionProps) {
  return (
    <section className={cn("py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="mb-16 text-center">
            <span className="font-sans text-sm text-foreground-secondary">
              Why creators choose Virtuna
            </span>
            <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Everything you need to
              <br />
              grow and monetize
            </h2>
            <p className="mt-6 mx-auto max-w-2xl text-lg text-white/80">
              Stop guessing. Start creating with confidence.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FadeIn key={feature.title} delay={0.1 + index * 0.1}>
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
