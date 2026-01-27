"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { pricingTiers, type PricingTier } from "@/lib/constants/pricing"
import { ScrollReveal } from "@/components/animations"

interface PricingCardProps {
  tier: PricingTier
  index: number
}

function PricingCard({ tier, index }: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`
        relative flex flex-col p-8 rounded-2xl
        ${
          tier.highlighted
            ? "bg-gradient-to-b from-[#1a1a1a] to-[#141414] border border-[#E57850]/30"
            : "bg-[#1a1a1a] border border-[#262626]"
        }
      `}
    >
      {/* Highlighted badge */}
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#E57850] text-white text-xs font-medium px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Tier name and description */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-white mb-2">{tier.name}</h3>
        <p className="text-[#9CA3AF]">{tier.description}</p>
      </div>

      {/* Price */}
      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-white">{tier.startingPrice}</span>
        </div>
        <p className="text-[#9CA3AF] mt-2">{tier.priceDescription}</p>
      </div>

      {/* Features list */}
      <ul className="space-y-4 mb-8 flex-grow">
        {tier.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-[#E57850] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-white">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <Link
        href={tier.ctaHref}
        className={`
          inline-flex items-center justify-center w-full py-3 px-6 rounded-lg font-medium transition-all
          ${
            tier.highlighted
              ? "bg-[#E57850] text-white hover:bg-[#d46a45]"
              : "bg-white/10 text-white hover:bg-white/20"
          }
        `}
      >
        {tier.ctaText}
      </Link>
    </motion.div>
  )
}

export function PricingTable() {
  return (
    <ScrollReveal className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-8 max-w-lg mx-auto">
        {pricingTiers.map((tier, index) => (
          <PricingCard key={tier.id} tier={tier} index={index} />
        ))}
      </div>
    </ScrollReveal>
  )
}
