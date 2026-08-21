"use client";

import { cn } from "@/lib/utils";
import { MagnifyingGlass, CaretRight, Command } from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface CommandItem {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon element */
  icon?: ReactNode;
  /** Keyboard shortcut (e.g., "⌘K") */
  shortcut?: string;
  /** Group/category name */
  group?: string;
  /** Action when selected */
  onSelect?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Keywords for search (not displayed) */
  keywords?: string[];
}

export interface CommandGroup {
  /** Group title */
  title: string;
  /** Items in this group */
  items: CommandItem[];
}

export interface CommandPaletteProps {
  /** Open state (controlled) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Command items (flat list or grouped) */
  items: CommandItem[] | CommandGroup[];
  /** Placeholder text for search */
  placeholder?: string;
  /** Custom empty state */
  emptyMessage?: string;
  /** Additional className for the dialog */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Keyboard shortcut to open (default: ⌘K) */
  shortcut?: { key: string; metaKey?: boolean; ctrlKey?: boolean };
}

/**
 * CommandPalette - Raycast-style command bar with search and keyboard navigation.
 *
 * Features:
 * - Glass modal overlay with blur
 * - Search input with real-time filtering
 * - Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
 * - Grouped commands with headers
 * - Keyboard shortcut display
 * - Recent/favorites section support
 *
 * @example
 * // Basic command palette
 * const [open, setOpen] = useState(false);
 *
 * <CommandPalette
 *   open={open}
 *   onOpenChange={setOpen}
 *   items={[
 *     { id: "1", title: "Go to Dashboard", icon: <Home />, onSelect: () => navigate("/") },
 *     { id: "2", title: "Settings", icon: <Gear />, shortcut: "⌘," },
 *   ]}
 * />
 *
 * @example
 * // With grouped items
 * <CommandPalette
 *   open={open}
 *   onOpenChange={setOpen}
 *   items={[
 *     {
 *       title: "Navigation",
 *       items: [
 *         { id: "home", title: "Home", icon: <Home /> },
 *         { id: "dash", title: "Dashboard", icon: <Layout /> },
 *       ],
 *     },
 *     {
 *       title: "Actions",
 *       items: [
 *         { id: "new", title: "New Project", icon: <Plus />, shortcut: "⌘N" },
 *       ],
 *     },
 *   ]}
 * />
 */
