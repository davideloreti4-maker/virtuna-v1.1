"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

export interface SlideUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  /** Vertical distance in pixels for the slide-up. Default 60. */
  distance?: number;
  once?: boolean;
}

const slideUpVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.165, 0.84, 0.44, 1],
    },
  },
} as const satisfies Variants;

export function SlideUp({
  children,
  className,
  delay = 0,
  duration = 0.6,
  distance = 60,
  once = true,
}: SlideUpProps) {
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
          ...slideUpVariants.visible,
          transition: {
            duration,
            delay,
            ease: [0.165, 0.84, 0.44, 1],
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
