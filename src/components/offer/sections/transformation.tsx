import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem, Parallax } from "@/components/offer/motion/reveal";
import { ShotFigure, SHOTS } from "@/components/offer/product-shot";
import { FREE_ENTRY } from "@/components/offer/cta-config";
import { FreeEntryCta } from "@/components/offer/free-entry-cta";
import { cn } from "@/lib/utils";

/**
 * Transformation — the loss-aversion beat, as an asymmetric split: the argument
 * (copy + the two contrast lists) on the left, and on the right the REAL output
 * that makes "already knows" concrete — the director's fixes, photographed from
 * the shipped card.
 *
 * It used to hold two empty 9:16 placeholders labelled "a flat post's analytics"
 * and "the Maven verdict". The first was unbuildable honestly (we can't produce
 * someone's TikTok analytics), and two boxes split the eye. One real artifact,
 * captioned, argues harder than a matched pair of drawings.
 *
 * The Maven side is the one lit element (a single coral liveness dot); the blind
 * side stays muted, reading as the "before" you want to leave.
 */

const BLIND = [
  "Post, then refresh — hoping the first three seconds landed.",
  "A flat video burns a week of reach you don't get back.",
  "No idea why it missed, so the next one is another coin flip.",
];

const KNOWN = [
  "The verdict before you post — score, drop point, watch-through.",
  "The exact second attention goes, and who leaves at it.",
  "One named fix, with the frame it refers to.",
];

function ContrastList({
  kicker,
  rows,
  tone,
}: {
  kicker: string;
  rows: readonly string[];
  tone: "blind" | "known";
}) {
  const known = tone === "known";
  return (
    <div>
      <div className="flex items-center gap-2">
        {known ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full border border-foreground-muted/60" />
        )}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            known ? "text-foreground-secondary" : "text-foreground-muted",
          )}
        >
          {kicker}
        </span>
      </div>
      <Stagger as="ul" className="mt-3.5 flex flex-col gap-2.5" step={0.07}>
        {rows.map((row) => (
          <StaggerItem
            as="li"
            key={row}
            className={cn(
              "flex items-start gap-2.5 text-[14.5px] leading-relaxed",
              known ? "text-foreground-secondary" : "text-foreground-muted",
            )}
          >
            <span aria-hidden className="mt-0.5 shrink-0 text-base leading-none">
              {known ? "✓" : "✗"}
            </span>
            {row}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export function Transformation() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-16">
        {/* LEFT — the argument */}
        <div>
          <Reveal gesture="lift">
            <SectionHeading
              align="left"
              eyebrow="The difference"
              title={
                <>
                  One posts and hopes. <br className="hidden sm:block" />
                  The other already knows.
                </>
              }
              sub="Same video, two creators. The gap isn't luck — it's whether they saw the reaction first."
            />
          </Reveal>

          <div className="mt-8 flex flex-col gap-6">
            <ContrastList kicker="Posting blind" rows={BLIND} tone="blind" />
            <div className="h-px w-full bg-border" />
            <ContrastList kicker="Posting with Maven" rows={KNOWN} tone="known" />
          </div>
        </div>

        {/* RIGHT — the real output. Parallax gives the artifact depth against the
            copy beside it; the fade says the card continues past the crop. */}
        <Parallax distance={22}>
          <ShotFigure
            shot={SHOTS.fixes}
            sizes="(min-width: 1024px) 520px, 92vw"
            edge="fade"
            maxHeight={620}
            caption={
              <>
                Real output — the fix, the frame it points at, and a proven example from the
                corpus that ran 14.2× its creator&apos;s usual views.
              </>
            }
          />
        </Parallax>
      </div>

      {/* The first ask, at ~2,200px. Before this, the earliest CTA below the hero
          was HowItWorks' at ~3,900px — a visitor sold by the contrast alone had
          to scroll two more sections to find one. Deliberately quieter than the
          pricing ask (a line of context above it, no card, no badge): this is an
          exit ramp for the already-convinced, not the page's main close. */}
      <Reveal gesture="settle" className="mt-14 flex flex-col items-center gap-3 md:mt-16">
        <p className="max-w-[38ch] text-center text-[15px] leading-relaxed text-foreground-secondary">
          The gap between the two is one read, and it takes about 90 seconds.
        </p>
        <FreeEntryCta size="lg" />
        {/* text-center matters: the microcopy is one line at 1440 but wraps at
            390, and without it the orphan hangs left under a centered button. */}
        <p className="text-center text-[13px] text-foreground-muted">{FREE_ENTRY.microcopy}</p>
      </Reveal>
    </Section>
  );
}
