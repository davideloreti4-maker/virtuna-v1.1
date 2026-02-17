"use client";

import { cn } from "@/lib/utils";
import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface GlassTooltipProps {
  /** Content to display in tooltip */
  content: ReactNode;
  /** Element that triggers the tooltip */
  children: ReactNode;
  /** Position of tooltip relative to trigger */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  delay?: number;
  /** Additional className for tooltip */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Disable tooltip */
  disabled?: boolean;
}

/**
 * GlassTooltip - Glassmorphic tooltip with arrow and positioning.
 *
 * Features:
 * - Glass background with backdrop blur
 * - Automatic positioning to avoid viewport overflow
 * - Configurable delay
 * - Arrow pointing to trigger
 *
 * @example
 * // Basic tooltip
 * <GlassTooltip content="This is helpful info">
 *   <button>Hover me</button>
 * </GlassTooltip>
 *
 * @example
 * // With delay and position
 * <GlassTooltip
 *   content="Settings"
 *   position="right"
 *   delay={300}
 * >
 *   <IconButton icon={<Gear />} />
 * </GlassTooltip>
 *
 * @example
 * // Rich content
 * <GlassTooltip
 *   content={
 *     <div>
 *       <strong>Pro Tip</strong>
 *       <p>Use keyboard shortcuts for speed.</p>
 *     </div>
 *   }
 * >
 *   <span>Learn more</span>
 * </GlassTooltip>
 */
export function GlassTooltip({
  content,
  children,
  position = "top",
  delay = 200,
  className,
  style,
  disabled = false,
}: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;

    let x = 0;
    let y = 0;

    switch (position) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - spacing;
        break;
      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + spacing;
        break;
      case "left":
        x = triggerRect.left - tooltipRect.width - spacing;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case "right":
        x = triggerRect.right + spacing;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep within viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Calculate position after tooltip is visible
      requestAnimationFrame(calculatePosition);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Update position on scroll/resize
  useEffect(() => {
    if (!isVisible) return;

    const updatePosition = () => calculatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible]);

  // Arrow styles based on position
  const arrowStyles: Record<TooltipPosition, string> = {
    top: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45",
    bottom: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45",
    left: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rotate-45",
    right: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45",
  };

  const tooltip = isVisible && mounted ? (
    createPortal(
      <div
        ref={tooltipRef}
        role="tooltip"
        className={cn(
          "fixed z-50 px-3 py-2",
          "rounded-[var(--rounding-sm)]",
          "border border-white/10",
          "shadow-md",
          "text-[13px] text-[var(--color-fg)]",
          "animate-fade-in",
          "pointer-events-none",
          className
        )}
        style={{
          left: coords.x,
          top: coords.y,
          backgroundColor: "var(--color-bg-200)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          ...style,
        }}
      >
        {content}
        {/* Arrow */}
        <div
          className={cn(
            "absolute w-2 h-2",
            "border-r border-b border-white/10",
            arrowStyles[position]
          )}
          style={{
            backgroundColor: "var(--color-bg-200)",
          }}
        />
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {tooltip}
    </>
  );
}
