import { Section, SectionHeading } from "./section-shell";
import { Reveal, Parallax, CountUp } from "@/components/offer/motion/reveal";
import { ProductShot, SHOTS, type ShotSpec } from "@/components/offer/product-shot";
import { FREE_ENTRY, PrimaryCta } from "@/components/offer/cta-config";
import { cn } from "@/lib/utils";

/**
 * How it works — the friction-reduction beat, SHOWN with real product pixels.
 *
 * Restructured from a 3-column grid to three alternating rows. The grid put each
 * screenshot in a ~320px column, and app UI downscaled that far is unreadable —
 * which defeats the entire point of showing the real thing. Wide rows give each
 * shot ~620px, where the score, the names and the quotes are legible.
 *
 * The section also closes the loop: three steps then the CTA, so a visitor
 * convinced by the mechanism doesn't have to hunt for the ask.
 */

interface Step {
  n: string;
  title: string;
  body: React.ReactNode;
  shot: ShotSpec;
  /** The shot's own chrome — the composer is a component, the room is a surface. */
  chrome?: boolean;
  maxHeight?: number;
  caption: string;
}

const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Drop the video in",
    body: "Paste a TikTok link or drop the file straight from your camera roll. No export, no dashboard to learn.",
    shot: SHOTS.paste,
    caption: "The composer, with Test selected — that's the whole input.",
  },
  {
    n: "02",
    title: "A room of viewers watches it",
    body: (
      <>
        A synthetic audience watches frame by frame and reacts — who stops, who scrolls,
        and where your believers cluster.
      </>
    ),
    shot: SHOTS.react,
    maxHeight: 520,
    caption: "38.2% would stop — the read in one sentence, and how each cohort of viewers reacted.",
  },
  {
    n: "03",
    title: "You get the verdict, then the fix",
    body: (
      <>
        Craft score, the drivers behind it, and the exact second attention drops — in about{" "}
        <span className="font-semibold text-foreground">
          <CountUp value={90} className="text-foreground" />s
        </span>
        , not the two days real data takes.
      </>
    ),
    shot: SHOTS.verdict,
    caption: "The read: 77 craft, hook 87 — and a flagged drop at 0:06.",
  },
];

function StepRow({ step, i }: { step: Step; i: number }) {
  const flip = i % 2 === 1;
  return (
    // The media column is sized per-row, not by order alone: with a single
    // `[1fr_620px]` template, a flipped row put the SHOT in the flexible column
    // and shrank it to ~345px — illegible app UI, which defeats showing the real
    // thing. Swapping the template keeps the shot wide on both sides.
    <div
      className={cn(
        "grid items-center gap-8 md:gap-14",
        flip
          ? "md:grid-cols-[minmax(0,600px)_minmax(0,1fr)]"
          : "md:grid-cols-[minmax(0,1fr)_minmax(0,600px)]",
      )}
    >
      {/* copy */}
      <Reveal
        gesture="rise"
        className={cn("md:order-1", flip && "md:order-2")}
      >
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground-muted">
            {step.n}
          </span>
          <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {step.title}
          </h3>
        </div>
        <p className="mt-3 max-w-[42ch] text-[15.5px] leading-relaxed text-foreground-secondary">
          {step.body}
        </p>
        <p className="mt-4 max-w-[42ch] border-l border-border pl-3 text-[12.5px] leading-relaxed text-foreground-muted">
          {step.caption}
        </p>
      </Reveal>

      {/* the real surface */}
      <Parallax
        distance={18}
        className={cn("md:order-2", flip && "md:order-1")}
      >
        <Reveal gesture="wipe">
          <ProductShot
            shot={step.shot}
            sizes="(min-width: 768px) 600px, 92vw"
            chrome={step.chrome}
            edge={step.maxHeight ? "fade" : "none"}
            maxHeight={step.maxHeight}
          />
        </Reveal>
      </Parallax>
    </div>
  );
}

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="sunken" divider>
      <Reveal gesture="lift">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to a verdict"
          sub="One input, one wait, one answer — the whole loop fits before your coffee's cold."
        />
      </Reveal>

      <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-16 md:gap-24">
        {STEPS.map((step, i) => (
          <StepRow key={step.n} step={step} i={i} />
        ))}
      </div>

      {/* Close the loop here — the mechanism is the most convincing beat on the
          page, and the ask used to be 3,000px further down. */}
      <Reveal gesture="settle" className="mt-16 flex flex-col items-center gap-3">
        <PrimaryCta href={FREE_ENTRY.href} size="lg">
          {FREE_ENTRY.label}
        </PrimaryCta>
        <p className="text-center text-[13px] text-foreground-muted">{FREE_ENTRY.microcopy}</p>
      </Reveal>
    </Section>
  );
}