export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  items,
  placeholder = "Search commands...",
  emptyMessage = "No commands found.",
  className,
  style,
  shortcut = { key: "k", metaKey: true },
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  // Normalize items to groups
  const normalizeItems = (): CommandGroup[] => {
    if (items.length === 0) return [];

    // Check if first item is a group
    const firstItem = items[0];
    if (firstItem && "items" in firstItem) {
      return items as CommandGroup[];
    }

    // Flat list - group by category or put in single group
    const flatItems = items as CommandItem[];
    const groups = new Map<string, CommandItem[]>();

    flatItems.forEach((item) => {
      const groupName = item.group || "Commands";
      const existing = groups.get(groupName) || [];
      groups.set(groupName, [...existing, item]);
    });

    return Array.from(groups.entries()).map(([title, groupItems]) => ({
      title,
      items: groupItems,
    }));
  };

  // Filter items by search
  const filterItems = (groups: CommandGroup[]): CommandGroup[] => {
    if (!search.trim()) return groups;

    const query = search.toLowerCase();

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.subtitle?.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.toLowerCase().includes(query))
        ),
      }))
      .filter((group) => group.items.length > 0);
  };

  const groups = filterItems(normalizeItems());

  // Flatten for keyboard navigation
  const flatItems = groups.flatMap((g) => g.items.filter((i) => !i.disabled));

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const matchesMeta = shortcut.metaKey ? e.metaKey : true;
      const matchesCtrl = shortcut.ctrlKey ? e.ctrlKey : true;

      if (
        e.key.toLowerCase() === shortcut.key &&
        matchesMeta &&
        matchesCtrl &&
        !open
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, shortcut]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      // Small delay to ensure portal is mounted
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatItems.length > 0) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatItems.length]);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
        break;
      case "Enter":
        e.preventDefault();
        const selected = flatItems[selectedIndex];
        if (selected?.onSelect) {
          selected.onSelect();
          setOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const handleItemClick = (item: CommandItem) => {
    if (item.disabled) return;
    item.onSelect?.();
    setOpen(false);
  };

  if (!open) return null;

  // Track item index across groups for keyboard navigation
  let itemIndex = -1;

  const content = (
    <div
      // --z-modal (400), not a raw z-50. The scrim below is full-viewport and always
      // WAS — but at z-50 it lost to the sidebar's --z-sidebar (250), so the palette
      // dimmed <main> and the right rail while the left nav stayed at full contrast,
      // reading as chrome sitting on top of a modal. Measured before the fix:
      // elementFromPoint at the sidebar's own centre returned a sidebar <span>, not
      // the scrim, despite the overlay rect covering 0,0→1440,900.
      // The z-scale in globals.css is the contract every other modal here already
      // follows (dialog.tsx, delete-test-modal, AmbientOverviewSheet); this was the
      // one overlay still on a hardcoded value. Toast (500) and tooltip (600) still win.
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative w-full max-w-[640px] mx-4",
          // Flat-warm matte panel. This component predates the v5/v6 migration and
          // still carried the retired Raycast system: --rounding-lg, --shadow-elevated,
          // --color-bg-100, --color-grey-800/300/200 and an animate-scale-in that were
          // ALL undefined, so the panel rendered with no background, no radius and no
          // shadow — the page showed straight through it. It had never been mounted, so
          // nothing surfaced the rot until it was.
          "rounded-xl",
          "border border-white/[0.06]",
          "shadow-[0_16px_50px_rgba(0,0,0,0.5)]",
          "overflow-hidden",
          className
        )}
        // Solid tone — no backdrop blur. The glass panel was Raycast-era; the flat-warm
        // system is matte (docs/DESIGN-SYSTEM.md). The scrim behind still blurs.
        style={{ backgroundColor: "var(--color-charcoal-chip)", ...style }}
      >
        {/* Search input - Raycast style */}
        <div
          className="flex items-center gap-3 px-4 border-b border-white/5"
          style={{ backgroundColor: "var(--color-charcoal-composer)" }}
        >
          <MagnifyingGlass
            size={18}
            weight="bold"
            className="text-foreground-muted flex-shrink-0"
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent py-4",
              "text-reading text-foreground",
              "placeholder:text-foreground-muted",
              "outline-none border-none"
            )}
          />
          {/* Keyboard hint */}
          <kbd
            className={cn(
              "flex-shrink-0 px-1.5 py-0.5 rounded-xs",
              "text-caption font-medium text-foreground-muted",
              "border border-white/[0.06]",
              "bg-white/5"
            )}
          >
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-2"
          role="listbox"
        >
          {groups.length === 0 ? (
            <div className="px-4 py-8 text-center text-foreground-muted text-body">
              {emptyMessage}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="mb-2 last:mb-0">
                {/* Group header */}
                <div className="px-4 py-2 text-caption font-semibold uppercase tracking-wider text-foreground-muted">
                  {group.title}
                </div>

                {/* Group items */}
                {group.items.map((item) => {
                  if (!item.disabled) itemIndex++;
                  const isSelected = itemIndex === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={item.disabled}
                      data-index={itemIndex}
                      onClick={() => handleItemClick(item)}
                      onMouseEnter={() => {
                        if (!item.disabled) setSelectedIndex(itemIndex);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5",
                        "text-left transition-colors duration-75",
                        "focus:outline-none",
                        // Selected state
                        isSelected && !item.disabled && "bg-white/5",
                        // Disabled
                        item.disabled && "opacity-50 cursor-not-allowed",
                        !item.disabled && "cursor-pointer"
                      )}
                    >
                      {/* Icon */}
                      {item.icon && (
                        <span
                          className={cn(
                            "flex-shrink-0 w-8 h-8",
                            "flex items-center justify-center",
                            "rounded-md",
                            "text-foreground-secondary",
                            isSelected && "text-foreground"
                          )}
                          style={{
                            backgroundColor: isSelected
                              ? "rgba(255, 255, 255, 0.05)"
                              : "transparent",
                          }}
                        >
                          {item.icon}
                        </span>
                      )}

                      {/* Title & subtitle */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-body font-medium truncate",
                            isSelected
                              ? "text-foreground"
                              : "text-foreground-secondary"
                          )}
                        >
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-label text-foreground-muted truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Shortcut */}
                      {item.shortcut && (
                        <kbd
                          className={cn(
                            "flex-shrink-0 px-1.5 py-0.5 rounded-xs",
                            "text-caption font-medium text-foreground-muted",
                            "border border-white/[0.06]",
                            "bg-white/5"
                          )}
                        >
                          {item.shortcut}
                        </kbd>
                      )}

                      {/* Arrow indicator for selected */}
                      {isSelected && !item.disabled && (
                        <CaretRight
                          size={14}
                          weight="bold"
                          className="text-foreground-muted flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer with hints */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t border-white/5"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
        >
          <div className="flex items-center gap-3 text-caption text-foreground-muted">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-white/5 border border-white/[0.06]">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-white/5 border border-white/[0.06]">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <div className="flex items-center gap-1 text-caption text-foreground-muted">
            <Command size={12} weight="bold" />
            <span>Palette</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render in portal
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return null;
}
