"use client"

import { motion } from "motion/react"

interface PricingToggleProps {
  isAnnual: boolean
  onToggle: (isAnnual: boolean) => void
}

/**
 * PricingToggle - Monthly/Yearly billing toggle
 *
 * Note: societies.io uses enterprise-only pricing with no toggle.
 * This component is provided for potential future use but is not
 * displayed on the current pricing page.
 *
 * Usage:
 * <PricingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
 */
export function PricingToggle({ isAnnual, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span
        className={`text-sm font-medium transition-colors ${
          isAnnual ? "text-[#9CA3AF]" : "text-white"
        }`}
      >
        Monthly
      </span>

      <button
        onClick={() => onToggle(!isAnnual)}
        className="relative w-14 h-8 bg-[#1a1a1a] rounded-full p-1 border border-[#262626] focus:outline-none focus:ring-2 focus:ring-[#E57850] focus:ring-offset-2 focus:ring-offset-[#0d0d0d]"
        role="switch"
        aria-checked={isAnnual}
        aria-label="Toggle annual billing"
      >
        <motion.div
          className="w-6 h-6 bg-[#E57850] rounded-full"
          animate={{ x: isAnnual ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>

      <span
        className={`text-sm font-medium transition-colors ${
          isAnnual ? "text-white" : "text-[#9CA3AF]"
        }`}
      >
        Yearly{" "}
        <span className="text-[#E57850] text-xs">(Save 20%)</span>
      </span>
    </div>
  )
}
