"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Container } from "@/components/layout/container"
import { ScrollReveal } from "@/components/animations"

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-[#262626]">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-white font-medium pr-8">{question}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-[#9CA3AF] shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </motion.svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[#9CA3AF] leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const faqItems = [
  {
    question: "How accurate are your AI personas compared to real humans?",
    answer:
      "Our AI personas achieve 86% accuracy in survey replication studies, which is within 5 points of the human replication ceiling (91%). This is significantly higher than standard AI models which plateau at 61-67% accuracy.",
  },
  {
    question: "Are your simulations backed by research?",
    answer:
      "Yes, our methodology is grounded in extensive academic research on human behavior, cognitive psychology, and demographic modeling. We continuously validate our personas against real-world survey data.",
  },
  {
    question: "What audiences can you simulate?",
    answer:
      "We can simulate virtually any demographic or psychographic segment - from Fortune 500 executives to niche consumer groups. Our personas cover diverse geographic, cultural, socioeconomic, and attitudinal profiles.",
  },
  {
    question: "How long does it take to get results?",
    answer:
      "Results are typically available within minutes to hours, depending on the complexity and scale of your research. This compares to weeks or months with traditional market research methods.",
  },
  {
    question: "Can I interview the personas for qualitative insights?",
    answer:
      "Yes, our platform supports both quantitative surveys and qualitative interviews. You can have in-depth conversations with personas to explore motivations, attitudes, and decision-making processes.",
  },
  {
    question: "How do you ensure the personas reflect real human diversity?",
    answer:
      "Each persona is demographically and psychographically calibrated using comprehensive data on human attitudes, beliefs, and behaviors. We model the full spectrum of human diversity including cultural, generational, and ideological differences.",
  },
  {
    question: "What industries do you work with?",
    answer:
      "We work across industries including financial services, healthcare, consumer goods, technology, media, and government. Our personas can be tailored to any sector-specific audience.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <ScrollReveal className="text-center mb-12">
            <span className="text-sm text-[#9CA3AF] uppercase tracking-wider mb-4 block">
              FAQ
            </span>
            <h2
              className="text-white"
              style={{
                fontFamily: '"Funnel Display", var(--font-display)',
                fontSize: 'clamp(1.75rem, 4vw, 40px)',
                fontWeight: 350,
                lineHeight: 1.2,
              }}
            >
              Common questions
            </h2>
          </ScrollReveal>

          {/* FAQ Items */}
          <ScrollReveal delay={0.1}>
            <div className="border-t border-[#262626]">
              {faqItems.map((item, index) => (
                <FAQItem
                  key={index}
                  question={item.question}
                  answer={item.answer}
                  isOpen={openIndex === index}
                  onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                />
              ))}
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </section>
  )
}
