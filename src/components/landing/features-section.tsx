"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { FeatureCard } from "./feature-card";
import {
  ChartLineUp,
  Gauge,
  MagnifyingGlass,
} from "@phosphor-icons/react";

const features = [
  {
    icon: <ChartLineUp size={28} weight="light" />,
    title: "Content prediction",
    description:
      "Analyzes 50+ content signals to predict engagement before you publish. Get a virality score in under 30 seconds.",
  },
  {
    icon: <Gauge size={28} weight="light" />,
    title: "Engagement analytics",
    description:
      "Understand exactly how and why content performs. Virality scoring, engagement breakdown, and performance trends — all in one view.",
  },
  {
    icon: <MagnifyingGlass size={28} weight="light" />,
    title: "Signal analysis",
    description:
      "See the 12 engagement dimensions that drive virality in your niche. Know which signals to amplify and which to cut.",
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
            <h2 className="text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Predict. Analyze. Create.
            </h2>
            <p className="mt-6 mx-auto max-w-2xl text-lg text-white/80">
              Three tools. One goal: make every post count.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
