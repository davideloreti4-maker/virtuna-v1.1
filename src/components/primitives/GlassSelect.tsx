"use client";

import { cn } from "@/lib/utils";
import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Size variants for the select */
export type GlassSelectSize = "sm" | "md" | "lg";

/** Option item structure */
export interface SelectOption {
  /** Unique value for the option */
  value: string;
  /** Display label */
  label: string;
  /** Optional disabled state */
  disabled?: boolean;
  /** Optional icon or prefix element */
  icon?: ReactNode;
}

/** Option group structure */
export interface SelectOptionGroup {
  /** Group label */
  label: string;
  /** Options in this group */
  options: SelectOption[];
}

export interface GlassSelectProps {
  /** Options as flat array or grouped array */
  options: SelectOption[] | SelectOptionGroup[];
  /** Controlled value */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Change handler - receives the selected value */
  onChange?: (value: string) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Size variant */
  size?: GlassSelectSize;
  /** Error state with optional error message */
  error?: boolean | string;
  /** Disabled state */
  disabled?: boolean;
  /** Enable search/filter functionality */
  searchable?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Custom filter function */
  filterOption?: (option: SelectOption, searchQuery: string) => boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** Additional className for the dropdown */
  dropdownClassName?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Accessible name */
  "aria-label"?: string;
  /** ID for the select */
  id?: string;
}

// Size-specific styling configurations
const sizeStyles = {
  sm: {
    trigger: "h-8 px-3 text-sm gap-2",
    dropdown: "text-sm",
    option: "px-3 py-1.5 text-sm",
    icon: "w-4 h-4",
    caret: 14,
    searchInput: "h-8 px-3 text-sm",
  },
  md: {
    trigger: "h-10 px-4 text-base gap-2",
    dropdown: "text-base",
    option: "px-4 py-2 text-base",
    icon: "w-5 h-5",
    caret: 16,
    searchInput: "h-10 px-4 text-base",
  },
  lg: {
    trigger: "h-12 px-5 text-lg gap-3",
    dropdown: "text-lg",
    option: "px-5 py-2.5 text-lg",
    icon: "w-6 h-6",
    caret: 18,
    searchInput: "h-12 px-5 text-lg",
  },
};

// Default filter function
const defaultFilterOption = (option: SelectOption, query: string): boolean => {
  return option.label.toLowerCase().includes(query.toLowerCase());
};

// Flatten grouped options for easier searching
const flattenOptions = (
  options: SelectOption[] | SelectOptionGroup[]
): SelectOption[] => {
  if (!options.length) return [];
  const firstOption = options[0];
  if (firstOption && "options" in firstOption) {
    return (options as SelectOptionGroup[]).flatMap((group) => group.options);
  }
  return options as SelectOption[];
};

/**
 * GlassSelect - Glassmorphism dropdown select with Raycast-style interactions.
 *
 * Features:
 * - Glass trigger button with selected value display
 * - Glass dropdown panel with blur effect
 * - Keyboard navigation (Arrow keys, Enter, Escape, Home, End)
 * - Optional search/filter functionality
 * - Support for flat options or option groups
 * - Click outside to close
 * - Multiple states: default, open, hover, focus, error, disabled
 * - Size variants (sm, md, lg)
 * - Full accessibility with ARIA combobox pattern
 *
 * @example
 * // Basic select
 * <GlassSelect
 *   options={[
 *     { value: "1", label: "Option 1" },
 *     { value: "2", label: "Option 2" },
 *     { value: "3", label: "Option 3" },
 *   ]}
 *   placeholder="Select an option..."
 * />
 *
 * @example
 * // Controlled with change handler
 * const [value, setValue] = useState("");
 * <GlassSelect
 *   value={value}
 *   onChange={setValue}
 *   options={options}
 *   placeholder="Choose..."
 * />
 *
 * @example
 * // With search functionality
 * <GlassSelect
 *   searchable
 *   searchPlaceholder="Search options..."
 *   options={longOptionsList}
 *   placeholder="Search and select..."
 * />
 *
 * @example
 * // Grouped options
 * <GlassSelect
 *   options={[
 *     {
 *       label: "Fruits",
 *       options: [
 *         { value: "apple", label: "Apple" },
 *         { value: "banana", label: "Banana" },
 *       ],
 *     },
 *     {
 *       label: "Vegetables",
 *       options: [
 *         { value: "carrot", label: "Carrot" },
 *         { value: "lettuce", label: "Lettuce" },
 *       ],
 *     },
 *   ]}
 * />
 *
 * @example
 * // With icons and error state
 * <GlassSelect
 *   options={[
 *     { value: "user", label: "User", icon: <User /> },
 *     { value: "admin", label: "Admin", icon: <Shield /> },
 *   ]}
 *   error="Please select a role"
 *   size="lg"
 * />
 */
