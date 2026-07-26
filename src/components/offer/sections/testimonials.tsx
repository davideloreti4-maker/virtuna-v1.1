import { Quotes, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem } from "@/components/offer/motion/reveal";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * Testimonials — social proof, HONESTLY. This page must never ship fabricated
 * quotes, names or counts (locked rule), so the section renders placeholders
 * until real consented creator quotes exist. The moment `TESTIMONIALS` gets
 * entries, real cards render in their place — no other change.
 *
 * The placeholders were gray skeleton BARS, which is a loading affordance: three
 * of them read as "this page is broken / nobody uses this" at the exact moment a
 * visitor is deciding. They now read as what they are — reserved seats in a
 * founding cohort, with the invitation stated. Same swap contract, same honesty,
 * without volunteering the weakest thing about a new product.
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

const RESERVED: readonly { seat: string; line: string }[] = [
  { seat: "Seat 01", line: "The first creator to run a read and post the before/after." },
  { seat: "Seat 02", line: "Someone who used a fix and watched the drop point move." },
  { seat: "Seat 03", line: "A creator who called a flat video before publishing it." },
];

function ReservedCard({ seat, line }: { seat: string; line: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface-sunken/40 p-6">
      <div className="flex items-center gap-2">
        <SealCheck size={17} className="text-foreground-muted" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          {seat} · reserved
        </span>
      </div>
      <p className="mt-4 text-[14.5px] leading-relaxed text-foreground-secondary">{line}</p>
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
          eyebrow={hasReal ? "In their words" : "The founding cohort"}
          title={hasReal ? "Proof, from the people using it" : "These seats are open"}
          sub={
            hasReal
              ? "Creators who saw the reaction before they posted."
              : "Maven is new. Rather than borrow trust with quotes we wrote ourselves, we're keeping these seats for the first creators who actually run reads — and you can be one of them for a dollar."
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
          : RESERVED.map((r) => (
              <StaggerItem key={r.seat} gesture="settle" className="flex">
                <div className="flex w-full">
                  <ReservedCard seat={r.seat} line={r.line} />
                </div>
              </StaggerItem>
            ))}
      </Stagger>

      {/* Said once, under the grid — it read as noise repeated in all three cards. */}
      {!hasReal && (
        <Reveal gesture="rise" className="mt-8">
          <p className="text-center text-[12.5px] text-foreground-muted">
            Each one gets filled with a real, consented quote — or stays empty. Never invented.
          </p>
        </Reveal>
      )}
    </Section>
  );
}
