"use client";

import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section-shell";

/**
 * FAQ — objection handling, placed right after pricing and before the final
 * ask (the moment a buyer's last doubts surface). The lone client island here:
 * Radix accordion needs React context.
 *
 * Cold-brand Radix defaults are overridden at the call site (never edit the
 * shared ui/accordion primitive): border-border, bg-surface-elevated/50,
 * text-foreground, [&>svg]:text-foreground. No coral — accent stays precious.
 *
 * Copy is reconciled to the page's honest claims (1,000 simulated viewers,
 * ~90s, the $1 trial). No fabricated counts or testimonials.
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
    a: "Maven runs a synthetic audience — 1,000 simulated viewer profiles built from real engagement patterns. Each profile watches your video frame by frame and reacts the way real TikTok audiences do. The result is your predicted score, watch-through %, and the exact second viewers are most likely to drop. It's not a guess — it's a simulation.",
  },
  {
    id: "faq-platforms",
    q: "Does it work for platforms other than TikTok?",
    a: "Right now Maven is TikTok-first — the model is trained on TikTok-specific engagement patterns: scroll behavior, hook windows, watch-through benchmarks. Instagram Reels and YouTube Shorts are on the roadmap. For TikTok creators, you get the most accurate predictions available.",
  },
  {
    id: "faq-niche",
    q: "What if my niche is small or unusual?",
    a: "Maven models viewer behavior rather than content categories, so it holds up across niches. Whether you make finance content, dark comedy, or a niche hobby, the simulation adapts to what viewers in your category actually respond to — short hooks, slow builds, rapid cuts, or long storytelling.",
  },
  {
    id: "faq-privacy",
    q: "Does Maven store or share my videos?",
    a: "No. Maven reads your TikTok link — the video stays on TikTok's servers, not ours. We never upload or retain your content, and your results are private to your account. Never shared, never sold.",
  },
  {
    id: "faq-free-trial",
    q: "Is there a free trial?",
    a: "Not a free one — a $1 one. Any plan starts at $1 for 3 days and includes 50 credits, enough for 5 full Readings to judge the predictions against your own videos. Every feature of the plan you picked is unlocked. On day 4 it renews at the plan price unless you cancel, and you can cancel any time from settings. We'd rather charge you a dollar and show you the real product than hand you a crippled free tier.",
  },
  {
    id: "faq-duration",
    q: "How long does a prediction take?",
    a: "About 90 seconds. You paste a link, the synthetic audience runs, and you get the full report — score, watch-through %, hook strength, and drop point — before you'd have posted and waited 48 hours for real numbers.",
  },
] as const;

export function Faq() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered"
        sub="Everything worth knowing before your first prediction."
      />

      <div className="mx-auto mt-12 max-w-2xl">
        <AccordionRoot type="single" collapsible className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="border-border bg-surface-elevated/50"
            >
              <AccordionTrigger className="text-left text-foreground hover:text-foreground/80 [&>svg]:text-foreground">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-foreground-secondary">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </AccordionRoot>
      </div>
    </Section>
  );
}
