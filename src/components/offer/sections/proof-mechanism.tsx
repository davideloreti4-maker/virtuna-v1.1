import { Fragment } from "react";
import { FilmStrip, Waveform, Crosshair, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { NumberTicker } from "@/components/velora/number-ticker";
import { cn } from "@/lib/utils";

/**
 * Proof of mechanism — the authority beat, and the HONEST substitute for the
 * fake social-proof strip + testimonials. We don't borrow trust with invented
 * creator counts, logos, or testimonials (all banned). We EARN it by showing the
 * real mechanism as a three-step process — dissect → simulate → pinpoint — then
 * back it with three true product numbers. Distinct silhouette from the card
 * sections: an open diagram on the matte ground, no boxed cards.
 */

interface Mechanic {
  icon: typeof FilmStrip;
  title: string;
  body: string;
}

const MECHANICS: readonly Mechanic[] = [
  {
    icon: FilmStrip,
    title: "Dissect",
    body: "It watches your video frame by frame — hook, pacing, every cut — against a corpus of 500 dissected viral videos.",
  },
  {
    icon: Waveform,
    title: "Simulate",
    body: "A synthetic crowd of 1,000 viewer profiles, built from real engagement patterns, reacts second by second.",
  },
  {
    icon: Crosshair,
    title: "Pinpoint",
    body: "You get the exact second attention drops — and the one change that moves the number.",
  },
];

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const STATS: readonly Stat[] = [
  { value: 500, label: "viral videos dissected" },
  { value: 1000, label: "viewers simulated per video" },
  { value: 90, prefix: "~", suffix: "s", label: "from paste to a full verdict" },
];

export function ProofMechanism() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="Why trust it"
        title="Not a guess. A simulation."
        sub="Maven doesn't read vibes off a thumbnail. It watches your video frame by frame and runs a synthetic audience built from real engagement patterns — so the verdict is reasoned, not hand-waved."
      />

      {/* The mechanism as an open process — dissect → simulate → pinpoint. */}
      <div className="mx-auto mt-14 flex max-w-5xl flex-col items-stretch gap-8 md:flex-row md:items-start md:gap-4">
        {MECHANICS.map((m, i) => {
          const Icon = m.icon;
          return (
            <Fragment key={m.title}>
              <BlurFade delay={0.05 + i * 0.1} direction="up" className="md:flex-1">
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface-sunken text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.28)]">
                    <Icon size={22} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                    {m.title}
                  </h3>
                  <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-foreground-secondary">
                    {m.body}
                  </p>
                </div>
              </BlurFade>
              {i < MECHANICS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden items-center justify-center self-start pt-3.5 text-foreground-muted/60 md:flex"
                >
                  <ArrowRight size={18} />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Three true numbers — a slim ribbon, not another boxed card. */}
      <BlurFade delay={0.2} className="mx-auto mt-16 max-w-3xl">
        <dl className="grid grid-cols-1 gap-8 border-t border-border pt-10 sm:grid-cols-3 sm:gap-0">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "flex flex-col items-center text-center",
                i > 0 && "sm:border-l sm:border-border",
              )}
            >
              <dd className="text-[clamp(2.2rem,5.5vw,3rem)] font-semibold leading-none tracking-tight text-foreground">
                {stat.prefix}
                <NumberTicker value={stat.value} className="text-foreground" />
                {stat.suffix}
              </dd>
              <dt className="mt-3 max-w-[22ch] px-2 text-[13px] leading-relaxed text-foreground-muted">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </BlurFade>
    </Section>
  );
}
