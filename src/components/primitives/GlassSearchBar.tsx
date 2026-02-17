"use client";

import { cn } from "@/lib/utils";
import { MagnifyingGlass, CircleNotch, X } from "@phosphor-icons/react";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type CSSProperties,
} from "react";

export interface GlassSearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onSearch"> {
  /** Callback fired when user submits search (Enter key or button click) */
  onSearch?: (value: string) => void;
  /** Show loading spinner instead of search icon */
  loading?: boolean;
  /** Show keyboard shortcut hint (e.g., "⌘K") */
  shortcutHint?: string;
  /** Additional className for the container */
  className?: string;
  /** Custom style overrides for the container */
  style?: CSSProperties;
  /** Placeholder text */
  placeholder?: string;
  /** Controlled value */
  value?: string;
  /** Callback when value changes */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback when clear button is clicked */
  onClear?: () => void;
}

/**
 * GlassSearchBar - Raycast-style command bar search input with glass morphism.
 *
 * Features:
 * - Glass background with proper blur
 * - Magnifying glass icon on the left
 * - Loading spinner state
 * - Clear button when has value
 * - Keyboard shortcut hint display
 * - Enter key to submit search
 * - Escape key to clear
 *
 * @example
 * // Basic search bar
 * <GlassSearchBar
 *   placeholder="Search..."
 *   onSearch={(value) => console.log(value)}
 * />
 *
 * @example
 * // With keyboard shortcut hint
 * <GlassSearchBar
 *   placeholder="Search commands..."
 *   shortcutHint="⌘K"
 *   onSearch={handleSearch}
 * />
 *
 * @example
 * // Controlled with loading state
 * <GlassSearchBar
 *   value={searchQuery}
 *   onChange={(e) => setSearchQuery(e.target.value)}
 *   loading={isSearching}
 *   onSearch={performSearch}
 * />
 *
 * @example
 * // With custom clear handler
 * <GlassSearchBar
 *   value={query}
 *   onChange={(e) => setQuery(e.target.value)}
 *   onClear={() => {
 *     setQuery("");
 *     resetResults();
 *   }}
 * />
 */
export const GlassSearchBar = forwardRef<HTMLInputElement, GlassSearchBarProps>(
  (
    {
      onSearch,
      loading = false,
      shortcutHint,
      className,
      style,
      placeholder = "Search...",
      value: controlledValue,
      onChange,
      onClear,
      onKeyDown,
      ...inputProps
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue("");
      }
      onClear?.();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        onSearch?.(value.trim());
      } else if (e.key === "Escape" && value) {
        handleClear();
        e.currentTarget.blur();
      }
      onKeyDown?.(e);
    };

    const showClearButton = value && !loading;

    return (
      <div
        className={cn(
          // Container
          "group relative flex items-center gap-3",
          // Glass effect - Raycast exact values
          "backdrop-blur-[10px] rounded-[var(--rounding-md)]",
          "border border-[var(--color-grey-500)]",
          // Raycast search bar shadows
          "shadow-sm",
          // Sizing - Raycast exact: height: 43.25px, padding: 12px
          "h-[43px] px-3",
          // Focus within effect - Raycast style glow
          "focus-within:border-white/[0.1]",
          "transition-all duration-[var(--duration-fast)]",
          "ease-[var(--ease-out)]",
          className
        )}
        style={{
          // Raycast exact: rgb(12, 13, 15) = #0c0d0f = --color-grey-800
          backgroundColor: "var(--color-grey-800)",
          ...style,
        }}
      >
        {/* Left Icon: Search or Loading Spinner - Raycast style */}
        <div className="flex-shrink-0 text-[var(--color-grey-300)] transition-colors duration-[var(--duration-fast)] group-focus-within:text-[var(--color-grey-100)]">
          {loading ? (
            <CircleNotch size={18} weight="bold" className="animate-spin" />
          ) : (
            <MagnifyingGlass size={18} weight="bold" />
          )}
        </div>

        {/* Input Field */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            // Layout
            "flex-1 bg-transparent outline-none",
            // Text - Raycast exact: 15px, placeholder rgb(106, 107, 108) = --color-grey-300
            "text-[var(--color-fg)] text-[15px] font-medium",
            "placeholder:text-[var(--color-grey-300)]",
            // Remove default input styles
            "border-none focus:ring-0",
            // Disable autofill styles
            "autofill:bg-transparent"
          )}
          {...inputProps}
        />

        {/* Right Side: Clear Button or Shortcut Hint */}
        {showClearButton ? (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "flex-shrink-0 p-1 rounded-[var(--rounding-xs)]",
              "text-[var(--color-grey-300)] hover:text-[var(--color-grey-100)] hover:bg-white/5",
              "transition-all duration-[var(--duration-fast)]",
              "active:scale-95"
            )}
            aria-label="Clear search"
          >
            <X size={14} weight="bold" />
          </button>
        ) : shortcutHint && !loading ? (
          /* Raycast Kbd styling: 11-12px, 4-6px radius, rgb(156,156,157) */
          <kbd
            className={cn(
              "flex-shrink-0 px-1.5 py-0.5 rounded-[var(--rounding-xs)]",
              "text-[11px] font-medium text-[var(--color-grey-200)]",
              "border border-white/10",
              "bg-white/5",
              "transition-opacity duration-[var(--duration-fast)]",
              "group-focus-within:opacity-0"
            )}
          >
            {shortcutHint}
          </kbd>
        ) : null}
      </div>
    );
  }
);

GlassSearchBar.displayName = "GlassSearchBar";
