import { Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";
import { ComposerSketch, RoomSketch, ScoreSketch } from "../sketch";

/**
 * How it works — the only numbered block on the page, because it is the only
 * content that IS a sequence. The numbers are mono, tying the steps to the
 * instrument voice rather than to a decorative "01/02/03" gutter. Each step's
 * frame carries a sketch of the actual screen: the story is told by the
 * surfaces, and the prose under each is one line.
 */

const STEPS = [
  {
    n: "01",
    title: "Drop in your draft",
    body: "Paste a link or upload the cut. No setup.",
    slotLabel: "The composer",
    sketch: <ComposerSketch />,
  },
  {
    n: "02",
    title: "A thousand viewers watch",
    body: "Personas in your niche, second by second.",
    slotLabel: "Animation · the simulation",
    play: "sm" as const,
    sketch: <RoomSketch />,
  },
  {
    n: "03",
    title: "Post the cut that holds",
    body: "The drop moment, the reason, the fix.",
    slotLabel: "The verdict",
    sketch: <ScoreSketch />,
  },
] as const;

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="From draft to verdict in 90 seconds"
    >
      <div className="grid gap-x-5 gap-y-12 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={i * 70}>
            {/* group: hovering anywhere on a step lifts its frame's tone — the
                step is one object, and it answers the cursor as one. */}
            <div className="group">
              <Slot
                variant="image"
                ratio="4 / 3"
                label={step.slotLabel}
                play={"play" in step ? step.play : undefined}
                className="transition-colors duration-200 group-hover:bg-[color:var(--lp-card-lift)]"
              >
                {step.sketch}
                {/* the step's index, stamped on the frame like the caption chip
                    it mirrors — the sequence lives on the surfaces themselves */}
                <span className="absolute left-3 top-3 rounded-md border border-[color:var(--lp-line)] bg-[color:var(--lp-bg-alt)] px-2 py-1">
                  <span className="lp-mono text-[10px] tracking-[0.12em] text-[color:var(--lp-fg-2)]">
                    {step.n}
                  </span>
                </span>
              </Slot>
              <h3 className="lp-h3 mt-6">{step.title}</h3>
              <p className="lp-card-body mt-2 text-[color:var(--lp-fg-3)] md:pr-4">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
