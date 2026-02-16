"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";

const stats = [
  { value: "86%", label: "Prediction accuracy" },
  { value: "10K+", label: "AI personas simulated" },
  { value: "< 30s", label: "Time to get results" },
  { value: "3.2x", label: "Average engagement lift" },
];

interface StatsSectionProps {
  className?: string;
}

export function StatsSection({ className }: StatsSectionProps) {
  return (
    <section className={cn("py-24 border-t border-white/[0.06]", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="mb-16 text-center">
            <span className="text-sm text-foreground-secondary">
              The numbers speak
            </span>
            <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Built on validated research
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <FadeIn key={stat.label} delay={0.1 + index * 0.1}>
              <div className="text-center">
                <div className="text-[40px] font-normal text-accent sm:text-[48px]">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm text-foreground-muted">
                  {stat.label}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
