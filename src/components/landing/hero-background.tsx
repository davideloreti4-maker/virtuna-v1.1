"use client";

import { motion, useReducedMotion } from "motion/react";
import { NoiseTexture } from "@/components/effects";

/**
 * Animated hero background with radial gradient orbs and noise texture.
 * Creates visual depth behind hero content without distracting from text.
 *
 * - Coral accent glow (top-center) slowly drifts
 * - Blue/purple secondary glow (bottom-left) breathes
 * - Subtle noise texture overlay for premium grain effect
 * - Respects prefers-reduced-motion
 */
export function HeroBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Primary coral glow - top center */}
      {prefersReducedMotion ? (
        <div
          className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.72 0.16 40 / 0.4), transparent 70%)",
          }}
        />
      ) : (
        <motion.div
          className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.72 0.16 40 / 0.4), transparent 70%)",
          }}
          animate={{
            opacity: [0.15, 0.25, 0.15],
            scale: [1, 1.05, 1],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Secondary blue glow - bottom left */}
      {prefersReducedMotion ? (
        <div
          className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.62 0.19 250 / 0.3), transparent 70%)",
          }}
        />
      ) : (
        <motion.div
          className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.62 0.19 250 / 0.3), transparent 70%)",
          }}
          animate={{
            opacity: [0.08, 0.15, 0.08],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      )}

      {/* Tertiary purple glow - right side */}
      {prefersReducedMotion ? (
        <div
          className="absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full opacity-8"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.63 0.24 300 / 0.2), transparent 70%)",
          }}
        />
      ) : (
        <motion.div
          className="absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.63 0.24 300 / 0.2), transparent 70%)",
          }}
          animate={{
            opacity: [0.06, 0.12, 0.06],
            x: [0, 15, 0],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4,
          }}
        />
      )}

      {/* Noise texture overlay for grain */}
      <NoiseTexture opacity={0.03} className="z-[2]" />

      {/* Bottom gradient fade to background */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background:
            "linear-gradient(to top, var(--color-background), transparent)",
        }}
      />
    </div>
  );
}
