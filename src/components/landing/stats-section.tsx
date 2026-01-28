"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ComparisonChart } from "./comparison-chart";

interface StatsSectionProps {
  className?: string;
}

/**
 * StatsSection displays the 86% accuracy metric with description
 * and a comparison chart showing how Artificial Societies outperforms
 * other AI models on survey replication accuracy.
 */
export function StatsSection({ className }: StatsSectionProps) {
  return (
    <section className={cn("py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
          {/* Left: Stats */}
          <FadeIn>
            <div>
              <span className="text-sm text-foreground-muted">
                Validated accuracy
              </span>
              <h2 className="mt-4 font-display text-[40px] font-[350] text-white sm:text-[52px]">
                86%
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/80">
                Standard AI personas plateau at 61-67% accuracy. Artificial Societies
                achieves 86%. That&apos;s 5 points off the human replication ceiling.
                Our personas don&apos;t just answer questions, they give reasons like real people.
              </p>
              <a
                href="https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-white hover:underline"
              >
                Read the full evaluation report
                <ArrowRight size={16} />
              </a>
            </div>
          </FadeIn>

          {/* Right: Chart */}
          <FadeIn delay={0.15}>
            <ComparisonChart />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
