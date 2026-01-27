"use client"

import { motion, Variants } from "motion/react"
import { ReactNode } from "react"

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  variants?: Variants
  delay?: number
  duration?: number
  threshold?: number
}

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
}

export function ScrollReveal({
  children,
  className,
  variants = defaultVariants,
  delay = 0,
  duration = 0.6,
  threshold = 0.3,
}: ScrollRevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: threshold }}
      variants={variants}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
