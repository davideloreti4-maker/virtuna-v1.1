"use client";

import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * FaqAccordion — CONVERT-03 client island.
 *
 * The LONE Phase-4 client component: Radix requires React context so the
 * accordion must be `"use client"`. Everything above (Faq RSC wrapper,
 * section heading, page.tsx) stays RSC → / stays statically prerendered.
 *
 * - type="single" collapsible: one panel open at a time, close-all allowed (D-16).
 * - 6 objection-busting Q&A entries (D-15).
 * - Cold-brand Radix tokens overridden via className at the call site (RESEARCH
 *   option A — never modify the shared ui/accordion.tsx primitive):
 *     border-border           replaces border-white/[0.06]
 *     bg-surface-elevated/50  replaces bg-background-elevated/50
 *     text-foreground         replaces text-white
 *     text-foreground/80      replaces text-white/80
 *     text-foreground-secondary replaces text-gray-400
 *     [&>svg]:text-foreground recolors the CaretDown chevron — its direct
 *       text-white is not className-inheritable, so an arbitrary `> svg`
 *       variant overrides it by specificity, still WITHOUT touching the
 *       shared primitive (CR-01).
 * - No dangerouslySetInnerHTML (T-04-03-01 — React escapes strings natively).
 * - No coral (keep accent precious — only CTA uses it).
 */

interface FaqItem {
  /** Stable identity — used as the Radix value + React key so copy edits to `q`
   *  never reset accordion state or collide on duplicate questions (WR-01). */
  id: string;
  q: string;
  a: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "faq-how-it-works",
    q: "How does it actually know if my video will perform?",
    a: "Maven runs a synthetic audience — thousands of simulated viewer profiles built from real engagement patterns. Each profile watches your video frame-by-frame and reacts the way real TikTok audiences do. The result is your predicted score, watch-through %, and the exact second viewers are most likely to drop. It's not a guess — it's a simulation.",
  },
  {
    id: "faq-platforms",
    q: "Does it work for platforms other than TikTok?",
    a: "Right now Maven is TikTok-first. The simulation model is trained on TikTok-specific engagement patterns — scroll behavior, hook windows, watch-through benchmarks. Instagram Reels and YouTube Shorts are on the roadmap. For TikTok creators, you get the most accurate predictions available.",
  },
  {
    id: "faq-niche",
    q: "What if my niche is small or unusual?",
    a: "Maven performs well across niches because it models viewer behavior rather than content categories. Whether you make finance content, dark comedy, or niche hobby videos, the audience simulation adapts to what viewers in your category actually respond to — short hooks, longer storytelling, rapid cuts, or slow builds.",
  },
  {
    id: "faq-privacy",
    q: "Does Maven store or share my videos?",
    a: "No. Maven analyzes your TikTok link — the video lives on TikTok's servers, not ours. We never upload or retain your content. Your analysis results are private to your account and are never shared or sold.",
  },
  {
    // Owner-locked 2026-07-13: there is no free tier. Every plan opens with a $1 / 3-day
    // trial that converts at the plan price — so this answer must say so plainly, including
    // the card and the renewal. Promising "free, no credit card" here while the checkout
    // charges a dollar is how you earn chargebacks.
    id: "faq-free-trial",
    q: "Is there a free trial?",
    a: "Not a free one — a $1 one. Any plan starts at $1 for 3 days and includes 5 Readings: enough to judge the predictions against your own videos. Every feature of the plan you picked is unlocked. On day 4 it renews at the plan price unless you cancel, and you can cancel any time from settings. We'd rather charge you a dollar and show you the real product than hand you a crippled free tier.",
  },
  {
    id: "faq-duration",
    q: "How long does a Simulation take?",
    a: "Most Simulations complete in under 90 seconds. You paste a TikTok link, the synthetic audience runs, and you get a full prediction report — score, watch-through %, hook strength, and drop-point — before you would have posted and waited 48 hours for real data.",
  },
] as const;

export function FaqAccordion({ className }: { className?: string }) {
  return (
    <AccordionRoot
      type="single"
      collapsible
      className={cn(className)}
    >
      {FAQ_ITEMS.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className="border-border bg-surface-elevated/50"
        >
          <AccordionTrigger className="text-foreground hover:text-foreground/80 [&>svg]:text-foreground">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="text-foreground-secondary">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
