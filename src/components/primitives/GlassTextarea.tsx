"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useRef, type TextareaHTMLAttributes } from "react";

/** Size variants for the textarea */
export type TextareaSize = "sm" | "md" | "lg";

export interface GlassTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  /** Size variant affects padding and font size */
  size?: TextareaSize;
  /** Show error state with red border */
  error?: boolean;
  /** Enable auto-resize behavior that grows with content */
  autoResize?: boolean;
  /** Minimum number of rows (default: 3) */
  minRows?: number;
  /** Maximum number of rows when autoResize is enabled */
  maxRows?: number;
  /** Additional className for the textarea */
  className?: string;
}

const sizeMap = {
  sm: "px-3 py-2 text-sm min-h-[80px]",
  md: "px-4 py-3 text-base min-h-[120px]",
  lg: "px-5 py-4 text-lg min-h-[160px]",
};

/**
 * GlassTextarea - Premium glass-styled textarea with multiple states and auto-resize.
 *
 * Features:
 * - Glass morphism background with backdrop blur
 * - Multiple states: default, hover, focus, error, disabled
 * - Coral focus ring with Raycast-style glow
 * - Optional auto-resize that grows with content
 * - Min/max rows configuration
 * - Size variants (sm, md, lg)
 *
 * Uses oklch colors for perceptual uniformity and consistent styling
 * across the design system.
 *
 * @example
 * // Basic textarea
 * <GlassTextarea
 *   placeholder="Enter your message..."
 *   size="md"
 * />
 *
 * @example
 * // Auto-resize textarea with min/max rows
 * <GlassTextarea
 *   autoResize
 *   minRows={3}
 *   maxRows={10}
 *   placeholder="This textarea will grow as you type..."
 * />
 *
 * @example
 * // Error state
 * <GlassTextarea
 *   error
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 *   placeholder="This field has an error"
 * />
 *
 * @example
 * // With ref for programmatic control
 * const textareaRef = useRef<HTMLTextAreaElement>(null);
 * <GlassTextarea
 *   ref={textareaRef}
 *   placeholder="Ref-controlled textarea"
 * />
 */
export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  (
    {
      size = "md",
      error = false,
      autoResize = false,
      minRows = 3,
      maxRows,
      className,
      disabled,
      style,
      onChange,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Auto-resize logic
    useEffect(() => {
      if (!autoResize || !textareaRef.current) return;

      const textarea = textareaRef.current;
      const adjustHeight = () => {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = "auto";

        // Calculate new height
        const scrollHeight = textarea.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const minHeight = lineHeight * minRows;
        const maxHeight = maxRows ? lineHeight * maxRows : Infinity;

        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;

        // Show scrollbar if content exceeds maxRows
        if (maxRows && scrollHeight > maxHeight) {
          textarea.style.overflowY = "auto";
        } else {
          textarea.style.overflowY = "hidden";
        }
      };

      // Adjust on mount and when value changes
      adjustHeight();

      // Add resize observer for dynamic content changes
      const resizeObserver = new ResizeObserver(adjustHeight);
      resizeObserver.observe(textarea);

      return () => {
        resizeObserver.disconnect();
      };
    }, [autoResize, minRows, maxRows, textareaRef, props.value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const minHeight = lineHeight * minRows;
        const maxHeight = maxRows ? lineHeight * maxRows : Infinity;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;
      }
      onChange?.(e);
    };

    return (
      <textarea
        ref={textareaRef}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          // Base glass styling - Raycast: border-radius 8px, bg rgba(255,255,255,0.05)
          "w-full rounded-[var(--rounding-normal)]",

          // Border - Raycast: 1px solid rgba(255, 255, 255, 0.05)
          "border border-white/5",

          // Text styling - Raycast: fg color and grey-300 for placeholder, weight 500
          "text-[var(--color-fg)] placeholder:text-[var(--color-fg-300)]",
          "font-sans font-medium",

          // Transitions - Raycast timing
          "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]",

          // Resize behavior
          autoResize ? "resize-none overflow-hidden" : "resize-y",

          // Size variants
          sizeMap[size],

          // States
          !disabled && !error && [
            // Hover state
            "hover:border-white/10",

            // Focus state - Coral focus ring (Raycast-style)
            "focus:outline-none",
            "focus:ring-2 focus:ring-[var(--color-accent-transparent)]",
            "focus:border-[var(--color-accent)]",
          ],

          // Error state - Raycast red
          error && [
            "border-[var(--color-red)]",
            "bg-[var(--color-red-transparent)]",
            "focus:ring-2 focus:ring-[var(--color-red-transparent)]",
          ],

          // Disabled state
          disabled && [
            "opacity-50",
            "cursor-not-allowed",
          ],

          className
        )}
        style={{
          // Raycast exact: background-color rgba(255, 255, 255, 0.05)
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          ...(!autoResize && {
            minHeight: `${20 * minRows}px`,
          }),
          ...style,
        }}
        {...props}
      />
    );
  }
);

GlassTextarea.displayName = "GlassTextarea";
