"use client";

import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { FadeIn } from "@/components/motion";

/**
 * FAQ data for the landing page
 * Questions and answers about Artificial Societies
 */
const faqItems = [
  {
    question: "How accurate are your AI personas compared to real humans?",
    answer:
      "Our AI personas achieve 86% accuracy in replicating human survey responses, compared to 61-67% for standard AI models. This is validated through rigorous testing against 1,000 real survey replications.",
  },
  {
    question: "Are your simulations backed by research?",
    answer:
      "Yes. Our methodology is grounded in behavioral science research and has been validated through extensive academic and commercial studies. We publish our evaluation reports for transparency.",
  },
  {
    question: "What audiences can you simulate?",
    answer:
      "We can simulate virtually any audience - from Fortune 500 executives to niche demographics that traditional panels struggle to reach. Our personas are calibrated using real-world data sources.",
  },
  {
    question: "How long does it take to get results?",
    answer:
      "Results are delivered in minutes, not weeks. You can run thousands of simulated interviews in the time it takes to send one traditional survey.",
  },
  {
    question: "Can I interview the personas for qualitative insights?",
    answer:
      "Absolutely. Our personas can engage in open-ended conversations, providing rich qualitative data alongside quantitative responses. They reason and reflect like real people.",
  },
  {
    question: "How do you ensure the personas reflect real human diversity?",
    answer:
      "Every persona is demographically and psychographically calibrated using real-world data. We model attitudes, beliefs, and opinions to create responses as nuanced and diverse as actual humans.",
  },
  {
    question: "What industries do you work with?",
    answer:
      "We work across industries including market research, advertising, product development, political polling, and academic research. Our technology adapts to any domain requiring human insights.",
  },
];

/**
 * FAQSection - Frequently Asked Questions accordion section
 *
 * Features:
 * - 7 FAQ items matching societies.io content
 * - Single item open at a time (collapsible accordion)
 * - Chevron rotation animation on expand/collapse
 * - Keyboard accessible (Tab, Enter/Space)
 * - Smooth height animation using Radix primitives
 * - Scroll-triggered fade-in animations
 */
export function FAQSection(): React.JSX.Element {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        {/* Section Header */}
        <FadeIn>
          <div className="mb-12">
            <span className="text-sm text-foreground-muted">FAQ</span>
            <h2 className="mt-4 font-display text-[40px] font-[350] leading-[44px] text-white">
              Common questions
            </h2>
          </div>
        </FadeIn>

        {/* Accordion */}
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
