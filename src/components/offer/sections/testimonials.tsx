import { Quotes } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem } from "@/components/offer/motion/reveal";
import { MediaSlot } from "@/components/offer/media-slot";
import { PrimaryCta } from "@/components/offer/cta-config";
import { TRIAL } from "@/lib/pricing";
import { SIGNUP_URL } from "@/lib/routes";

/**
 * Testimonials — social proof, HONESTLY. This page must never ship fabricated
 * quotes, names or counts (locked rule), so the section renders a different
 * block until real consented creator quotes exist. The moment `TESTIMONIALS`
 * gets entries, real quote cards render in their place — no other change.
 *
 * Two rewrites of the empty state, and the second one is the point:
 *  1. Gray skeleton BARS — a loading affordance. Three of them read as "this
 *     page is broken / nobody uses this" at the moment a visitor is deciding.
 *  2. "These seats are open" + "Maven is new… rather than borrow trust with
 *     quotes we wrote ourselves" — honest, but it ANNOUNCED having no customers
 *     in the middle of the persuasion arc. Nobody asked.
 *
 * It is now a benefit block: the first week of actually using the thing. Same
 * swap contract, nothing fabricated, and no volunteering the weakest fact about
 * a new product. Deliberately temporal ("day one / day two / after that") so it
 * doesn't just restate Transformation's feature contrast in different words.
 *
 * ⚠️ Do NOT add founding-cohort perks here (locked price, early-access badge)
 * until the owner commits to honoring one — see the handoff's open decisions.
 */

interface Testimonial {
  quote: string;
  name: string;
  handle: string;
  /** Real avatar image URL — a MediaSlot placeholder shows until provided. */
  avatar?: string;
}

/** ⚠️ Real, consented creator quotes ONLY. Never fabricate. Empty = placeholders. */
const TESTIMONIALS: readonly Testimonial[] = [];

/** The first week, in the order it actually happens. */
const WEEK: readonly { when: string; title: string; line: string }[] = [
  {
    when: "Day one",
    title: "Calibrate it on a video you already posted",
    line: "You know the real numbers that one did. Run it, and see whether the read lands where the analytics did. That's what the first dollar buys.",
  },
  {
    when: "Day two",
    title: "Run one before it goes out",
    line: "The room watches, the drop point comes back at a specific second, and you recut that beat — while the video is still yours to change.",
  },
  {
    when: "After that",
    title: "You stop posting blind",
    line: "Every video gets read before it ships. You'll know which ones are strong, which need a recut, and which shouldn't go out at all.",
  },
];

function WeekCard({
  when,
  title,
  line,
}: {
  when: string;
  title: string;
  line: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface-sunken/40 p-6">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        {when}
      </span>
      <h3 className="mt-3 text-[16px] font-semibold leading-snug tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-foreground-secondary">{line}</p>
    </div>
  );
}

function RealCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)]">
      <Quotes size={22} weight="fill" className="text-foreground-muted/60" aria-hidden />
      <blockquote className="mt-4 text-[15px] leading-relaxed text-foreground-secondary">
        {t.quote}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-6">
        <MediaSlot
          kind="avatar"
          aspect="1 / 1"
          label=""
          src={t.avatar}
          className="h-11 w-11"
        />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">{t.name}</div>
          <div className="text-[13px] text-foreground-muted">{t.handle}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  const hasReal = TESTIMONIALS.length > 0;

  return (
    <Section divider compact>
      <Reveal gesture="lift">
        <SectionHeading
          eyebrow={hasReal ? "In their words" : "What the first week looks like"}
          title={hasReal ? "Proof, from the people using it" : "A dollar, and you never post blind again"}
          sub={
            hasReal
              ? "Creators who saw the reaction before they posted."
              : "It takes one video to know whether you trust it — and it starts with one you've already posted, where you know the answer."
          }
        />
      </Reveal>

      <Stagger className="mx-auto mt-12 grid max-w-5xl items-stretch gap-5 md:grid-cols-3" step={0.08}>
        {hasReal
          ? TESTIMONIALS.map((t) => (
              <StaggerItem key={t.handle} gesture="settle" className="flex">
                <div className="flex w-full">
                  <RealCard t={t} />
                </div>
              </StaggerItem>
            ))
          : WEEK.map((w) => (
              <StaggerItem key={w.when} gesture="settle" className="flex">
                <div className="flex w-full">
                  <WeekCard {...w} />
                </div>
              </StaggerItem>
            ))}
      </Stagger>

      {/* The block ends on the action it just described, not on a disclaimer. */}
      {!hasReal && (
        <Reveal gesture="rise" className="mt-10 flex flex-col items-center gap-3">
          <PrimaryCta href={SIGNUP_URL} size="lg">
            Start day one — {TRIAL.price}
          </PrimaryCta>
          <p className="text-center text-[13px] text-foreground-muted">{TRIAL.microcopy}</p>
        </Reveal>
      )}
    </Section>
  );
}
