"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface SlideUpProps {
  children: ReactNode
  delay?: number
  duration?: number
  distance?: number
  className?: string
  /** If true, animates when scrolled into view. If false, animates on mount. */
  scroll?: boolean
  /** Viewport amount threshold (0-1). Default 0.3 */
  threshold?: number
}

export function SlideUp({
  children,
  delay = 0,
  duration = 0.6,
  distance = 40,
  className,
  scroll = false,
  threshold = 0.3,
}: SlideUpProps) {
  const animationProps = scroll
    ? {
        initial: { opacity: 0, y: distance },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: threshold },
      }
    : {
        initial: { opacity: 0, y: distance },
        animate: { opacity: 1, y: 0 },
      }

  return (
    <motion.div
      {...animationProps}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
