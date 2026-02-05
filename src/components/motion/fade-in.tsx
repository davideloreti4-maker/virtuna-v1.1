"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

export interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  /** Vertical distance in pixels for the fade-in slide. Default 20. */
  distance?: number;
  once?: boolean;
}

const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.215, 0.61, 0.355, 1],
    },
  },
} as const satisfies Variants;

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  distance = 20,
  once = true,
}: FadeInProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-100px" }}
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: {
          ...fadeInVariants.visible,
          transition: {
            duration,
            delay,
            ease: [0.215, 0.61, 0.355, 1],
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
