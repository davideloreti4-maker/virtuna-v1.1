"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Size variants for the Input component */
export type InputSize = "sm" | "md" | "lg";

/**
 * Props for the Input component
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Size variant of the input */
  size?: InputSize;
  /** Error state - boolean for styling only, string for styling + error message */
  error?: boolean | string;
  /** Loading state - shows spinner and disables input */
  loading?: boolean;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Show clear button when input has value */
  showClear?: boolean;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Additional className for the wrapper div */
  wrapperClassName?: string;
}

// Size-specific styles -- Raycast exact: md = 42px height, 12px padding, 14px font
const sizeStyles = {
  sm: {
    input: "h-8 px-2.5 text-[13px]",
    icon: "w-4 h-4",
    iconPadding: { left: "pl-8", right: "pr-8" },
  },
  md: {
    input: "h-[42px] px-3 text-[14px]",
    icon: "w-5 h-5",
    iconPadding: { left: "pl-10", right: "pr-10" },
  },
  lg: {
    input: "h-12 px-4 text-[15px]",
    icon: "w-5 h-5",
    iconPadding: { left: "pl-11", right: "pr-11" },
  },
} as const;

/**
 * Input component with Raycast-exact styling and full feature support.
 *
 * Renders with rgba(255,255,255,0.05) background, 5% border, 42px default height, 8px radius.
 * Supports size variants, left/right icons, clear button, loading spinner, and string error messages.
 *
 * @example
 * ```tsx
 * // Basic input
 * <Input placeholder="Enter your name" />
 *
 * // With icons and clear
 * <Input leftIcon={<Search />} showClear onClear={() => setValue("")} value={value} />
 *
 * // Error with message
 * <Input id="email" error="Email is required" />
 *
 * // Loading state
 * <Input loading placeholder="Processing..." />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      showClear = false,
      onClear,
      disabled,
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
    const needsWrapper = leftIcon || rightIcon || loading || showClear;

    const paddingLeft = leftIcon ? styles.iconPadding.left : "";
    const paddingRight =
      rightIcon || loading || showClearButton
        ? styles.iconPadding.right
        : "";

    const inputElement = (
      <input
        type={type}
        disabled={disabled || loading}
        value={value}
        className={cn(
          // Base styles -- Raycast: 8px radius, 5% border, full width
          "flex w-full rounded-[8px] border border-white/5",
          styles.input,
          paddingLeft,
          paddingRight,
          // Text
          "text-foreground placeholder:text-foreground-muted",
          // Transitions
          "transition-all duration-150",
          // Hover
          !disabled && !hasError && "hover:border-white/10",
          // Focus
          !disabled &&
            !hasError &&
            "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
          // Disabled
          disabled && "opacity-50 cursor-not-allowed",
          // Loading
          loading && "cursor-wait",
          // Error
          hasError &&
            "border-[var(--color-red)] focus:outline-none focus:ring-2 focus:ring-[var(--color-red-transparent)] focus:border-[var(--color-red)]",
          className
        )}
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          ...style,
        }}
        aria-invalid={hasError || undefined}
        aria-describedby={
          typeof error === "string" && props.id
            ? `${props.id}-error`
            : undefined
        }
        ref={ref}
        {...props}
      />
    );

    // Simple input without wrapper
    if (!needsWrapper) {
      return (
        <>
          {inputElement}
          {typeof error === "string" && props.id && (
            <p
              id={`${props.id}-error`}
              className="mt-1.5 text-sm text-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </>
      );
    }

    // Input with icon/clear/loading wrapper
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {/* Left Icon */}
        {leftIcon && (
          <div
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none",
              "text-foreground-muted transition-colors",
              hasError && "text-error",
              styles.icon
            )}
          >
            {leftIcon}
          </div>
        )}

        {inputElement}

        {/* Right Side Icons/Buttons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Loading Spinner */}
          {loading && (
            <Loader2
              className={cn(
                "animate-spin text-foreground-muted",
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
                "text-foreground-muted hover:text-foreground transition-colors rounded p-0.5",
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
                "pointer-events-none text-foreground-muted",
                hasError && "text-error",
                styles.icon
              )}
            >
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error Message */}
        {typeof error === "string" && props.id && (
          <p
            id={`${props.id}-error`}
            className="mt-1.5 text-sm text-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

/**
 * Props for the InputField component
 */
export interface InputFieldProps
  extends Omit<InputProps, "error"> {
  /** Label text displayed above the input */
  label?: string;
  /** Helper text displayed below the input (hidden when error is present) */
  helperText?: string;
  /** Error state - when string, displays as error message. When boolean true, only sets error styling. */
  error?: string | boolean;
}

/**
 * InputField component with label, helper text, and error message support.
 * Wraps the base Input component with proper labeling and accessibility.
 *
 * @example
 * ```tsx
 * <InputField label="Email" type="email" placeholder="you@example.com" />
 * <InputField label="Username" error="Username is already taken" />
 * ```
 */
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, helperText, error, id, className, ...props }, ref) => {
    const reactId = React.useId();
    const generatedId = id || `input${reactId}`;

    const hasError = !!error;
    const errorMessage = typeof error === "string" ? error : undefined;

    const helperId =
      helperText && !hasError ? `${generatedId}-helper` : undefined;
    const errorId = errorMessage ? `${generatedId}-error` : undefined;
    const describedBy =
      [helperId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <Input
          id={generatedId}
          error={hasError}
          aria-describedby={describedBy}
          ref={ref}
          {...props}
        />
        {helperText && !hasError && (
          <p id={helperId} className="text-sm text-foreground-muted">
            {helperText}
          </p>
        )}
        {errorMessage && (
          <p id={errorId} className="text-sm text-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);
InputField.displayName = "InputField";

export { Input, InputField };
