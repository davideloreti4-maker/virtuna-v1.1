import { Fragment } from "react";
import { FilmStrip, Waveform, Crosshair, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/offer/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * Proof of mechanism — the authority beat, and the HONEST substitute for a fake
 * social-proof strip. We don't borrow trust with invented creator counts, logos
 * or testimonials. We earn it by showing the real mechanism — dissect → simulate
 * → pinpoint — backing it with true numbers, and closing on the receipt.
 *
 * ⚠️ The closing block used to be "And what it doesn't claim" — a full card of
 * three limits at the page's authority beat. It was removed 2026-07-26 (owner:
 * optimise for conversion, not for defensiveness). The receipt that replaced it
 * carries the same credibility forward-facing: a real corpus video, its real
 * multiplier. Don't restore a limits card here — the honest edges that still
 * matter live in the FAQ, where a skeptic goes looking for them.
 *
 * The receipt's wording is deliberately conditional ("when a fix maps to a
 * pattern the corpus has already seen work"). A fix's `proof` is OPTIONAL in
 * `HookProofSchema` — an ungrounded run renders no receipt — so "every fix cites
 * a source" would be false. Keep the conditional.
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

/**
 * The receipt on the fix — the real numbers from a corpus video the model cited
 * (`TEST_CARD_FIXTURE.props.fixes[0].proof`: 14.2× its creator's usual, 2.4M
 * views). Shown on the shipped card, and photographed into the Transformation
 * shot above — so this is the same claim, twice, from the same source.
 */
const RECEIPT: readonly { figure: string; label: string }[] = [
  { figure: "14.2×", label: "that creator's usual views" },
  { figure: "2.4M", label: "views the cited video did" },
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

      {/* The receipt — the corpus proof that closes the authority beat. */}
      <Reveal gesture="settle" className="mx-auto mt-16 max-w-3xl">
        <div className="rounded-2xl border border-border bg-surface-sunken/60 p-6 md:flex md:items-center md:gap-8 md:p-7">
          <div className="md:flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              And the fix comes with a receipt
            </p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-foreground-secondary">
              When a fix maps to a pattern the corpus has already seen work, Maven shows you the
              video that ran it — the creator, the hook it used, and what it did for them.
            </p>
          </div>

          <Stagger
            as="dl"
            className="mt-6 flex gap-6 border-t border-border pt-5 md:mt-0 md:shrink-0 md:gap-8 md:border-l md:border-t-0 md:pl-8 md:pt-0"
            step={0.08}
          >
            {RECEIPT.map((r) => (
              <StaggerItem key={r.figure} gesture="rise" className="flex flex-col">
                <dd className="text-[26px] font-semibold leading-none tracking-tight text-foreground">
                  {r.figure}
                </dd>
                <dt className="mt-2 max-w-[16ch] text-[12.5px] leading-snug text-foreground-muted">
                  {r.label}
                </dt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </Section>
  );
}
