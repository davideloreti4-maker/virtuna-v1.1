import { Section, SectionHeading } from "./section-shell";
import { Reveal } from "@/components/offer/motion/reveal";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * DemoVideo — the band reserved for a real screen-recorded walkthrough (drop a
 * video in → the room reacts → the verdict, in about 90 seconds). Seeing the
 * product move earns more belief than any claim, so it keeps its own tone-zone.
 *
 * The slot is intentionally still EMPTY (owner call — the recording doesn't
 * exist yet). Fill it by passing `videoSrc` + `poster` — a one-line swap, no
 * layout change — and move the section back above Pricing when you do.
 *
 * ⚠️ The copy used to apologize for the gap ("we're recording it on a live run
 * rather than staging one — it lands here when it's honest"). A visitor deciding
 * whether to pay does not need our production notes; the section now states what
 * the walkthrough shows and points at the thing that IS here. Keep it neutral.
 */
export function DemoVideo() {
  return (
    <Section tone="sunken" divider compact>
      <Reveal gesture="lift">
        <SectionHeading
          eyebrow="See it work"
          title="The whole loop, unedited"
          sub="One real video in, one real read out — no cuts, no time-lapse. The full walkthrough lands here soon."
        />
      </Reveal>

      <Reveal gesture="wipe" delay={0.08} className="mx-auto mt-10 max-w-3xl">
        <MediaSlot
          kind="video"
          aspect="16 / 9"
          label="Full walkthrough — coming soon"
          hint="1920×1080 · .mp4 · ~90s"
        />
        <p className="mt-4 text-center text-[13px] text-foreground-muted">
          Every screen above is photographed straight from the app, at full size.
        </p>
      </Reveal>
    </Section>
  );
}
