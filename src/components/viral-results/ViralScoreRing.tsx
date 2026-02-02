"use client";

import { useEffect, useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ViralTier, VIRAL_TIERS, getTierFromScore } from "@/types/viral-results";

export interface ViralScoreRingProps {
  score: number; // 0-100
  tier?: ViralTier; // Optional - will be derived from score if not provided
  size?: "sm" | "md" | "lg"; // Ring size variants
  animated?: boolean; // Enable/disable animations (default: true)
  className?: string;
}

// Size configuration
const SIZE_CONFIG = {
  sm: {
    diameter: 140,
    strokeWidth: 10,
    scoreClass: "text-3xl",
    suffixClass: "text-sm",
    tierClass: "text-xs",
    glowSize: 180,
  },
  md: {
    diameter: 200,
    strokeWidth: 12,
    scoreClass: "text-5xl",
    suffixClass: "text-lg",
    tierClass: "text-sm",
    glowSize: 260,
  },
  lg: {
    diameter: 260,
    strokeWidth: 14,
    scoreClass: "text-7xl",
    suffixClass: "text-xl",
    tierClass: "text-base",
    glowSize: 340,
  },
} as const;

// Get glow color based on score
function getGlowColor(score: number): string {
  if (score >= 70) return "rgba(34, 197, 94, 0.35)"; // green
  if (score >= 40) return "rgba(234, 179, 8, 0.35)"; // yellow/orange
  return "rgba(239, 68, 68, 0.35)"; // red
}

export function ViralScoreRing({
  score,
  tier,
  size = "md",
  animated = true,
  className,
}: ViralScoreRingProps): React.ReactElement {
  // Derive tier from score if not provided
  const resolvedTier = tier ?? getTierFromScore(score);
  const tierConfig = VIRAL_TIERS[resolvedTier];
  const config = SIZE_CONFIG[size];

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const shouldAnimate = animated && !prefersReducedMotion;

  // Spring-animated score for count-up effect
  const animatedScore = useSpring(shouldAnimate ? 0 : score, {
    stiffness: 80,
    damping: 25,
  });
  const displayScore = useTransform(animatedScore, (latest) =>
    Math.round(latest)
  );

  // Spring-animated ring progress
  const animatedProgress = useSpring(shouldAnimate ? 0 : score, {
    stiffness: 60,
    damping: 20,
  });

  // Calculate ring geometry
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = useTransform(
    animatedProgress,
    [0, 100],
    [circumference, 0]
  );

  // Glow color based on score
  const glowColor = getGlowColor(score);

  // Unique gradient ID
  const gradientId = `ring-gradient-${score}-${size}-${Math.random().toString(36).slice(2)}`;

  // Start animation on mount
  useEffect(() => {
    if (shouldAnimate) {
      animatedScore.set(score);
      animatedProgress.set(score);
    }
  }, [score, shouldAnimate, animatedScore, animatedProgress]);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Ring container with ambient glow */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: config.glowSize, height: config.glowSize }}
      >
        {/* Ambient glow effect behind ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 60%)`,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* SVG Ring */}
        <svg
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className="relative z-10 transform -rotate-90"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tierConfig.ringColor} />
              <stop
                offset="100%"
                stopColor={tierConfig.ringColor}
                stopOpacity="0.7"
              />
            </linearGradient>
            {/* Glow filter for ring stroke */}
            <filter id={`glow-${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track ring */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-white/10"
          />

          {/* Foreground progress ring with glow */}
          <motion.circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset }}
            filter={`url(#glow-${gradientId})`}
          />
        </svg>

        {/* Centered score number */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="flex items-baseline">
            <motion.span
              className={cn(
                "font-bold text-white tabular-nums",
                config.scoreClass
              )}
            >
              {displayScore}
            </motion.span>
            <span
              className={cn("text-white/50 ml-0.5", config.suffixClass)}
            >
              /100
            </span>
          </div>
        </div>
      </div>

      {/* Tier label with fade-in */}
      <motion.div
        className={cn("font-semibold", config.tierClass, tierConfig.color)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: shouldAnimate ? 1 : 0, duration: 0.5 }}
      >
        {resolvedTier}
      </motion.div>
    </div>
  );
}
