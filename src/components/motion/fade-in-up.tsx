"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { cn } from "@/lib/utils";

export interface FadeInUpProps {
  children: React.ReactNode;
  className?: string;
  /** Animation delay in seconds (default: 0). Use incremental values for manual stagger. */
  delay?: number;
  /** Animation duration in seconds (default: 0.6, Raycast timing). */
  duration?: number;
  /** Vertical translate distance in pixels (default: 24, Raycast offset). */
  distance?: number;
  /** Only trigger animation once when entering viewport (default: true). */
  once?: boolean;
  /** HTML element type to render as (default: "div"). */
  as?: "div" | "section" | "article" | "aside" | "header" | "footer" | "main" | "span";
}

/**
 * Raycast's signature scroll-reveal animation combining opacity fade with vertical translate.
 *
 * Uses `translateY(24px) -> 0` with `opacity 0 -> 1` on viewport entry.
 * Easing: `[0.25, 0.1, 0.25, 1.0]` (Raycast standard ease).
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FadeInUp>
 *   <h2>Section Title</h2>
 * </FadeInUp>
 *
 * // Manual stagger with incremental delay
 * <FadeInUp delay={0}>First item</FadeInUp>
 * <FadeInUp delay={0.1}>Second item</FadeInUp>
 * <FadeInUp delay={0.2}>Third item</FadeInUp>
 *
 * // As a section element
 * <FadeInUp as="section" className="py-20">
 *   <SectionContent />
 * </FadeInUp>
 * ```
 */

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
} as const satisfies Variants;

export function FadeInUp({
  children,
  className,
  delay = 0,
  duration = 0.6,
  distance = 24,
  once = true,
  as = "div",
}: FadeInUpProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    const Wrapper = as;
    return <Wrapper className={cn(className)}>{children}</Wrapper>;
  }

  const MotionComponent = motion[as];

  return (
    <MotionComponent
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: {
          ...fadeInUpVariants.visible,
          transition: {
            duration,
            delay,
            ease: [0.25, 0.1, 0.25, 1.0],
          },
        },
      }}
    >
      {children}
    </MotionComponent>
  );
}
