"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the Input component
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error state - adds error styling to the input
   */
  error?: boolean;
}

/**
 * Base Input component with full state support.
 *
 * Supports text, password, search, email, number, tel, and url types.
 * Height is 44px (h-11) for touch target compliance.
 *
 * @example
 * ```tsx
 * // Text input
 * <Input type="text" placeholder="Enter your name" />
 *
 * // Password input
 * <Input type="password" placeholder="Enter password" />
 *
 * // Search input
 * <Input type="search" placeholder="Search..." />
 *
 * // With error state
 * <Input type="email" error placeholder="Enter email" />
 *
 * // Disabled
 * <Input type="text" disabled placeholder="Cannot edit" />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-11 w-full rounded-md border bg-surface px-3 text-foreground",
          "placeholder:text-foreground-muted",
          // Transitions
          "transition-colors duration-fast",
          // Focus
          "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
          // Disabled
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // States
          error
            ? "border-error focus:ring-error/50 focus:border-error"
            : "border-border hover:border-border-hover",
          className
        )}
        aria-invalid={error || undefined}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

/**
 * Props for the InputField component
 */
export interface InputFieldProps extends Omit<InputProps, "error"> {
  /**
   * Label text displayed above the input
   */
  label?: string;
  /**
   * Helper text displayed below the input (hidden when error is present)
   */
  helperText?: string;
  /**
   * Error state - when string, displays as error message and sets error styling.
   * When boolean true, only sets error styling without message.
   */
  error?: string | boolean;
}

/**
 * InputField component with label, helper text, and error message support.
 * Wraps the base Input component with proper labeling and accessibility.
 *
 * @example
 * ```tsx
 * // With label
 * <InputField label="Email" type="email" placeholder="you@example.com" />
 *
 * // With label and helper text
 * <InputField
 *   label="Password"
 *   type="password"
 *   helperText="Must be at least 8 characters"
 * />
 *
 * // With error message
 * <InputField
 *   label="Username"
 *   error="Username is already taken"
 * />
 *
 * // With label only and boolean error (no message)
 * <InputField label="Name" error={hasError} />
 * ```
 */
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, helperText, error, id, className, ...props }, ref) => {
    // Generate stable ID using React.useId() for SSR hydration safety
    const reactId = React.useId();
    const generatedId = id || `input${reactId}`;

    const hasError = !!error;
    const errorMessage = typeof error === "string" ? error : undefined;

    // Build aria-describedby value
    const helperId = helperText && !hasError ? `${generatedId}-helper` : undefined;
    const errorId = errorMessage ? `${generatedId}-error` : undefined;
    const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

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
          <p
            id={helperId}
            className="text-sm text-foreground-muted"
          >
            {helperText}
          </p>
        )}
        {errorMessage && (
          <p
            id={errorId}
            className="text-sm text-error"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);
InputField.displayName = "InputField";

export { Input, InputField };
