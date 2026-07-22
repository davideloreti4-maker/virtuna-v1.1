import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { NumberTicker } from "@/components/velora/number-ticker";

/**
 * How it works — the friction-reduction beat. Three steps, framed to feel like
 * almost no effort: paste, wait ~90s, know. Large muted ordinals, a live
 * count-up on the time-to-verdict. RSC composing the client motion primitives.
 */

interface Step {
  n: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Paste any TikTok link",
    body: "No upload, no export, no waiting. Drop a URL — yours or one you're studying.",
  },
  {
    n: "02",
    title: "The audience reacts",
    body: (
      <>
        A synthetic crowd watches frame by frame — a verdict in{" "}
        <span className="font-semibold text-foreground">
          <NumberTicker value={90} className="text-foreground" />s
        </span>
        , not the 48 hours real data takes.
      </>
    ),
  },
  {
    n: "03",
    title: "See the verdict + the fix",
    body: "Your score, watch-through %, the exact second viewers drop — and the one change that moves it.",
  },
];

export function HowItWorks() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="How it works"
        title="Three taps to a verdict"
        sub="No dashboard to learn. The whole loop fits before your coffee's cold."
      />

      <div className="relative mx-auto mt-14 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-6">
        {/* connective rule on desktop — a calm hairline behind the steps */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[16%] top-[22px] hidden h-px bg-border md:block"
        />
        {STEPS.map((step, i) => (
          <BlurFade key={step.n} delay={0.05 + i * 0.1} direction="up">
            <div className="relative flex flex-col items-center text-center md:items-start md:text-left">
              <span className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground-muted">
                {step.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-foreground-secondary">
                {step.body}
              </p>
            </div>
          </BlurFade>
        ))}
      </div>
    </Section>
  );
}
