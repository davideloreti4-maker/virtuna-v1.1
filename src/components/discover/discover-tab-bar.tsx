"use client";

/**
 * DiscoverTabBar — the hub's one secondary nav: Outliers · Collections · Watchlist.
 *
 * It replaced a six-tab bar split into "content" and "tool" halves by a divider. That split
 * is gone because the tools were not peers of the content: Hooks was a vault of 12 hardcoded
 * templates, Channels configured the same sources Competitors did, and Pull was a whole tab
 * for one text input — now the hub's search field. The old tool tabs were also separate PAGES
 * that each re-rendered this bar with a mono subtitle the hub lacked, so the tab bar moved
 * 16px down and the h1 changed identity on every crossing; three source comments claimed the
 * opposite ("so the tab bar doesn't jump position").
 *
 * All three tabs switch in place — no navigation, so no jump is possible by construction.
 */

import { cn } from "@/lib/utils";

export type DiscoverTab = "outliers" | "collections" | "watchlist";

const TABS: { id: DiscoverTab; label: string }[] = [
  { id: "outliers", label: "Outliers" },
  { id: "collections", label: "Collections" },
  { id: "watchlist", label: "Watchlist" },
];

/**
 * ⚠️ No counts. The bar used to render one beside every label, and the header a
 * "230 proven outliers · 105 collections · 408 creators" line above it — the owner's call
 * (2026-08-04) is that the tally is noise on arrival, not information: it prices the library
 * before you have asked it anything, and it made three numbers compete with the one control
 * that matters, the search field. What is behind a tab is shown by opening it.
 */
export function DiscoverTabBar({
  active,
  onSelect,
}: {
  active: DiscoverTab;
  onSelect: (id: DiscoverTab) => void;
}) {
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="inline-flex w-max items-center rounded-lg border border-border bg-surface-elevated p-0.5"
        role="tablist"
        aria-label="Discover sections"
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-label font-medium transition-colors",
                isActive
                  ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                  : "text-foreground-secondary hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
