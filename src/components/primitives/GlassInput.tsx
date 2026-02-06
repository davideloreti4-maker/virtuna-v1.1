"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

/** Size variants for the input */
export type GlassInputSize = "sm" | "md" | "lg";

export interface GlassInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Size variant of the input */
  size?: GlassInputSize;
  /** Error state with optional error message */
  error?: boolean | string;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Icon to display on the left side */
  leftIcon?: ReactNode;
  /** Icon to display on the right side */
  rightIcon?: ReactNode;
  /** Show clear button when input has value */
  showClear?: boolean;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Additional className for the wrapper */
  wrapperClassName?: string;
}

// Size-specific padding and text sizes - Raycast exact: md = height 42px, padding 8px 12px, font 14px
const sizeStyles = {
  sm: {
    input: "h-8 px-2.5 text-[13px]",
    icon: "w-4 h-4",
    iconPadding: {
      left: "pl-8",
      right: "pr-8",
    },
  },
  md: {
    // Raycast exact: height: 42px, padding: 8px 12px, font-size: 14px
    input: "h-[42px] px-3 text-[14px]",
    icon: "w-5 h-5",
    iconPadding: {
      left: "pl-10",
      right: "pr-10",
    },
  },
  lg: {
    input: "h-12 px-4 text-[15px]",
    icon: "w-5 h-5",
    iconPadding: {
      left: "pl-11",
      right: "pr-11",
    },
  },
};

/**
 * GlassInput - Glassmorphism input field with Raycast-style interactions.
 *
 * Features:
 * - Glass background with subtle blur
 * - Coral focus ring with glow effect (Raycast-style)
 * - Multiple states: default, hover, focus, error, disabled, loading
 * - Left/right icon slots
 * - Optional clear button
 * - Size variants (sm, md, lg)
 * - Full accessibility support
 *
 * @example
 * // Basic input
 * <GlassInput
 *   placeholder="Enter your email..."
 *   type="email"
 * />
 *
 * @example
 * // With left icon and clear button
 * <GlassInput
 *   placeholder="Search..."
 *   leftIcon={<Search />}
 *   showClear
 *   onClear={() => setValue("")}
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 * />
 *
 * @example
 * // Error state with message
 * <GlassInput
 *   placeholder="Username"
 *   error="Username is required"
 *   leftIcon={<User />}
 * />
 *
 * @example
 * // Loading state
 * <GlassInput
 *   placeholder="Processing..."
 *   loading
 *   disabled
 * />
 *
 * @example
 * // Large size with right icon
 * <GlassInput
 *   size="lg"
 *   placeholder="Password"
 *   type="password"
 *   rightIcon={<Lock />}
 * />
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      size = "md",
      error = false,
      loading = false,
      leftIcon,
      rightIcon,
      showClear = false,
      onClear,
      disabled,
      className,
      wrapperClassName,
      value,
      style,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const hasValue = value !== undefined && value !== "";
    const showClearButton = showClear && hasValue && !disabled && !loading;

    const styles = sizeStyles[size];

    // Calculate padding based on icons
    const paddingLeft = leftIcon ? styles.iconPadding.left : "";
    const paddingRight =
      rightIcon || loading || showClearButton ? styles.iconPadding.right : "";

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {/* Left Icon */}
        {leftIcon && (
          <div
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none",
              "text-text-tertiary transition-colors duration-[var(--duration-fast)]",
              hasError && "text-error",
              styles.icon
            )}
          >
            {leftIcon}
          </div>
        )}

        {/* Input Field */}
        <input
          ref={ref}
          disabled={disabled || loading}
          value={value}
          className={cn(
            // Base glass styling - Raycast exact: border-radius 8px
            "w-full rounded-[var(--rounding-normal)]",
            styles.input,
            paddingLeft,
            paddingRight,

            // Raycast text input: border 1px solid rgba(255, 255, 255, 0.05)
            "border border-white/5",

            // Text styles - Raycast: color rgb(255, 255, 255), placeholder uses grey, weight 500
            "text-[var(--color-fg)] placeholder:text-[var(--color-fg-300)]",
            "font-sans font-medium",

            // Transitions (using Raycast CSS variables)
            "transition-all",
            "duration-[var(--duration-fast)]",
            "ease-[var(--ease-out)]",

            // Hover state
            !disabled &&
              !hasError &&
              "hover:border-white/10",

            // Focus state with coral glow (Raycast-style)
            !disabled &&
              !hasError &&
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-transparent)]",
            !disabled &&
              !hasError &&
              "focus:border-[var(--color-accent)]",

            // Error state - use Raycast red
            hasError &&
              "border-[var(--color-red)] bg-[var(--color-red-transparent)]",
            hasError &&
              !disabled &&
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-red-transparent)]",

            // Disabled state
            disabled &&
              "opacity-50 cursor-not-allowed",

            // Loading state
            loading && "cursor-wait",

            className
          )}
          style={{
            // Raycast exact: background-color rgba(255, 255, 255, 0.05)
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            ...style,
          }}
          aria-invalid={hasError}
          aria-describedby={
            typeof error === "string" ? `${props.id}-error` : undefined
          }
          {...props}
        />

        {/* Right Side Icons/Buttons */}
        <div
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "flex items-center gap-1"
          )}
        >
          {/* Loading Spinner */}
          {loading && (
            <Loader2
              className={cn(
                "animate-spin text-text-secondary",
                styles.icon
              )}
              aria-label="Loading"
            />
          )}

          {/* Clear Button */}
          {showClearButton && (
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "text-text-tertiary hover:text-text-primary",
                "transition-colors duration-[var(--duration-fast)]",
                "focus:outline-none focus:text-text-primary",
                "rounded p-0.5",
                styles.icon
              )}
              aria-label="Clear input"
              tabIndex={-1}
            >
              <X className="w-full h-full" />
            </button>
          )}

          {/* Right Icon */}
          {rightIcon && !loading && !showClearButton && (
            <div
              className={cn(
                "pointer-events-none text-text-tertiary",
                "transition-colors duration-[var(--duration-fast)]",
                hasError && "text-error",
                styles.icon
              )}
            >
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error Message */}
        {typeof error === "string" && (
          <p
            id={`${props.id}-error`}
            className="mt-1.5 text-sm text-error animate-slide-down"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
