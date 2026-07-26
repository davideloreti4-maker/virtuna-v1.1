import { Fragment } from "react";
import { FilmStrip, Waveform, Crosshair, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/offer/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * Proof of mechanism — the authority beat, and the HONEST substitute for a fake
 * social-proof strip. We don't borrow trust with invented creator counts, logos
 * or testimonials. We earn it by showing the real mechanism — dissect → simulate
 * → pinpoint — backing it with true numbers, and then stating plainly what the
 * product does NOT claim.
 *
 * That last block is deliberate. For a skeptical audience (and "predict my
 * video" invites skepticism), naming the limits converts better than another
 * superlative: it's the one thing a hype page can't copy. It also keeps the page
 * consistent with the app, where a Directional read is labelled Directional.
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
    body: "Your video is read frame by frame — hook, pacing, every cut — against a corpus of 500 dissected viral videos.",
  },
  {
    icon: Waveform,
    title: "Simulate",
    body: "A room of viewer profiles, built from real engagement patterns, watches it and reacts in character.",
  },
  {
    icon: Crosshair,
    title: "Pinpoint",
    body: "You get the second attention drops, who leaves at it, and the one change that moves the number.",
  },
];

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const STATS: readonly Stat[] = [
  { value: 500, label: "viral videos dissected into the corpus" },
  { value: 10, label: "named viewers react, with their words" },
  { value: 90, prefix: "~", suffix: "s", label: "from input to a full verdict" },
];

/** What Maven doesn't claim. Each line is a real limit, not false modesty. */
const LIMITS: readonly string[] = [
  "It isn't a view count. No tool can promise you numbers the algorithm decides.",
  "It's a simulation, not an audience — a reasoned model of how viewers behave, labelled Directional in the app when that's what it is.",
  "It reads craft and reception. It won't fix a video that has nothing to say.",
];

export function ProofMechanism() {
  return (
    <Section divider>
      <Reveal gesture="lift">
        <SectionHeading
          eyebrow="Why trust it"
          title="Not a guess. A simulation."
          sub="Maven doesn't read vibes off a thumbnail. It watches your video frame by frame, then runs viewer profiles built from real engagement patterns — so the verdict is reasoned, and you can see the reasoning."
        />
      </Reveal>

      {/* The mechanism as an open process — dissect → simulate → pinpoint. */}
      <Stagger
        className="mx-auto mt-14 flex max-w-5xl flex-col items-stretch gap-8 md:flex-row md:items-start md:gap-4"
        step={0.1}
      >
        {MECHANICS.map((m, i) => {
          const Icon = m.icon;
          return (
            <Fragment key={m.title}>
              <StaggerItem gesture="settle" className="md:flex-1">
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
              </StaggerItem>
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
      </Stagger>

      {/* Three true numbers — a slim ribbon, not another boxed card. CountUp
          renders the real figure server-side, then animates once it's seen. */}
      <Stagger
        as="dl"
        className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 border-t border-border pt-10 sm:grid-cols-3 sm:gap-0"
      >
        {STATS.map((stat, i) => (
          <StaggerItem
            key={stat.label}
            gesture="rise"
            className={cn(
              "flex flex-col items-center text-center",
              i > 0 && "sm:border-l sm:border-border",
            )}
          >
            <dd className="text-[clamp(2.2rem,5.5vw,3rem)] font-semibold leading-none tracking-tight text-foreground">
              {stat.prefix}
              <CountUp value={stat.value} className="text-foreground" />
              {stat.suffix}
            </dd>
            <dt className="mt-3 max-w-[24ch] px-2 text-[13px] leading-relaxed text-foreground-muted">
              {stat.label}
            </dt>
          </StaggerItem>
        ))}
      </Stagger>

      {/* The limits. Stated by us, before a skeptic has to ask. */}
      <Reveal gesture="settle" className="mx-auto mt-16 max-w-3xl">
        <div className="rounded-2xl border border-border bg-surface-sunken/60 p-6 md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            And what it doesn&apos;t claim
          </p>
          <Stagger as="ul" className="mt-4 flex flex-col gap-3" step={0.07}>
            {LIMITS.map((limit) => (
              <StaggerItem
                as="li"
                key={limit}
                className="flex items-start gap-2.5 text-[14px] leading-relaxed text-foreground-secondary"
              >
                <span aria-hidden className="mt-[7px] h-1 w-3 shrink-0 rounded-full bg-border-hover" />
                {limit}
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </Section>
  );
}
