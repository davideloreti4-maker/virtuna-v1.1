"use client";

import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section-shell";
import { Reveal, Stagger, StaggerItem } from "@/components/offer/motion/reveal";

/**
 * FAQ — objection handling, placed right after pricing and before the final
 * ask (the moment a buyer's last doubts surface). The lone client island here:
 * Radix accordion needs React context.
 *
 * Cold-brand Radix defaults are overridden at the call site (never edit the
 * shared ui/accordion primitive): border-border, bg-surface-elevated/50,
 * text-foreground, [&>svg]:text-foreground. No coral — accent stays precious.
 *
 * Copy is reconciled to the page's honest claims (~90s, the $1 trial, the two
 * simulation scales). No fabricated counts or testimonials.
 *
 * ⚠️ The privacy answer used to say "the video stays on TikTok's servers, not
 * ours. We never upload or retain your content." That is false — reading frames
 * requires the file, so `/api/analyze` re-hosts a `tiktok_url` and stores an
 * upload in Supabase storage. It now describes what actually happens. Don't
 * revert it to the friendlier wording. It was cut to three sentences on
 * 2026-07-26 (the argumentative "any tool claiming otherwise…" aside was
 * defensive, not informative) — shorter, same facts. Accuracy here is a
 * chargeback question, so trim it, never soften it.
 *
 * Tone pass 2026-07-26: "What if the prediction is wrong?" led the accuracy
 * objection with our own doubt and answered "sometimes it will be". It's now
 * "How accurate is it?", answered with what the read is strongest at and a
 * concrete way to test it inside the trial. Nothing was over-claimed — the
 * Directional-labelling caveat simply belongs in the app, where it renders on
 * the read itself, not pre-empted on the sales page.
 */

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "faq-how-it-works",
    q: "How does it actually know if my video will perform?",
    a: "It reads your video frame by frame — hook, pacing, every cut — against a corpus of 500 dissected viral videos, then runs a room of viewer profiles built from real engagement patterns. Each one watches and reacts in character. You get a craft score, the drivers behind it, the second attention drops, and who leaves at it. It's a simulation with reasoning you can inspect, not a number from a black box.",
  },
  {
    id: "faq-accuracy",
    q: "How accurate is it?",
    a: "It's strongest at the part you can act on: finding the second your video loses people, and naming the change that fixes it. Test that the fast way — run a video whose real numbers you already know and see whether the read matches what happened. Your first read is free, so that comparison costs you nothing.",
  },
  {
    id: "faq-platforms",
    q: "Does it work for platforms other than TikTok?",
    a: "TikTok first — the model is built on TikTok-specific engagement patterns: scroll behaviour, hook windows, watch-through benchmarks. Instagram Reels and YouTube Shorts are on the roadmap, not shipped. If you post short-form elsewhere, the craft read still applies; the reception numbers are calibrated for TikTok.",
  },
  {
    id: "faq-niche",
    q: "What if my niche is small or unusual?",
    a: "Maven models viewer behaviour rather than content categories, so it holds up across niches. Whether you make finance content, dark comedy, or a niche hobby, the room adapts to what viewers in your category respond to — short hooks, slow builds, rapid cuts, long storytelling.",
  },
  {
    id: "faq-scale",
    q: "How many viewers actually watch it?",
    a: "Two scales, and they're different things. Every plan gives you a room of ten named viewers who react in their own words — that's the part you read. Pro adds population depth: the same reaction modelled across a thousand viewer profiles, for the aggregate numbers. Ten voices you can read, or a thousand you can count.",
  },
  {
    id: "faq-privacy",
    q: "What happens to my video?",
    a: "It's fetched (or uploaded) and stored while the read runs — reading frames means processing the file. It is never published, never shown to another user, and never sold. Your results are private to your account.",
  },
  {
    id: "faq-free-trial",
    q: "Is there a free trial?",
    a: "Your first Test is free — right from this page, no account. You get the full craft read on your own video. The simulation verdict on it (the room's reaction, the why, the fix) unlocks for $1, which also starts 3 days of the plan you pick with 50 credits — enough for 5 full Readings. On day 4 it renews at the plan price unless you cancel, and you can cancel any time from settings.",
  },
  {
    id: "faq-duration",
    q: "How long does a read take?",
    a: "About 90 seconds — you drop the video in, the room watches it, and the full read comes back before you'd have posted and waited two days for real numbers.",
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" tone="sunken" divider>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
        {/* LEFT — heading holds its own column (differentiates from the
            centered-heading sections + reads premium). */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal gesture="lift">
            <SectionHeading
              align="left"
              eyebrow="FAQ"
              title="Questions, answered"
              sub="Everything worth knowing before your first read."
            />
          </Reveal>
        </div>

        {/* RIGHT — the answers */}
        <Stagger step={0.06}>
          <AccordionRoot type="single" collapsible className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <StaggerItem key={item.id} gesture="settle">
                <AccordionItem
                  value={item.id}
                  className="rounded-xl border-border bg-surface-elevated/50"
                >
                  <AccordionTrigger className="text-left text-foreground hover:text-foreground/80 [&>svg]:text-foreground">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-foreground-secondary">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </StaggerItem>
            ))}
          </AccordionRoot>
        </Stagger>
      </div>
    </Section>
  );
}
