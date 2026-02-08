"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { FadeInUp } from "@/components/motion";

interface StatItem {
  value: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  { value: 500, suffix: "K+", label: "Videos Analyzed" },
  { value: 10, suffix: "M+", label: "Data Points Collected" },
  { value: 50, suffix: "K+", label: "Trends Tracked" },
  { value: 99, suffix: "%", label: "Uptime Reliability" },
];

function StatCounter({ value, suffix, label, delay }: StatItem & { delay: number }) {
  const { ref, display } = useCountUp({
    end: value,
    duration: 2000,
    suffix,
  });

  return (
    <FadeInUp delay={delay} className="text-center">
      <div ref={ref}>
        <div className="font-display text-5xl font-[350] text-white md:text-6xl">
          {display}
        </div>
        <div className="mt-2 text-sm uppercase tracking-wider text-foreground-secondary">
          {label}
        </div>
      </div>
    </FadeInUp>
  );
}

interface SocialProofStatsProps {
  className?: string;
}

export function SocialProofStats({ className }: SocialProofStatsProps) {
  return (
    <section
      className={cn(
        "border-y border-white/[0.06] py-20 md:py-24",
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          {stats.map((stat, i) => (
            <StatCounter key={stat.label} {...stat} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
