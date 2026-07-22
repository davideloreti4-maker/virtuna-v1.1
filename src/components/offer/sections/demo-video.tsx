import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { MediaSlot } from "@/components/offer/media-slot";

/**
 * DemoVideo — the highest-intent trust asset: a full-bleed sunken band holding
 * one big 16:9 slot for a real screen-recorded walkthrough (paste → read →
 * verdict in ~90s). Seeing the product move earns more belief than any claim,
 * so it gets its own tone-zone. Owner drops an .mp4 + poster into the MediaSlot
 * (`videoSrc` / `poster`) later — a one-line swap, no layout change.
 */
export function DemoVideo() {
  return (
    <Section tone="sunken" divider>
      <SectionHeading
        eyebrow="See it work"
        title="Watch Maven read a video — start to verdict"
        sub="No edit tricks, no cuts. A real link in, a real reaction curve out — in about 90 seconds."
      />

      <BlurFade delay={0.1} className="mx-auto mt-12 max-w-4xl">
        <MediaSlot
          kind="video"
          aspect="16 / 9"
          label="Product walkthrough — paste a TikTok link, watch the audience react, read the verdict"
          hint="1920×1080 · .mp4 · ~90s"
        />
        <p className="mt-4 text-center text-[13px] text-foreground-muted">
          A 90-second screen recording of one real Reading, end to end.
        </p>
      </BlurFade>
    </Section>
  );
}