export const GlassSelect = forwardRef<HTMLButtonElement, GlassSelectProps>(
  (
    {
      options,
      value: controlledValue,
      defaultValue,
      onChange,
      placeholder = "Select...",
      size = "md",
      error = false,
      disabled = false,
      searchable = false,
      searchPlaceholder = "Search...",
      filterOption = defaultFilterOption,
      className,
      dropdownClassName,
      style,
      "aria-label": ariaLabel,
      id,
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(
      defaultValue || ""
    );
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Determine if controlled or uncontrolled
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const hasError = !!error;
    const styles = sizeStyles[size];

    // Flatten all options for easier access
    const allOptions = flattenOptions(options);

    // Filter options based on search query
    const filteredOptions = searchable && searchQuery
      ? allOptions.filter((opt) => filterOption(opt, searchQuery))
      : allOptions;

    // Find selected option
    const selectedOption = allOptions.find((opt) => opt.value === value);

    // Handle value change
    const handleSelect = (optionValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(optionValue);
      }
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchQuery("");
    };

    // Handle click outside to close
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setSearchQuery("");
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Focus search input when opened
    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    // Reset highlighted index when filtered options change
    useEffect(() => {
      setHighlightedIndex(0);
    }, [searchQuery]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          }
          break;

        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;

        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;

        case "Home":
          if (isOpen) {
            e.preventDefault();
            setHighlightedIndex(0);
          }
          break;

        case "End":
          if (isOpen) {
            e.preventDefault();
            setHighlightedIndex(filteredOptions.length - 1);
          }
          break;

        case "Tab":
          if (isOpen) {
            setIsOpen(false);
            setSearchQuery("");
          }
          break;
      }
    };

    // Scroll highlighted option into view
    useEffect(() => {
      if (isOpen && optionRefs.current[highlightedIndex]) {
        optionRefs.current[highlightedIndex]?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }, [highlightedIndex, isOpen]);

    // Render options (handles both flat and grouped)
    const renderOptions = () => {
      if (!options.length) {
        return (
          <div
            className={cn(
              "px-4 py-8 text-center text-text-tertiary",
              styles.option
            )}
          >
            No options available
          </div>
        );
      }

      // Check if grouped
      const firstOption = options[0];
      const isGrouped = firstOption && "options" in firstOption;

      if (isGrouped) {
        const groups = options as SelectOptionGroup[];
        let flatIndex = 0;

        return groups.map((group, groupIndex) => {
          const groupOptions = searchable && searchQuery
            ? group.options.filter((opt) => filterOption(opt, searchQuery))
            : group.options;

          if (groupOptions.length === 0) return null;

          return (
            <div key={groupIndex}>
              {/* Group Label */}
              <div
                className={cn(
                  "px-4 py-2 text-xs font-semibold uppercase tracking-wider",
                  "text-text-tertiary border-b border-border-glass",
                  "sticky top-0 glass-base glass-blur-sm z-10"
                )}
              >
                {group.label}
              </div>

              {/* Group Options */}
              {groupOptions.map((option) => {
                const currentIndex = flatIndex++;
                const isHighlighted = filteredOptions[highlightedIndex]?.value === option.value;
                const isSelected = option.value === value;

                return renderOption(option, currentIndex, isHighlighted, isSelected);
              })}
            </div>
          );
        });
      }

      // Flat options
      return filteredOptions.map((option, index) => {
        const isHighlighted = index === highlightedIndex;
        const isSelected = option.value === value;
        return renderOption(option, index, isHighlighted, isSelected);
      });
    };

    // Render individual option
    const renderOption = (
      option: SelectOption,
      index: number,
      isHighlighted: boolean,
      isSelected: boolean
    ) => (
      <button
        key={option.value}
        ref={(el) => { optionRefs.current[index] = el; }}
        type="button"
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
        disabled={option.disabled}
        onClick={() => !option.disabled && handleSelect(option.value)}
        onMouseEnter={() => setHighlightedIndex(index)}
        className={cn(
          "w-full flex items-center justify-between",
          styles.option,
          "transition-colors duration-[var(--duration-fast)]",
          "text-left",

          // Default state
          "text-text-primary",

          // Hover/highlighted state
          !option.disabled &&
            isHighlighted &&
            "bg-[oklch(0.70_0.18_40_/_0.1)] text-text-primary",

          // Selected state
          isSelected && "text-[oklch(0.70_0.18_40)]",

          // Disabled state
          option.disabled &&
            "opacity-40 cursor-not-allowed text-text-tertiary"
        )}
      >
        <span className="flex items-center gap-2">
          {option.icon && (
            <span className={cn("flex-shrink-0", styles.icon)}>
              {option.icon}
            </span>
          )}
          {option.label}
        </span>

        {/* Check icon for selected option */}
        {isSelected && (
          <Check
            weight="bold"
            className={cn(
              "flex-shrink-0 text-[oklch(0.70_0.18_40)]",
              styles.icon
            )}
          />
        )}
      </button>
    );

    return (
      <div
        ref={dropdownRef}
        className={cn("relative w-full", className)}
        style={style}
      >
        {/* Trigger Button */}
        <button
          ref={ref}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel || placeholder}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={
            isOpen && filteredOptions[highlightedIndex]
              ? filteredOptions[highlightedIndex].value
              : undefined
          }
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={cn(
            // Base glass styling
            "w-full rounded-lg flex items-center justify-between",
            "glass-base glass-blur-sm",
            styles.trigger,

            // Border
            "border border-border-glass",

            // Text styles
            "text-text-primary font-sans",

            // Transitions
            "transition-all",
            "duration-[var(--duration-fast)]",
            "ease-[var(--ease-out-cubic)]",

            // Default state
            "shadow-sm",

            // Hover state
            !disabled &&
              !hasError &&
              "hover:border-border-medium hover:shadow-md",

            // Focus state with coral glow
            !disabled &&
              !hasError &&
              "focus:outline-none focus:ring-2 focus:ring-[oklch(0.70_0.18_40_/_0.5)] focus:border-[oklch(0.70_0.18_40_/_0.7)]",
            !disabled &&
              !hasError &&
              "focus:shadow-[var(--shadow-glow-coral)]",

            // Open state
            isOpen && !hasError && "border-[oklch(0.70_0.18_40_/_0.7)]",

            // Error state
            hasError &&
              "border-error bg-[oklch(0.18_0.04_25_/_0.6)] text-error",
            hasError &&
              !disabled &&
              "focus:outline-none focus:ring-2 focus:ring-[oklch(0.65_0.22_25_/_0.5)] focus:border-error",

            // Disabled state
            disabled &&
              "opacity-50 cursor-not-allowed bg-[oklch(0.18_0.02_264_/_0.4)]"
          )}
          style={{
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {/* Selected value or placeholder */}
          <span
            className={cn(
              "flex items-center gap-2 flex-1 truncate",
              !selectedOption && "text-text-tertiary"
            )}
          >
            {selectedOption?.icon && (
              <span className={cn("flex-shrink-0", styles.icon)}>
                {selectedOption.icon}
              </span>
            )}
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {/* Caret icon */}
          <CaretDown
            weight="bold"
            size={styles.caret}
            className={cn(
              "flex-shrink-0 text-text-tertiary transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* Error Message */}
        {typeof error === "string" && (
          <p
            id={`${id}-error`}
            className="mt-1.5 text-sm text-error animate-slide-down"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Dropdown Panel */}
        {isOpen && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-label={ariaLabel || "Options"}
            className={cn(
              // Positioning
              "absolute z-50 w-full mt-2",

              // Glass styling
              "glass-base glass-blur-md",
              "rounded-lg border border-border-glass",
              "shadow-lg",

              // Animation
              "animate-slide-down origin-top",

              dropdownClassName
            )}
            style={{
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-border-glass">
                <div className="relative">
                  <MagnifyingGlass
                    weight="bold"
                    className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2",
                      "text-text-tertiary pointer-events-none",
                      styles.icon
                    )}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(
                      "w-full rounded-md pl-10 pr-8",
                      "bg-[oklch(0.18_0.02_264_/_0.6)]",
                      "border border-border-glass",
                      "text-text-primary placeholder:text-text-tertiary",
                      "focus:outline-none focus:ring-2 focus:ring-[oklch(0.70_0.18_40_/_0.3)]",
                      "transition-all duration-[var(--duration-fast)]",
                      styles.searchInput
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchQuery("");
                        searchInputRef.current?.blur();
                      }
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2",
                        "text-text-tertiary hover:text-text-primary",
                        "transition-colors duration-[var(--duration-fast)]",
                        styles.icon
                      )}
                      aria-label="Clear search"
                    >
                      <X weight="bold" className="w-full h-full" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredOptions.length > 0 ? (
                renderOptions()
              ) : (
                <div
                  className={cn(
                    "px-4 py-8 text-center text-text-tertiary",
                    styles.option
                  )}
                >
                  {searchable && searchQuery
                    ? "No results found"
                    : "No options available"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

GlassSelect.displayName = "GlassSelect";
