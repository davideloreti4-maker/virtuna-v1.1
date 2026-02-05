"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
};

export interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation in seconds (default: 0.08 = 80ms) */
  staggerDelay?: number;
  /** Initial delay before first child animates in seconds (default: 0.1 = 100ms) */
  initialDelay?: number;
  /** Only trigger animation once when entering viewport (default: true) */
  once?: boolean;
}

/**
 * Stagger reveal container that orchestrates child animations with configurable stagger delay.
 * Uses whileInView with once:true for scroll-triggered stagger animation.
 *
 * Pair with `StaggerReveal.Item` to wrap each child element.
 *
 * @example
 * ```tsx
 * <StaggerReveal className="grid grid-cols-3 gap-4">
 *   <StaggerReveal.Item>Card 1</StaggerReveal.Item>
 *   <StaggerReveal.Item>Card 2</StaggerReveal.Item>
 *   <StaggerReveal.Item>Card 3</StaggerReveal.Item>
 * </StaggerReveal>
 * ```
 */
export function StaggerReveal({
  children,
  className,
  staggerDelay = 0.08,
  initialDelay = 0.1,
  once = true,
}: StaggerRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-50px" }}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerRevealItemProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Item wrapper for StaggerReveal children. Applies fadeInUp animation
 * that is orchestrated by the parent StaggerReveal container.
 */
export function StaggerRevealItem({
  children,
  className,
}: StaggerRevealItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

StaggerReveal.Item = StaggerRevealItem;
