"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface NetworkVisualizationProps {
  className?: string;
}

// Role level color palette
const ROLE_COLORS = [
  "#6366F1", // Indigo - Executive Level
  "#EC4899", // Pink - Mid Level
  "#10B981", // Emerald - Senior Level
  "#F97316", // Orange - Entry Level
];

const DOT_COUNT = 50;
const MIN_RADIUS = 3;
const MAX_RADIUS = 8;
const MAX_VELOCITY = 0.3;
const CONNECTION_DISTANCE = 120;

/**
 * NetworkVisualization - Canvas-based animated dots placeholder
 * for the real network visualization (Phase 7+).
 *
 * Features:
 * - Animated dots with role-level colors
 * - Connection lines between nearby dots
 * - Respects prefers-reduced-motion
 * - Crisp rendering on retina displays
 */
export function NetworkVisualization({ className }: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animationRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize dots
  const initializeDots = useCallback((width: number, height: number) => {
    const dots: Dot[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * MAX_VELOCITY,
        vy: (Math.random() - 0.5) * MAX_VELOCITY,
        radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
        color: ROLE_COLORS[Math.floor(Math.random() * ROLE_COLORS.length)]!,
      });
    }
    dotsRef.current = dots;
  }, []);

  // Update dot positions
  const updateDots = useCallback((width: number, height: number) => {
    dotsRef.current.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;

      // Bounce off edges
      if (dot.x <= dot.radius || dot.x >= width - dot.radius) {
        dot.vx = -dot.vx;
        dot.x = Math.max(dot.radius, Math.min(width - dot.radius, dot.x));
      }
      if (dot.y <= dot.radius || dot.y >= height - dot.radius) {
        dot.vy = -dot.vy;
        dot.y = Math.max(dot.radius, Math.min(height - dot.radius, dot.y));
      }
    });
  }, []);

  // Draw frame
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const dots = dotsRef.current;

      // Draw connection lines between nearby dots
      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i++) {
        const dotI = dots[i];
        if (!dotI) continue;
        for (let j = i + 1; j < dots.length; j++) {
          const dotJ = dots[j];
          if (!dotJ) continue;
          const dx = dotI.x - dotJ.x;
          const dy = dotI.y - dotJ.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < CONNECTION_DISTANCE) {
            const opacity = 1 - distance / CONNECTION_DISTANCE;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.15})`;
            ctx.beginPath();
            ctx.moveTo(dotI.x, dotJ.y);
            ctx.lineTo(dotJ.x, dotJ.y);
            ctx.stroke();
          }
        }
      }

      // Draw dots with glow effect
      dots.forEach((dot) => {
        // Glow
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = dot.color;
        ctx.fill();

        // Reset shadow for next iteration
        ctx.shadowBlur = 0;
      });
    },
    []
  );

  // Animation loop
  const animate = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      prefersReducedMotion: boolean
    ) => {
      if (!prefersReducedMotion) {
        updateDots(width, height);
      }
      draw(ctx, width, height);

      animationRef.current = requestAnimationFrame(() =>
        animate(ctx, width, height, prefersReducedMotion)
      );
    },
    [updateDots, draw]
  );

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    // Initial measurement
    handleResize();

    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Setup canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale for device pixel ratio (crisp on retina)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Initialize dots with current dimensions
    if (dotsRef.current.length === 0) {
      initializeDots(dimensions.width, dimensions.height);
    } else {
      // Reposition dots if canvas size changed significantly
      dotsRef.current.forEach((dot) => {
        dot.x = Math.min(dot.x, dimensions.width - dot.radius);
        dot.y = Math.min(dot.y, dimensions.height - dot.radius);
      });
    }

    // Start animation
    animate(ctx, dimensions.width, dimensions.height, prefersReducedMotion);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, initializeDots, animate]);

  return (
    <div ref={containerRef} className={cn("absolute inset-0", className)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ width: dimensions.width, height: dimensions.height }}
        aria-hidden="true"
      />
    </div>
  );
}
