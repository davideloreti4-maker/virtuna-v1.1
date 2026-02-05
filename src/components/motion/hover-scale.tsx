"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface HoverScaleProps {
  children: React.ReactNode;
  className?: string;
  /** Scale factor on hover (default: 1.02) */
  scale?: number;
  /** Scale factor on tap/press (default: 0.98) */
  tapScale?: number;
}

/**
 * Hover scale micro-interaction wrapper. Applies a subtle scale-up on hover
 * and scale-down on tap/press using spring physics for a snappy feel.
 *
 * Respects prefers-reduced-motion by rendering a plain div when enabled.
 *
 * @example
 * ```tsx
 * <HoverScale>
 *   <Card>Hover me for a subtle scale effect</Card>
 * </HoverScale>
 * ```
 *
 * @example
 * ```tsx
 * <HoverScale scale={1.05} tapScale={0.95} className="inline-block">
 *   <Button>Interactive Button</Button>
 * </HoverScale>
 * ```
 */
export function HoverScale({
  children,
  className,
  scale = 1.02,
  tapScale = 0.98,
}: HoverScaleProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
