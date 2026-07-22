import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { NumberTicker } from "@/components/velora/number-ticker";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * How it works — the friction-reduction beat, now SHOWN not just told. Three
 * steps, each with a real product screenshot slot (paste → read → verdict) so
 * the process reads as concrete and easy. Large muted ordinals, a live count-up
 * on the time-to-verdict. RSC composing the client motion primitives.
 */

interface Step {
  n: string;
  title: string;
  body: React.ReactNode;
  shot: string;
}

const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Paste any TikTok link",
    body: "No upload, no export, no waiting. Drop a URL — yours or one you're studying.",
    shot: "Screenshot: the composer with a TikTok link pasted in",
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
    shot: "Screenshot: the room of viewers reacting, second by second",
  },
  {
    n: "03",
    title: "See the verdict + the fix",
    body: "Your score, watch-through %, the exact second viewers drop — and the one change that moves it.",
    shot: "Screenshot: the verdict card — score, retention curve, the one fix",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow="How it works"
        title="Three taps to a verdict"
        sub="No dashboard to learn. The whole loop fits before your coffee's cold."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, i) => (
          <BlurFade key={step.n} delay={0.05 + i * 0.1} direction="up">
            <div className="flex flex-col">
              <MediaSlot kind="screenshot" aspect="4 / 3" label={step.shot} hint="app UI" />
              <div className="mt-5 flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground-muted">
                  {step.n}
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground-secondary">
                {step.body}
              </p>
            </div>
          </BlurFade>
        ))}
      </div>
    </Section>
  );
}
