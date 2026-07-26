import { Section, SectionHeading } from "./section-shell";
import { Reveal } from "@/components/offer/motion/reveal";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * DemoVideo — the band reserved for a real screen-recorded walkthrough (drop a
 * video in → the room reacts → the verdict, in about 90 seconds). Seeing the
 * product move earns more belief than any claim, so it keeps its own tone-zone.
 *
 * The slot is intentionally still EMPTY (owner call — the recording doesn't exist
 * yet). Two things make an empty slot survivable on a live page: the copy tells
 * the visitor what's coming instead of leaking an internal spec (the dimension
 * hint is dev-only now), and the band is sized so it doesn't dominate the scroll.
 * Fill it by passing `videoSrc` + `poster` — a one-line swap, no layout change.
 */
export function DemoVideo() {
  return (
    <Section tone="sunken" divider compact>
      <Reveal gesture="lift">
        <SectionHeading
          eyebrow="See it work"
          title="The whole loop, unedited"
          sub="No cuts, no time-lapse: one real video in, one real read out. We're recording it on a live run rather than staging one — it lands here when it's honest."
        />
      </Reveal>

      <Reveal gesture="wipe" delay={0.08} className="mx-auto mt-10 max-w-3xl">
        <MediaSlot
          kind="video"
          aspect="16 / 9"
          label="The full walkthrough is being recorded on a live run"
          hint="1920×1080 · .mp4 · ~90s"
        />
        <p className="mt-4 text-center text-[13px] text-foreground-muted">
          Until then, everything shown above is photographed straight from the app — not mocked up.
        </p>
      </Reveal>
    </Section>
  );
}
