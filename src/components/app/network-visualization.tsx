"use client";

import { useEffect, useRef } from "react";
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

// Country color palette (matching reference)
const COUNTRY_COLORS = [
  "#F97316", // Orange - United States
  "#3B82F6", // Blue - United Kingdom
  "#10B981", // Green - Germany
  "#8B5CF6", // Purple - Australia
  "#EF4444", // Red - Canada
];

const DOT_COUNT = 200;
const DOT_RADIUS = 3;
const MAX_VELOCITY = 0.3;
const CONNECTION_DISTANCE = 150;

/**
 * NetworkVisualization - Canvas-based animated network visualization
 *
 * Features:
 * - Radial/clustered dot arrangement emanating from center
 * - Connection lines between nearby dots with distance-based opacity
 * - Country-based color coding
 * - Subtle glow effect on dots
 * - Respects prefers-reduced-motion
 * - Crisp rendering on retina displays
 */
export function NetworkVisualization({ className }: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let dots: Dot[] = [];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      createDots(rect.width, rect.height);
    };

    // Create dots in radial/clustered pattern
    const createDots = (width: number, height: number) => {
      dots = [];
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.85;

      for (let i = 0; i < DOT_COUNT; i++) {
        const angle = Math.random() * 2 * Math.PI;
        // sqrt for even distribution across circular area
        const radius = Math.sqrt(Math.random()) * maxRadius;

        dots.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * MAX_VELOCITY,
          vy: (Math.random() - 0.5) * MAX_VELOCITY,
          radius: DOT_RADIUS,
          color: COUNTRY_COLORS[Math.floor(Math.random() * COUNTRY_COLORS.length)]!,
        });
      }
    };

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const animate = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update dot positions (unless reduced motion)
      if (!prefersReducedMotion) {
        dots.forEach((dot) => {
          dot.x += dot.vx;
          dot.y += dot.vy;

          // Bounce off edges
          if (dot.x < dot.radius || dot.x > width - dot.radius) dot.vx *= -1;
          if (dot.y < dot.radius || dot.y > height - dot.radius) dot.vy *= -1;
        });
      }

      // Draw connection lines between nearby dots
      ctx.lineWidth = 0.5;
      for (let i = 0; i < dots.length; i++) {
        const dotI = dots[i]!;
        for (let j = i + 1; j < dots.length; j++) {
          const dotJ = dots[j]!;
          const dx = dotI.x - dotJ.x;
          const dy = dotI.y - dotJ.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < CONNECTION_DISTANCE) {
            const opacity = 1 - distance / CONNECTION_DISTANCE;
            ctx.beginPath();
            ctx.moveTo(dotI.x, dotI.y);
            ctx.lineTo(dotJ.x, dotJ.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
            ctx.stroke();
          }
        }
      }

      // Draw dots with glow effect
      dots.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.shadowColor = dot.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    // Initial setup
    resizeCanvas();
    animate();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("absolute inset-0", className)}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}
