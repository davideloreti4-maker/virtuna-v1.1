"use client";

import { cn } from "@/lib/utils";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/** Size variants for the slider */
export type GlassSliderSize = "sm" | "md" | "lg";

export interface GlassSliderProps {
  /** Current value (controlled) */
  value?: number;
  /** Default value (uncontrolled) */
  defaultValue?: number;
  /** Change handler */
  onChange?: (value: number) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Size variant */
  size?: GlassSliderSize;
  /** Disabled state */
  disabled?: boolean;
  /** Show value label */
  showValue?: boolean;
  /** Custom value formatter */
  formatValue?: (value: number) => string;
  /** Additional className for the wrapper */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Accessible label */
  "aria-label"?: string;
  /** Accessible labelled by */
  "aria-labelledby"?: string;
  /** ID for the slider */
  id?: string;
}

const sizeConfig = {
  sm: {
    track: "h-1",
    thumb: "h-4 w-4",
    value: "text-xs",
  },
  md: {
    track: "h-1.5",
    thumb: "h-5 w-5",
    value: "text-sm",
  },
  lg: {
    track: "h-2",
    thumb: "h-6 w-6",
    value: "text-base",
  },
};

/**
 * GlassSlider - Range slider with glass track and coral filled portion.
 *
 * Features:
 * - Glass track background with subtle blur
 * - Coral filled track from min to current value
 * - Glass thumb with hover glow effect
 * - Smooth spring-based animations
 * - Optional value display
 * - Full accessibility support (ARIA attributes, keyboard navigation)
 * - Size variants (sm, md, lg)
 * - Disabled state with reduced opacity
 *
 * @example
 * // Basic uncontrolled slider
 * <GlassSlider
 *   defaultValue={50}
 *   min={0}
 *   max={100}
 * />
 *
 * @example
 * // Controlled slider with value display
 * const [volume, setVolume] = useState(75);
 * <GlassSlider
 *   value={volume}
 *   onChange={setVolume}
 *   min={0}
 *   max={100}
 *   showValue
 *   formatValue={(v) => `${v}%`}
 *   aria-label="Volume control"
 * />
 *
 * @example
 * // Custom range with step
 * <GlassSlider
 *   defaultValue={0}
 *   min={-10}
 *   max={10}
 *   step={0.5}
 *   size="lg"
 *   showValue
 * />
 *
 * @example
 * // Disabled state
 * <GlassSlider
 *   value={50}
 *   disabled
 *   showValue
 * />
 *
 * @example
 * // Different sizes
 * <GlassSlider size="sm" defaultValue={25} />
 * <GlassSlider size="md" defaultValue={50} />
 * <GlassSlider size="lg" defaultValue={75} />
 */
export const GlassSlider = forwardRef<HTMLDivElement, GlassSliderProps>(
  (
    {
      value: controlledValue,
      defaultValue = 0,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      size = "md",
      disabled = false,
      showValue = false,
      formatValue = (v) => v.toString(),
      className,
      style,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      id,
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    // Determine if controlled or uncontrolled
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const config = sizeConfig[size];

    // Clamp value between min and max
    const clampedValue = Math.min(Math.max(value, min), max);

    // Calculate percentage for the filled track
    const percentage = ((clampedValue - min) / (max - min)) * 100;

    // Update value based on position
    const updateValue = (clientX: number) => {
      if (!trackRef.current || disabled) return;

      const rect = trackRef.current.getBoundingClientRect();
      const position = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = position / rect.width;
      const rawValue = min + ratio * (max - min);

      // Round to nearest step
      const steppedValue = Math.round(rawValue / step) * step;
      const newValue = Math.min(Math.max(steppedValue, min), max);

      if (!isControlled) {
        setUncontrolledValue(newValue);
      }

      onChange?.(newValue);
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled) return;
      setIsDragging(true);
      updateValue(e.clientX);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      setIsDragging(true);
      updateValue(touch.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        const touch = e.touches[0];
        if (!touch) return;
        updateValue(touch.clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue = clampedValue;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          newValue = Math.min(clampedValue + step, max);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          newValue = Math.max(clampedValue - step, min);
          break;
        case "Home":
          e.preventDefault();
          newValue = min;
          break;
        case "End":
          e.preventDefault();
          newValue = max;
          break;
        case "PageUp":
          e.preventDefault();
          newValue = Math.min(clampedValue + step * 10, max);
          break;
        case "PageDown":
          e.preventDefault();
          newValue = Math.max(clampedValue - step * 10, min);
          break;
        default:
          return;
      }

      if (!isControlled) {
        setUncontrolledValue(newValue);
      }

      onChange?.(newValue);
    };

    // Global mouse/touch event listeners
    useEffect(() => {
      if (isDragging) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("touchmove", handleTouchMove);
        window.addEventListener("touchend", handleTouchEnd);

        return () => {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          window.removeEventListener("touchmove", handleTouchMove);
          window.removeEventListener("touchend", handleTouchEnd);
        };
      }
    }, [isDragging]);

    return (
      <div
        ref={ref}
        className={cn("relative w-full", className)}
        style={style}
      >
        {/* Track Container */}
        <div
          ref={trackRef}
          className={cn(
            "relative w-full rounded-full",
            "glass-base glass-blur-sm",
            "border border-border-glass",
            "shadow-sm",
            config.track,
            !disabled && "cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)", // Raycast glass
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Filled Track (Coral) */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 rounded-full",
              "transition-all duration-[var(--duration-fast)]",
              "ease-[var(--ease-out-cubic)]"
            )}
            style={{
              width: `${percentage}%`,
              backgroundColor: "var(--color-accent)", // Coral
              boxShadow: "none",
            }}
          />

          {/* Thumb */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full",
              "glass-base glass-blur-sm",
              "border-2 border-white/[0.1]",
              "transition-all duration-[var(--duration-fast)]",
              "ease-[var(--ease-spring)]",
              config.thumb,
              !disabled && "cursor-grab active:cursor-grabbing",
              disabled && "cursor-not-allowed"
            )}
            style={{
              left: `${percentage}%`,
              backgroundColor: "var(--color-fg)", // White
              boxShadow: isDragging
                ? "0 0 16px var(--color-accent-transparent), 0 4px 12px rgba(0, 0, 0, 0.2)"
                : "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(229, 120, 80, 0.2)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={clampedValue}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            id={id}
          />
        </div>

        {/* Value Display */}
        {showValue && (
          <div
            className={cn(
              "absolute -top-8 left-1/2 -translate-x-1/2",
              "px-2 py-1 rounded-md",
              "glass-base glass-blur-sm",
              "border border-border-glass",
              "shadow-md",
              "font-medium text-text-primary",
              "whitespace-nowrap",
              "transition-all duration-[var(--duration-fast)]",
              config.value,
              isDragging ? "opacity-100 scale-100" : "opacity-0 scale-95",
              disabled && "opacity-50"
            )}
            style={{
              backgroundColor: "var(--color-bg-200)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              pointerEvents: "none",
            }}
          >
            {formatValue(clampedValue)}
          </div>
        )}
      </div>
    );
  }
);

GlassSlider.displayName = "GlassSlider";
