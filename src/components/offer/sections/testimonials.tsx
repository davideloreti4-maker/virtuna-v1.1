import { Quotes } from "@phosphor-icons/react/dist/ssr";
import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * Testimonials — social proof, HONESTLY. This page must never ship fabricated
 * quotes, names, or counts (locked rule). So this section renders clearly-marked
 * swap-ready placeholders until real, consented creator quotes exist. The moment
 * the owner adds entries to TESTIMONIALS, real cards render in place of the
 * placeholders — no other change. An empty, labeled slot is honest; an invented
 * quote is not.
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

function PlaceholderCard() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-dashed border-border-hover/50 bg-surface-sunken/40 p-6">
      <Quotes size={22} weight="fill" className="text-foreground-muted/50" aria-hidden />
      <div className="mt-4 flex flex-col gap-2">
        <span className="h-2.5 w-full rounded-full bg-border" />
        <span className="h-2.5 w-[92%] rounded-full bg-border" />
        <span className="h-2.5 w-[70%] rounded-full bg-border" />
      </div>
      <div className="mt-auto flex items-center gap-3 pt-6">
        <MediaSlot kind="avatar" aspect="1 / 1" label="" className="h-11 w-11" />
        <div className="flex flex-col gap-1.5">
          <span className="h-2.5 w-24 rounded-full bg-border" />
          <span className="h-2 w-16 rounded-full bg-border/70" />
        </div>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-foreground-muted/80">
        Real creator results land here — added as users come in, never invented.
      </p>
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
  const cards = hasReal ? TESTIMONIALS : [0, 1, 2];

  return (
    <Section tone="sunken" divider>
      <SectionHeading
        eyebrow="In their words"
        title="Proof, from the people using it"
        sub={
          hasReal
            ? "Creators who saw the reaction before they posted."
            : "Maven is new — so these fill in with real creator results as they come in. We'd rather show you a placeholder than a quote we made up."
        }
      />

      <div className="mx-auto mt-12 grid max-w-5xl items-stretch gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <BlurFade key={i} delay={0.05 + i * 0.08} direction="up" className="flex">
            <div className="flex w-full">
              {hasReal ? <RealCard t={c as Testimonial} /> : <PlaceholderCard />}
            </div>
          </BlurFade>
        ))}
      </div>
    </Section>
  );
}
