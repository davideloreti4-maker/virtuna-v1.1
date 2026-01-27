"use client"

import { motion } from "motion/react"
import { ReactNode, Children } from "react"

interface StaggeredGridProps {
  children: ReactNode
  className?: string
  /** Delay between each child animation. Default 0.1s */
  staggerDelay?: number
  /** Animation duration per child. Default 0.5s */
  duration?: number
  threshold?: number
}

export function StaggeredGrid({
  children,
  className,
  staggerDelay = 0.1,
  duration = 0.5,
  threshold = 0.2,
}: StaggeredGridProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: threshold }}
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
