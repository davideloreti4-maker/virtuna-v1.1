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
      "Virtuna analyzes 50+ content signals — hook strength, trend alignment, engagement patterns, audience fit — using AI models trained on real TikTok performance data. You describe your content concept and get a virality score before you film.",
  },
  {
    question: "How accurate are the predictions?",
    answer:
      "Our models achieve 83% accuracy in predicting content engagement outcomes, validated against real TikTok performance data. That means 4 out of 5 predictions correctly identify whether content will outperform or underperform — significantly better than intuition alone.",
  },
  {
    question: "What kind of content can I test?",
    answer:
      "Any TikTok content concept — video ideas, hooks, captions, trend angles, format experiments. Describe what you're planning to post and Virtuna scores it across multiple engagement dimensions. Test variations before committing to production.",
  },
  {
    question: "Do I need a lot of followers for this to work?",
    answer:
      "No. Predictions are based on content quality and audience fit, not your follower count. A creator with 500 followers gets the same analysis as one with 500K. The AI evaluates the content itself, not your account metrics.",
  },
  {
    question: "How fast do I get results?",
    answer:
      "Under 30 seconds. Submit your content concept, and Virtuna runs it through signal analysis, engagement prediction, and scoring — then returns a detailed breakdown with your virality score, strengths, and areas to improve.",
  },
  {
    question: "What content signals does Virtuna analyze?",
    answer:
      "Over 50 signals across 12 engagement dimensions: hook strength, trend relevance, emotional resonance, audience alignment, format performance, caption effectiveness, timing optimization, and more. Each signal is weighted based on current TikTok algorithm patterns.",
  },
];

export function FAQSection(): React.JSX.Element {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Questions creators ask
            </h2>
          </div>
        </FadeIn>

        <AccordionRoot type="single" collapsible className="space-y-2">
          {faqItems.map((item, index) => (
            <FadeIn key={index} delay={0.1 + index * 0.05}>
              <AccordionItem
                value={`item-${index}`}
                className="overflow-hidden rounded-lg border border-white/[0.06] bg-transparent"
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
