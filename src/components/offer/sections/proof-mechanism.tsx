import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { NumberTicker } from "@/components/velora/number-ticker";
import { cn } from "@/lib/utils";

/**
 * Proof of mechanism — the authority beat, and the HONEST substitute for the
 * fake social-proof strip + testimonials. We do NOT borrow trust with invented
 * creator counts, logos, or testimonials (all banned). We earn it with the real
 * mechanism: a corpus of dissected videos, a 1,000-viewer simulation, a verdict
 * in seconds. Every number here is a true product fact.
 */

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const STATS: readonly Stat[] = [
  { value: 500, label: "viral videos dissected — the corpus the model reasons from" },
  { value: 1000, label: "viewers simulated per video, reacting second by second" },
  { value: 90, prefix: "~", suffix: "s", label: "from paste to a full verdict — not 48 hours" },
];

export function ProofMechanism() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="Why trust it"
        title="Not a guess. A simulation."
        sub="Maven doesn't read vibes off a thumbnail. It watches your video frame by frame and runs a synthetic audience built from real engagement patterns — so the verdict is reasoned, not hand-waved."
      />

      <BlurFade delay={0.1} className="mx-auto mt-12 max-w-4xl">
        <dl className="grid gap-8 rounded-2xl border border-border bg-surface-sunken px-6 py-10 sm:grid-cols-3 sm:gap-0 sm:py-11">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "flex flex-col items-center text-center",
                i > 0 && "sm:border-l sm:border-border",
              )}
            >
              <dd className="text-[clamp(2.4rem,6vw,3.2rem)] font-semibold leading-none tracking-tight text-foreground">
                {stat.prefix}
                <NumberTicker value={stat.value} className="text-foreground" />
                {stat.suffix}
              </dd>
              <dt className="mt-3 max-w-[24ch] px-2 text-[13.5px] leading-relaxed text-foreground-muted">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </BlurFade>
    </Section>
  );
}
