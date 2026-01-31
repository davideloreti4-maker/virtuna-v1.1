"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { OrbState } from "@/lib/visualization-types";
import { ANIMATION_CONFIG } from "@/lib/visualization-types";

interface OrbAnimationState {
  scale: number;
  glowIntensity: number;
  rotation: number;
}

interface UseOrbAnimationReturn {
  animationState: OrbAnimationState;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
}

/**
 * Hook for managing orb animation state
 * Handles breathing, state transitions, and interaction feedback
 *
 * Features:
 * - requestAnimationFrame for smooth 60fps animations
 * - prefers-reduced-motion support
 * - Sinusoidal breathing pattern
 * - Hover interaction boost
 * - Clean animation cancellation on state change
 */
export function useOrbAnimation(state: OrbState): UseOrbAnimationReturn {
  const [animationState, setAnimationState] = useState<OrbAnimationState>({
    scale: 1,
    glowIntensity: 1,
    rotation: 0,
  });
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // Breathing animation loop
  const breathe = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const { breathing, interaction } = ANIMATION_CONFIG;
    const progress = (elapsed % breathing.duration) / breathing.duration;

    // Sinusoidal breathing pattern
    const breathPhase = Math.sin(progress * Math.PI * 2);
    const scale = breathing.scaleMin + (breathing.scaleMax - breathing.scaleMin) * (0.5 + breathPhase * 0.5);
    const baseGlow = breathing.glowMin + (breathing.glowMax - breathing.glowMin) * (0.5 + breathPhase * 0.5);

    // Apply hover boost if hovered
    const glowIntensity = isHovered ? baseGlow * interaction.glowBoost : baseGlow;

    setAnimationState(prev => ({
      ...prev,
      scale,
      glowIntensity,
    }));

    animationRef.current = requestAnimationFrame(breathe);
  }, [isHovered]);

  // Gathering animation (builds anticipation)
  const gathering = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const { gathering: config } = ANIMATION_CONFIG;
    const progress = Math.min(elapsed / config.duration, 1);

    // Ease-out curve for anticipation build
    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = 1 + (config.scaleTo - 1) * eased;
    const glowIntensity = 1 + (config.glowIntensity - 1) * eased;

    setAnimationState(prev => ({
      ...prev,
      scale,
      glowIntensity,
    }));

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(gathering);
    }
  }, []);

  // Analyzing animation (rotation + glow pulse)
  const analyzing = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const { analyzing: config, gathering: gatherConfig } = ANIMATION_CONFIG;

    // Maintain gathered scale, add rotation
    const rotation = (elapsed * config.rotationSpeed) % (Math.PI * 2);

    // Subtle glow pulse
    const pulsePhase = Math.sin(elapsed / 500);
    const glowIntensity = config.glowIntensity + pulsePhase * 0.1;

    setAnimationState({
      scale: gatherConfig.scaleTo,
      glowIntensity,
      rotation,
    });

    animationRef.current = requestAnimationFrame(analyzing);
  }, []);

  // Complete animation (flash then settle)
  const complete = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const { complete: config } = ANIMATION_CONFIG;

    let glowIntensity: number;
    let scale: number;

    if (elapsed < config.flashDuration) {
      // Flash phase
      const flashProgress = elapsed / config.flashDuration;
      glowIntensity = config.flashIntensity * (1 - flashProgress * 0.5);
      scale = 1.1 + flashProgress * 0.05;
    } else {
      // Settle phase
      const settleElapsed = elapsed - config.flashDuration;
      const settleProgress = Math.min(settleElapsed / config.settleDuration, 1);
      const eased = 1 - Math.pow(1 - settleProgress, 2);

      glowIntensity = config.flashIntensity * 0.5 + (config.settleIntensity - config.flashIntensity * 0.5) * eased;
      scale = 1.15 - 0.15 * eased;
    }

    setAnimationState({
      scale,
      glowIntensity,
      rotation: 0,
    });

    if (elapsed < config.flashDuration + config.settleDuration) {
      animationRef.current = requestAnimationFrame(complete);
    }
  }, []);

  // Start animation based on state
  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    startTimeRef.current = 0;

    // If reduced motion, show static state
    if (prefersReducedMotion) {
      setAnimationState({
        scale: state === 'complete' ? 1 : state === 'gathering' ? 1.1 : 1,
        glowIntensity: state === 'complete' ? 0.6 : 1,
        rotation: 0,
      });
      return;
    }

    // Start appropriate animation
    switch (state) {
      case 'idle':
        animationRef.current = requestAnimationFrame(breathe);
        break;
      case 'gathering':
        animationRef.current = requestAnimationFrame(gathering);
        break;
      case 'analyzing':
        animationRef.current = requestAnimationFrame(analyzing);
        break;
      case 'complete':
        animationRef.current = requestAnimationFrame(complete);
        break;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, prefersReducedMotion, breathe, gathering, analyzing, complete]);

  return { animationState, isHovered, setIsHovered };
}
