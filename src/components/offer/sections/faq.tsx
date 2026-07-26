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
 * revert it to the friendlier wording.
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
    id: "faq-wrong",
    q: "What if the prediction is wrong?",
    a: "Sometimes it will be — it's a model of viewer behaviour, not a view counter, and the app labels a read Directional when that's what it is. What it's reliably good at is the thing you can act on: finding the moment your video loses people and naming the change that addresses it. Judge it on your own videos during the trial, on content whose real numbers you already know. That comparison is exactly what the $1 is for.",
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
    a: "Reading frames means Maven has to process the file, so your video is fetched (or uploaded) and stored while the read runs — that's the honest answer, and any tool claiming otherwise isn't reading your frames. It is never published, never shown to another user, and never sold or used to sell. Your results are private to your account.",
  },
  {
    id: "faq-free-trial",
    q: "Is there a free trial?",
    a: "Not a free one — a $1 one. Any plan starts at $1 for 3 days and includes 50 credits, enough for 5 full Readings to judge the predictions against your own videos. Every feature of the plan you picked is unlocked. On day 4 it renews at the plan price unless you cancel, and you can cancel any time from settings. We'd rather charge you a dollar and show you the real product than hand you a crippled free tier.",
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
              sub="Everything worth knowing before your first read — including the parts that don't flatter us."
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
