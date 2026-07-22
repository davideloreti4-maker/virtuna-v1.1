import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { MediaSlot } from "@/components/offer/media-slot";
import { cn } from "@/lib/utils";

/**
 * Transformation — the loss-aversion beat, restyled as an asymmetric split:
 * the argument (copy + the two contrast lists) on the left, a real before/after
 * VISUAL on the right (two 9:16 slots — "posted blind" vs "read by Maven first",
 * to be filled with real screenshots). Conceptual + honest — it names the stakes
 * and shows the shape of the difference; it does NOT re-render the product.
 *
 * The Maven side is the one lit element (a single coral liveness dot); the blind
 * side stays muted/dashed, reading as the "before" you want to leave.
 */

const BLIND = [
  "You post, then refresh — hoping the first 3 seconds landed.",
  "A flat video costs you a week of reach you can't get back.",
  "No idea why it missed, so the next one is another coin flip.",
];

const KNOWN = [
  "See the verdict before you post — score, watch-through, drop point.",
  "Watch 1,000 simulated viewers react, second by second.",
  "Get the one fix that moves the number — then post with proof.",
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
      <ul className="mt-3.5 flex flex-col gap-2.5" role="list">
        {rows.map((row) => (
          <li
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
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Transformation() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* LEFT — the argument */}
        <div>
          <SectionHeading
            align="left"
            eyebrow="The difference"
            title={
              <>
                One posts and hopes. <br className="hidden sm:block" />
                The other already knows.
              </>
            }
            sub="Same video, two different creators. The gap between them isn't luck — it's whether they saw the reaction first."
          />

          <div className="mt-8 flex flex-col gap-6">
            <BlurFade delay={0.05} direction="up">
              <ContrastList kicker="Posting blind" rows={BLIND} tone="blind" />
            </BlurFade>
            <div className="h-px w-full bg-border" />
            <BlurFade delay={0.12} direction="up">
              <ContrastList kicker="Posting with Maven" rows={KNOWN} tone="known" />
            </BlurFade>
          </div>
        </div>

        {/* RIGHT — the before/after visual */}
        <BlurFade delay={0.14} direction="up">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)] md:p-6">
            <div className="grid grid-cols-2 gap-4">
              <figure className="flex flex-col gap-3">
                <MediaSlot
                  kind="thumbnail"
                  aspect="9 / 16"
                  label="Screenshot: a flat post's analytics"
                  hint="1080×1920"
                />
                <figcaption className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                  <span className="h-1.5 w-1.5 rounded-full border border-foreground-muted/60" />
                  Posted blind
                </figcaption>
              </figure>

              <figure className="flex flex-col gap-3">
                <MediaSlot
                  kind="screenshot"
                  aspect="9 / 16"
                  label="Screenshot: the Maven verdict on the same video"
                  hint="1080×1920"
                />
                <figcaption className="flex items-center gap-2 text-[12.5px] font-medium text-foreground-secondary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  Read by Maven first
                </figcaption>
              </figure>
            </div>
          </div>
        </BlurFade>
      </div>
    </Section>
  );
}
