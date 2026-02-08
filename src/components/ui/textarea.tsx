"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Size variants for the Textarea component */
export type TextareaSize = "sm" | "md" | "lg";

/**
 * Props for the Textarea component
 */
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  /** Size variant affects padding and font size */
  size?: TextareaSize;
  /** Error state with optional message */
  error?: boolean;
  /** Enable auto-resize behavior that grows with content */
  autoResize?: boolean;
  /** Minimum number of rows (default: 3) */
  minRows?: number;
  /** Maximum number of rows when autoResize is enabled */
  maxRows?: number;
}

// Size-specific padding, text, and min-height
const sizeMap = {
  sm: "px-3 py-2 text-[13px] min-h-[80px]",
  md: "px-3 py-3 text-[14px] min-h-[120px]",
  lg: "px-4 py-4 text-[15px] min-h-[160px]",
} as const;

/**
 * Textarea component with Raycast-exact styling and auto-resize support.
 *
 * Renders with rgba(255,255,255,0.05) background, 5% border, and 8px radius.
 * Supports size variants, auto-resize with minRows/maxRows, and error state.
 *
 * @example
 * ```tsx
 * // Basic textarea
 * <Textarea placeholder="Enter your message..." />
 *
 * // Auto-resize with row limits
 * <Textarea autoResize minRows={3} maxRows={10} placeholder="This grows..." />
 *
 * // Error state
 * <Textarea error placeholder="This field has an error" />
 * ```
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
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
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef =
      (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Auto-resize logic
    React.useEffect(() => {
      if (!autoResize || !textareaRef.current) return;

      const textarea = textareaRef.current;
      const adjustHeight = (): void => {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = "auto";

        const scrollHeight = textarea.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const minHeight = lineHeight * minRows;
        const maxHeight = maxRows ? lineHeight * maxRows : Infinity;

        const newHeight = Math.min(
          Math.max(scrollHeight, minHeight),
          maxHeight
        );
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

      // Add ResizeObserver for dynamic content changes
      const resizeObserver = new ResizeObserver(adjustHeight);
      resizeObserver.observe(textarea);

      return () => {
        resizeObserver.disconnect();
      };
    }, [autoResize, minRows, maxRows, textareaRef, props.value]);

    const handleChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>
    ): void => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const minHeight = lineHeight * minRows;
        const maxHeight = maxRows ? lineHeight * maxRows : Infinity;
        const newHeight = Math.min(
          Math.max(scrollHeight, minHeight),
          maxHeight
        );
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
          // Base styles -- Raycast: 8px radius, 5% border, full width
          "w-full rounded-[8px] border border-white/5",
          // Text
          "text-foreground placeholder:text-foreground-muted",
          // Transitions
          "transition-all duration-150",
          // Resize behavior
          autoResize ? "resize-none overflow-hidden" : "resize-y",
          // Size
          sizeMap[size],
          // Hover
          !disabled && !error && "hover:border-white/10",
          // Focus
          !disabled &&
            !error &&
            "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
          // Error
          error &&
            "border-[var(--color-red)] focus:outline-none focus:ring-2 focus:ring-[var(--color-red-transparent)] focus:border-[var(--color-red)]",
          // Disabled
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          ...(!autoResize && {
            minHeight: `${20 * minRows}px`,
          }),
          ...style,
        }}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
