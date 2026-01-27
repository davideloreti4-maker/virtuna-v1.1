"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { pricingFAQs, type PricingFAQ as FAQItem } from "@/lib/constants/pricing"
import { ScrollReveal } from "@/components/animations"

interface FAQItemProps {
  faq: FAQItem
  isOpen: boolean
  onToggle: () => void
  index: number
}

function FAQAccordionItem({ faq, isOpen, onToggle, index }: FAQItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="border-b border-[#262626] last:border-b-0"
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-6 text-left focus:outline-none focus:ring-2 focus:ring-[#E57850] focus:ring-offset-2 focus:ring-offset-[#0d0d0d] rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-white pr-8">{faq.question}</span>
        <motion.svg
          className="w-5 h-5 text-[#9CA3AF] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[#9CA3AF] leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <ScrollReveal>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          Frequently asked questions
        </h2>

        <div className="divide-y divide-[#262626]">
          {pricingFAQs.map((faq, index) => (
            <FAQAccordionItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
              index={index}
            />
          ))}
        </div>
      </div>
    </ScrollReveal>
  )
}
