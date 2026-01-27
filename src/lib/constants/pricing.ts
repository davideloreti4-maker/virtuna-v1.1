/**
 * Pricing Constants - Matching societies.io enterprise model
 *
 * societies.io uses enterprise-only pricing with custom engagement model:
 * "Business plans start at $15k for a three month engagement."
 *
 * No self-serve tiers or monthly/yearly toggle - all enterprise contact-based.
 *
 * Last updated: 2026-01-27
 */

// ===========================================
// PRICING TIERS
// ===========================================

export interface PricingTier {
  id: string
  name: string
  description: string
  startingPrice: string
  priceDescription: string
  features: string[]
  highlighted?: boolean
  ctaText: string
  ctaHref: string
}

export const pricingTiers: PricingTier[] = [
  {
    id: "business",
    name: "Business",
    description: "For organizations seeking to understand their audience at scale.",
    startingPrice: "$15k",
    priceDescription: "starting price for a three month engagement",
    features: [
      "Custom AI persona generation",
      "Audience simulation at scale",
      "Research reports and insights",
      "Dedicated support team",
      "Custom integrations",
    ],
    highlighted: true,
    ctaText: "Book a Meeting",
    ctaHref: "/contact",
  },
]

// ===========================================
// FAQ
// ===========================================

export interface PricingFAQ {
  question: string
  answer: string
}

export const pricingFAQs: PricingFAQ[] = [
  {
    question: "How accurate are your AI personas compared to real humans?",
    answer:
      "Our AI personas are built on extensive research and real human data. We continuously validate our models against real-world responses to ensure high fidelity in audience simulation.",
  },
  {
    question: "What audiences can you simulate?",
    answer:
      "We can simulate a wide range of audiences across demographics, industries, and regions. Our personas cover consumers, business professionals, and specialized segments based on your research needs.",
  },
  {
    question: "How long does it take to get results?",
    answer:
      "Most research projects deliver initial results within days, not months. Traditional research would have taken months to gather the necessary depth of data.",
  },
  {
    question: "How do you ensure the personas reflect real human diversity?",
    answer:
      "Our personas are trained on diverse datasets and continuously updated to reflect real human diversity across demographics, cultures, and perspectives.",
  },
  {
    question: "What industries do you work with?",
    answer:
      "We work across industries including technology, finance, healthcare, consumer goods, and more. Our personas can be tailored to any industry vertical.",
  },
]

// ===========================================
// PAGE CONTENT
// ===========================================

export const pricingPageContent = {
  headline: "Simple, transparent pricing",
  subheadline:
    "Research that was impossible is now instant. Get started with our enterprise solutions.",
  ctaSection: {
    headline: "Ready to understand your audience?",
    subheadline: "Book a meeting with our team to discuss your research needs.",
    ctaText: "Book a Meeting",
    ctaHref: "/contact",
  },
}
