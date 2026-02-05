"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single selectable option */
export interface SelectOption {
  /** Unique value for the option */
  value: string;
  /** Display label */
  label: string;
  /** Optional disabled state */
  disabled?: boolean;
}

/** A group of options with a label separator */
export interface SelectGroup {
  /** Group label rendered as a sticky header */
  label: string;
  /** Options within this group */
  options: SelectOption[];
}

/** Props for the Select component */
export interface SelectProps {
  /** Options as a flat array or grouped array */
  options: (SelectOption | SelectGroup)[];
  /** Controlled value */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Change handler - receives the selected value */
  onChange?: (value: string) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Error state styling */
  error?: boolean;
  /** Additional className for the outer wrapper */
  className?: string;
}

/** Props for the SearchableSelect component */
export interface SearchableSelectProps extends SelectProps {
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Text displayed when no options match the search query */
  noResultsText?: string;
}

// ---------------------------------------------------------------------------
// CVA - Trigger
// ---------------------------------------------------------------------------

const selectTriggerVariants = cva(
  "w-full rounded-lg flex items-center justify-between border transition-all cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-sm gap-2",
        md: "h-10 px-4 text-base gap-2",
        lg: "h-12 px-5 text-lg gap-3",
      },
    },
    defaultVariants: { size: "md" },
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Type guard: is this item a SelectGroup? */
function isGroup(item: SelectOption | SelectGroup): item is SelectGroup {
  return "options" in item;
}

/** Flatten mixed options/groups into a flat SelectOption[] */
function flattenOptions(items: (SelectOption | SelectGroup)[]): SelectOption[] {
  const flat: SelectOption[] = [];
  for (const item of items) {
    if (isGroup(item)) {
      flat.push(...item.options);
    } else {
      flat.push(item);
    }
  }
  return flat;
}

/** Find the next non-disabled index moving in `direction` */
function findNextEnabledIndex(
  options: SelectOption[],
  current: number,
  direction: 1 | -1,
): number {
  const len = options.length;
  if (len === 0) return -1;

  let idx = current + direction;
  // Wrap around
  while (idx !== current) {
    if (idx < 0) idx = len - 1;
    if (idx >= len) idx = 0;
    if (!options[idx]?.disabled) return idx;
    idx += direction;
  }
  // If we looped all the way back, return current if it's enabled
  return options[current]?.disabled ? -1 : current;
}

/** Find the first non-disabled index from the start or end */
function findEdgeIndex(
  options: SelectOption[],
  edge: "first" | "last",
): number {
  if (edge === "first") {
    for (let i = 0; i < options.length; i++) {
      if (!options[i]?.disabled) return i;
    }
  } else {
    for (let i = options.length - 1; i >= 0; i--) {
      if (!options[i]?.disabled) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Internal: useSelect hook (shared logic)
// ---------------------------------------------------------------------------

interface UseSelectConfig {
  options: (SelectOption | SelectGroup)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
}

function useSelect(config: UseSelectConfig) {
  const {
    options,
    value: controlledValue,
    defaultValue,
    onChange,
    disabled = false,
    searchable = false,
  } = config;

  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    defaultValue ?? "",
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  // Flatten all options
  const allOptions = React.useMemo(() => flattenOptions(options), [options]);

  // Filtered options (only when searchable + has query)
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery) return allOptions;
    return allOptions.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [allOptions, searchable, searchQuery]);

  // Selected option
  const selectedOption = allOptions.find((opt) => opt.value === currentValue);

  // Select an option
  const handleSelect = React.useCallback(
    (optionValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(optionValue);
      }
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchQuery("");
    },
    [isControlled, onChange],
  );

  // Open dropdown
  const open = React.useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery("");
    // Set highlight to currently selected option
    const selectedIdx = filteredOptions.findIndex(
      (opt) => opt.value === currentValue,
    );
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [disabled, filteredOptions, currentValue]);

  // Close dropdown
  const close = React.useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, []);

  // Toggle
  const toggle = React.useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, close, open]);

  // Click-outside handler
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // Focus search input when opened
  React.useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset highlight when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Scroll highlighted option into view
  React.useEffect(() => {
    if (isOpen && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ": {
          // When search input is focused and space is pressed, allow typing
          if (
            e.key === " " &&
            searchable &&
            document.activeElement === searchInputRef.current
          ) {
            return;
          }
          e.preventDefault();
          if (!isOpen) {
            open();
          } else {
            const option = filteredOptions[highlightedIndex];
            if (option && !option.disabled) {
              handleSelect(option.value);
              // Return focus to trigger after selection
              triggerRef.current?.focus();
            }
          }
          break;
        }

        case "Escape":
          e.preventDefault();
          close();
          triggerRef.current?.focus();
          break;

        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            open();
          } else {
            setHighlightedIndex((prev) =>
              findNextEnabledIndex(filteredOptions, prev, 1),
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              findNextEnabledIndex(filteredOptions, prev, -1),
            );
          }
          break;

        case "Home":
          if (isOpen) {
            e.preventDefault();
            const first = findEdgeIndex(filteredOptions, "first");
            if (first >= 0) setHighlightedIndex(first);
          }
          break;

        case "End":
          if (isOpen) {
            e.preventDefault();
            const last = findEdgeIndex(filteredOptions, "last");
            if (last >= 0) setHighlightedIndex(last);
          }
          break;

        case "Tab":
          if (isOpen) {
            close();
          }
          break;
      }
    },
    [
      disabled,
      isOpen,
      filteredOptions,
      highlightedIndex,
      searchable,
      handleSelect,
      open,
      close,
    ],
  );

  return {
    isOpen,
    searchQuery,
    setSearchQuery,
    highlightedIndex,
    setHighlightedIndex,
    containerRef,
    triggerRef,
    searchInputRef,
    optionRefs,
    currentValue,
    allOptions,
    filteredOptions,
    selectedOption,
    handleSelect,
    toggle,
    close,
    handleKeyDown,
  };
}

