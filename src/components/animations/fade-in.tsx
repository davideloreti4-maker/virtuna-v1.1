"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  /** If true, animates when scrolled into view. If false, animates on mount. */
  scroll?: boolean
  /** Viewport amount threshold (0-1). Default 0.3 */
  threshold?: number
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className,
  scroll = false,
  threshold = 0.3,
}: FadeInProps) {
  const animationProps = scroll
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: threshold },
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      }

  return (
    <motion.div
      {...animationProps}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
