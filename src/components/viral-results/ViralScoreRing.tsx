"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
    diameter: 120,
    strokeWidth: 8,
    scoreClass: "text-3xl",
    suffixClass: "text-sm",
    tierClass: "text-xs",
  },
  md: {
    diameter: 180,
    strokeWidth: 10,
    scoreClass: "text-5xl",
    suffixClass: "text-lg",
    tierClass: "text-sm",
  },
  lg: {
    diameter: 240,
    strokeWidth: 12,
    scoreClass: "text-7xl",
    suffixClass: "text-xl",
    tierClass: "text-base",
  },
} as const;

// Animation duration in ms
const ANIMATION_DURATION = 1500;

// Get gradient colors based on score range
function getGradientColors(score: number): { start: string; end: string } {
  if (score >= 70) {
    // Green range
    return { start: "#22c55e", end: "#34d399" };
  } else if (score >= 40) {
    // Yellow/orange range
    return { start: "#eab308", end: "#facc15" };
  } else {
    // Red range
    return { start: "#dc2626", end: "#f87171" };
  }
}

// Custom hook for reduced motion preference
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

// Custom hook for count-up animation
function useCountUp(
  target: number,
  duration: number,
  enabled: boolean
): number {
  const [count, setCount] = useState(enabled ? 0 : target);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(eased * target);

      setCount(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [target, duration]
  );

  useEffect(() => {
    if (!enabled) {
      setCount(target);
      return;
    }

    // Reset for new animation
    setCount(0);
    startTimeRef.current = null;

    // Start animation after a small delay to ensure mount
    const timeoutId = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, enabled, animate]);

  return count;
}

export function ViralScoreRing({
  score,
  tier,
  size = "md",
  animated = true,
  className,
}: ViralScoreRingProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animated && !reducedMotion;

  // Derive tier from score if not provided
  const resolvedTier = tier ?? getTierFromScore(score);
  const tierConfig = VIRAL_TIERS[resolvedTier];
  const config = SIZE_CONFIG[size];

  // Count-up animation for score number
  const displayScore = useCountUp(score, ANIMATION_DURATION, shouldAnimate);

  // Ring animation state
  const [ringProgress, setRingProgress] = useState(shouldAnimate ? 0 : score);
  const [showTier, setShowTier] = useState(!shouldAnimate);

  // Calculate ring geometry
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;

  // Gradient colors based on score
  const gradientColors = getGradientColors(score);

  // Unique ID for gradient (needed for multiple instances)
  const gradientId = `ring-gradient-${score}-${size}`;

  // Animate ring progress
  useEffect(() => {
    if (!shouldAnimate) {
      setRingProgress(score);
      setShowTier(true);
      return;
    }

    // Reset animation
    setRingProgress(0);
    setShowTier(false);

    // Animate using CSS transition (handled in SVG)
    const timeoutId = setTimeout(() => {
      setRingProgress(score);
    }, 50);

    // Show tier label after animation completes
    const tierTimeoutId = setTimeout(() => {
      setShowTier(true);
    }, ANIMATION_DURATION);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(tierTimeoutId);
    };
  }, [score, shouldAnimate]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* SVG Ring */}
      <div
        className="relative"
        style={{ width: config.diameter, height: config.diameter }}
      >
        <svg
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className="transform -rotate-90"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors.start} />
              <stop offset="100%" stopColor={gradientColors.end} />
            </linearGradient>
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

          {/* Foreground progress ring */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: shouldAnimate
                ? `stroke-dashoffset ${ANIMATION_DURATION}ms cubic-bezier(0.215, 0.61, 0.355, 1)`
                : "none",
            }}
          />
        </svg>

        {/* Centered score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-baseline">
            <span
              className={cn(
                "font-bold text-text-primary tabular-nums",
                config.scoreClass
              )}
            >
              {displayScore}
            </span>
            <span
              className={cn("text-text-secondary ml-0.5", config.suffixClass)}
            >
              /100
            </span>
          </div>
        </div>
      </div>

      {/* Tier label */}
      <div
        className={cn(
          "font-medium transition-opacity duration-300",
          config.tierClass,
          tierConfig.color,
          showTier ? "opacity-100" : "opacity-0"
        )}
      >
        {resolvedTier}
      </div>
    </div>
  );
}
