"use client"

import { motion, useScroll, useTransform } from "motion/react"
import { ReactNode, useRef } from "react"

interface ParallaxProps {
  children: ReactNode
  className?: string
  /** Parallax intensity. Positive = moves up, negative = moves down. Default 30 */
  intensity?: number
  /** Element to use as scroll container reference */
  containerRef?: React.RefObject<HTMLElement>
}

export function Parallax({
  children,
  className,
  intensity = 30,
  containerRef,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
    ...(containerRef && { container: containerRef }),
  })

  const y = useTransform(scrollYProgress, [0, 1], [`${intensity}%`, `-${intensity}%`])

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}
