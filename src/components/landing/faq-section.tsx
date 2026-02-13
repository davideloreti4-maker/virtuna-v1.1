"use client";

import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { FadeIn } from "@/components/motion";

const faqItems = [
  {
    question: "How does Virtuna predict if my content will go viral?",
    answer:
      "Virtuna uses AI-powered 'societies' — thousands of simulated personas that represent real TikTok audiences. We show your content concept to these personas and measure their predicted engagement, giving you a viral probability score before you even film.",
  },
  {
    question: "What's included in the free trial?",
    answer:
      "You get 7 days of full Pro access — unlimited viral predictions, brand deal matching, trend intelligence, and audience insights. No feature limits during the trial. A payment method is required to start, and you can cancel anytime before the trial ends.",
  },
  {
    question: "What's the difference between Starter and Pro?",
    answer:
      "Starter gives you essential viral prediction and basic trend data. Pro unlocks unlimited predictions, advanced audience insights, brand deal matching, and priority support. Most serious creators choose Pro for the full suite of monetization tools.",
  },
  {
    question: "How accurate are the viral predictions?",
    answer:
      "Our AI societies achieve 86% accuracy in predicting content engagement patterns, validated through extensive testing against real TikTok performance data. That's significantly better than gut feeling or basic analytics.",
  },
  {
    question: "Do I need a minimum follower count?",
    answer:
      "No. Virtuna works for creators of all sizes — from just starting out to millions of followers. The AI predictions are based on content quality and audience fit, not your current follower count.",
  },
  {
    question: "How does brand deal matching work?",
    answer:
      "We analyze your content style, audience demographics, and niche to match you with brands looking for exactly your type of creator. You'll see relevant deals in your dashboard — no cold outreach needed.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel your subscription anytime from your account settings. If you cancel during a trial, you won't be charged. If you cancel a paid subscription, you keep access until the end of your billing period.",
  },
];

export function FAQSection(): React.JSX.Element {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <span className="text-sm text-foreground-muted">FAQ</span>
            <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Common questions
            </h2>
          </div>
        </FadeIn>

        <AccordionRoot type="single" collapsible className="space-y-2">
          {faqItems.map((item, index) => (
            <FadeIn key={index} delay={0.1 + index * 0.05}>
              <AccordionItem
                value={`item-${index}`}
                className="overflow-hidden rounded-lg border border-white/10 bg-transparent"
              >
                <AccordionTrigger className="text-base text-white">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-foreground-muted">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            </FadeIn>
          ))}
        </AccordionRoot>
      </div>
    </section>
  );
}
