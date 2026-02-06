"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { FeatureCard } from "./feature-card";
import {
  Crosshair,
  Lightning,
  UsersThree,
  Brain,
} from "@phosphor-icons/react";

const features = [
  {
    icon: <Crosshair size={28} weight="light" />,
    title: "Unreachable audiences",
    description:
      "Survey Fortune 500 executives, rare specialists, or hyper-specific demographics that traditional panels cannot access.",
  },
  {
    icon: <Lightning size={28} weight="light" />,
    title: "Instant insights",
    description:
      "Replace weeks of recruitment and fieldwork with instant responses. Run thousands of interviews before your competitor sends one survey.",
  },
  {
    icon: <UsersThree size={28} weight="light" />,
    title: "Millions of personas",
    description:
      "Every persona is demographically and psychographically calibrated, creating responses as nuanced and diverse as real humans.",
  },
  {
    icon: <Brain size={28} weight="light" />,
    title: "True understanding",
    description:
      "Go beyond surface-level answers. Our personas reason, reflect, and respond with the depth of genuine human cognition.",
  },
] as const;

interface FeaturesSectionProps {
  className?: string;
}

/**
 * FeaturesSection displays the "Into the future" section with:
 * - Section label ("Into the future")
 * - Main heading ("Research that was impossible is now instant")
 * - Description paragraph
 * - 2x2 grid of feature cards
 *
 * Features scroll-triggered fade-in animations.
 */
export function FeaturesSection({ className }: FeaturesSectionProps) {
  return (
    <section className={cn("py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <FadeIn>
          <div className="mb-16">
            <span className="font-sans text-sm text-foreground-secondary">
              Into the future
            </span>
            <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Research that was impossible
              <br />
              is now instant
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-white/80">
              Access high-value audiences. Understand decision-makers. Discover
              critical insights.
            </p>
          </div>
        </FadeIn>

        {/* Feature Cards Grid - 4 columns on large screens */}
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