// ---------------------------------------------------------------------------
// Internal: OptionItem
// ---------------------------------------------------------------------------

interface OptionItemProps {
  option: SelectOption;
  index: number;
  isHighlighted: boolean;
  isSelected: boolean;
  onSelect: (value: string) => void;
  onHover: (index: number) => void;
  refCallback: (el: HTMLButtonElement | null) => void;
}

function OptionItem({
  option,
  index,
  isHighlighted,
  isSelected,
  onSelect,
  onHover,
  refCallback,
}: OptionItemProps) {
  return (
    <button
      ref={refCallback}
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
      disabled={option.disabled}
      onClick={() => !option.disabled && onSelect(option.value)}
      onMouseEnter={() => onHover(index)}
      className={cn(
        "flex items-center gap-2 w-full px-4 py-2 text-sm cursor-pointer transition-colors",
        "text-left text-foreground",
        // Highlighted (keyboard / hover)
        !option.disabled && isHighlighted && "bg-white/5 text-foreground",
        // Selected
        isSelected && "text-accent",
        // Disabled
        option.disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className="flex-1 truncate">{option.label}</span>
      {isSelected && (
        <Check
          weight="bold"
          className="flex-shrink-0 w-4 h-4 text-accent"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Internal: render options (handles groups + flat)
// ---------------------------------------------------------------------------

interface RenderOptionsConfig {
  options: (SelectOption | SelectGroup)[];
  filteredOptions: SelectOption[];
  highlightedIndex: number;
  currentValue: string;
  onSelect: (value: string) => void;
  onHover: (index: number) => void;
  optionRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  searchable: boolean;
  searchQuery: string;
}

function renderOptionsList(config: RenderOptionsConfig): React.ReactNode {
  const {
    options,
    filteredOptions,
    highlightedIndex,
    currentValue,
    onSelect,
    onHover,
    optionRefs,
    searchable,
    searchQuery,
  } = config;

  // Check if grouped
  const hasGroups = options.some(isGroup);

  if (hasGroups) {
    let flatIndex = 0;

    return options.map((item, groupIdx) => {
      if (!isGroup(item)) {
        // It's a standalone option mixed in with groups
        const opt = item;
        const shouldShow =
          !searchable ||
          !searchQuery ||
          opt.label.toLowerCase().includes(searchQuery.toLowerCase());
        if (!shouldShow) return null;

        const idx = filteredOptions.findIndex((fo) => fo.value === opt.value);
        if (idx < 0) return null;
        const currentFlatIdx = idx;

        return (
          <OptionItem
            key={opt.value}
            option={opt}
            index={currentFlatIdx}
            isHighlighted={currentFlatIdx === highlightedIndex}
            isSelected={opt.value === currentValue}
            onSelect={onSelect}
            onHover={onHover}
            refCallback={(el) => {
              optionRefs.current[currentFlatIdx] = el;
            }}
          />
        );
      }

      // Group
      const group = item;
      const groupOptions =
        searchable && searchQuery
          ? group.options.filter((opt) =>
              opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
            )
          : group.options;

      if (groupOptions.length === 0) return null;

      return (
        <div key={`group-${groupIdx}`} role="group" aria-label={group.label}>
          {/* Group Label */}
          <div className="px-4 py-1.5 text-xs font-medium text-foreground-secondary uppercase tracking-wider">
            {group.label}
          </div>

          {/* Group Options */}
          {groupOptions.map((option) => {
            const idx = filteredOptions.findIndex(
              (fo) => fo.value === option.value,
            );
            if (idx < 0) return null;
            const currentIdx = idx;
            flatIndex++;

            return (
              <OptionItem
                key={option.value}
                option={option}
                index={currentIdx}
                isHighlighted={currentIdx === highlightedIndex}
                isSelected={option.value === currentValue}
                onSelect={onSelect}
                onHover={onHover}
                refCallback={(el) => {
                  optionRefs.current[currentIdx] = el;
                }}
              />
            );
          })}
        </div>
      );
    });
  }

  // Flat options
  return filteredOptions.map((option, index) => (
    <OptionItem
      key={option.value}
      option={option}
      index={index}
      isHighlighted={index === highlightedIndex}
      isSelected={option.value === currentValue}
      onSelect={onSelect}
      onHover={onHover}
      refCallback={(el) => {
        optionRefs.current[index] = el;
      }}
    />
  ));
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

/**
 * Select dropdown component with full keyboard navigation and glassmorphism styling.
 *
 * Uses semantic design tokens and CVA size variants. Renders option groups
 * with label separators when provided.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Select
 *   options={[
 *     { value: "1", label: "Option 1" },
 *     { value: "2", label: "Option 2" },
 *     { value: "3", label: "Option 3" },
 *   ]}
 *   placeholder="Select an option..."
 * />
 *
 * // Controlled
 * const [value, setValue] = useState("");
 * <Select value={value} onChange={setValue} options={options} />
 *
 * // With groups
 * <Select
 *   options={[
 *     { label: "Fruits", options: [{ value: "apple", label: "Apple" }] },
 *     { label: "Vegetables", options: [{ value: "carrot", label: "Carrot" }] },
 *   ]}
 * />
 *
 * // Sizes
 * <Select size="sm" options={options} />
 * <Select size="md" options={options} />
 * <Select size="lg" options={options} />
 * ```
 */
const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onChange,
      placeholder = "Select...",
      disabled = false,
      size = "md",
      error = false,
      className,
    },
    ref,
  ) => {
    const state = useSelect({
      options,
      value,
      defaultValue,
      onChange,
      disabled,
      searchable: false,
    });

    // Generate a stable listbox id
    const listboxId = React.useId();

    return (
      <div
        ref={(node) => {
          // Merge forwarded ref + internal ref
          (
            state.containerRef as React.MutableRefObject<HTMLDivElement | null>
          ).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn("relative w-full", className)}
      >
        {/* Trigger */}
        <button
          ref={state.triggerRef}
          type="button"
          role="combobox"
          aria-expanded={state.isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-label={placeholder}
          aria-activedescendant={
            state.isOpen && state.filteredOptions[state.highlightedIndex]
              ? `option-${state.filteredOptions[state.highlightedIndex]!.value}`
              : undefined
          }
          disabled={disabled}
          onClick={state.toggle}
          onKeyDown={state.handleKeyDown}
          className={cn(
            selectTriggerVariants({ size }),
            // Default state
            "bg-surface border-border-glass text-foreground",
            // Focus
            "focus:outline-none",
            // Open state
            state.isOpen &&
              !error &&
              "border-accent/50 ring-2 ring-accent/20",
            // Error state
            error && "border-error/50",
            // Disabled
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "flex-1 truncate text-left",
              !state.selectedOption && "text-foreground-muted",
            )}
          >
            {state.selectedOption
              ? state.selectedOption.label
              : placeholder}
          </span>
          <CaretDown
            weight="bold"
            className={cn(
              "flex-shrink-0 w-4 h-4 text-foreground-secondary transition-transform duration-200",
              state.isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        {/* Dropdown Panel */}
        {state.isOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={placeholder}
            className={cn(
              // Position
              "absolute z-[var(--z-dropdown)] w-full mt-1",
              // Styling
              "bg-surface-elevated border border-border-glass rounded-lg shadow-xl overflow-hidden",
            )}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {state.filteredOptions.length > 0 ? (
                renderOptionsList({
                  options,
                  filteredOptions: state.filteredOptions,
                  highlightedIndex: state.highlightedIndex,
                  currentValue: state.currentValue,
                  onSelect: state.handleSelect,
                  onHover: state.setHighlightedIndex,
                  optionRefs: state.optionRefs,
                  searchable: false,
                  searchQuery: "",
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-foreground-secondary">
                  No options available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";

// ---------------------------------------------------------------------------
// SearchableSelect
// ---------------------------------------------------------------------------

/**
 * Searchable Select dropdown with type-to-filter functionality.
 *
 * Same as Select but adds a search input at the top of the dropdown panel.
 * Options are filtered case-insensitively as the user types.
 *
 * @example
 * ```tsx
 * // Basic searchable
 * <SearchableSelect
 *   options={countries}
 *   placeholder="Select country..."
 *   searchPlaceholder="Search countries..."
 * />
 *
 * // Controlled with custom no-results text
 * const [country, setCountry] = useState("");
 * <SearchableSelect
 *   value={country}
 *   onChange={setCountry}
 *   options={countries}
 *   noResultsText="No countries match your search"
 * />
 * ```
 */
const SearchableSelect = React.forwardRef<HTMLDivElement, SearchableSelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onChange,
      placeholder = "Select...",
      disabled = false,
      size = "md",
      error = false,
      className,
      searchPlaceholder = "Search...",
      noResultsText = "No results found",
    },
    ref,
  ) => {
    const state = useSelect({
      options,
      value,
      defaultValue,
      onChange,
      disabled,
      searchable: true,
    });

    const listboxId = React.useId();

    return (
      <div
        ref={(node) => {
          (
            state.containerRef as React.MutableRefObject<HTMLDivElement | null>
          ).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn("relative w-full", className)}
        onKeyDown={state.handleKeyDown}
      >
        {/* Trigger */}
        <button
          ref={state.triggerRef}
          type="button"
          role="combobox"
          aria-expanded={state.isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-label={placeholder}
          aria-activedescendant={
            state.isOpen && state.filteredOptions[state.highlightedIndex]
              ? `option-${state.filteredOptions[state.highlightedIndex]!.value}`
              : undefined
          }
          disabled={disabled}
          onClick={state.toggle}
          onKeyDown={state.handleKeyDown}
          className={cn(
            selectTriggerVariants({ size }),
            "bg-surface border-border-glass text-foreground",
            "focus:outline-none",
            state.isOpen &&
              !error &&
              "border-accent/50 ring-2 ring-accent/20",
            error && "border-error/50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "flex-1 truncate text-left",
              !state.selectedOption && "text-foreground-muted",
            )}
          >
            {state.selectedOption
              ? state.selectedOption.label
              : placeholder}
          </span>
          <CaretDown
            weight="bold"
            className={cn(
              "flex-shrink-0 w-4 h-4 text-foreground-secondary transition-transform duration-200",
              state.isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        {/* Dropdown Panel */}
        {state.isOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={placeholder}
            className={cn(
              "absolute z-[var(--z-dropdown)] w-full mt-1",
              "bg-surface-elevated border border-border-glass rounded-lg shadow-xl overflow-hidden",
            )}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-border-glass">
              <div className="relative">
                <MagnifyingGlass
                  weight="bold"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={state.searchInputRef}
                  type="text"
                  value={state.searchQuery}
                  onChange={(e) => state.setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(
                    "w-full rounded-md pl-10 pr-8 h-9",
                    "bg-surface border border-border-glass",
                    "text-foreground text-sm placeholder:text-foreground-muted",
                    "focus:outline-none focus:ring-2 focus:ring-accent/30",
                    "transition-colors duration-fast",
                  )}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={searchPlaceholder}
                />
                {state.searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      state.setSearchQuery("");
                      state.searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X weight="bold" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto py-1">
              {state.filteredOptions.length > 0 ? (
                renderOptionsList({
                  options,
                  filteredOptions: state.filteredOptions,
                  highlightedIndex: state.highlightedIndex,
                  currentValue: state.currentValue,
                  onSelect: (val) => {
                    state.handleSelect(val);
                    state.triggerRef.current?.focus();
                  },
                  onHover: state.setHighlightedIndex,
                  optionRefs: state.optionRefs,
                  searchable: true,
                  searchQuery: state.searchQuery,
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-foreground-secondary">
                  {noResultsText}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
SearchableSelect.displayName = "SearchableSelect";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { Select, SearchableSelect, selectTriggerVariants };
