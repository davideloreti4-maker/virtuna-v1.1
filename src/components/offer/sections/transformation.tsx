import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { cn } from "@/lib/utils";

/**
 * Transformation — the loss-aversion beat. A before/after contrast: posting
 * blind (a gamble) vs posting with Maven (a verdict). Conceptual, honest — it
 * does NOT re-render the product; it names the stakes.
 *
 * The RIGHT panel is the one lit element (a single coral liveness dot + a tone
 * step to bg-surface); the LEFT stays muted and dashed, reading as the "before"
 * you want to leave. RSC — composes the client BlurFade for entrance.
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

function Panel({
  kicker,
  title,
  rows,
  tone,
}: {
  kicker: string;
  title: string;
  rows: readonly string[];
  tone: "blind" | "known";
}) {
  const known = tone === "known";
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-7 md:p-8",
        known
          ? "border border-border-hover/40 bg-surface shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)]"
          : "border border-dashed border-border bg-transparent",
      )}
    >
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

      <h3
        className={cn(
          "mt-4 text-xl font-semibold tracking-tight",
          known ? "text-foreground" : "text-foreground-secondary",
        )}
      >
        {title}
      </h3>

      <ul className="mt-5 flex flex-col gap-3.5" role="list">
        {rows.map((row) => (
          <li
            key={row}
            className={cn(
              "flex items-start gap-2.5 text-[15px] leading-relaxed",
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
      <SectionHeading
        eyebrow="The difference"
        title={
          <>
            One posts and hopes. <br className="hidden sm:block" />
            The other already knows.
          </>
        }
        sub="Same video, two different creators. The gap between them isn't luck — it's whether they saw the reaction first."
      />

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:mt-14 lg:grid-cols-2">
        <BlurFade delay={0.05} direction="up">
          <Panel
            kicker="Posting blind"
            title="A gamble, every single time."
            rows={BLIND}
            tone="blind"
          />
        </BlurFade>
        <BlurFade delay={0.14} direction="up">
          <Panel
            kicker="Posting with Maven"
            title="A decision, backed by the reaction."
            rows={KNOWN}
            tone="known"
          />
        </BlurFade>
      </div>
    </Section>
  );
}
