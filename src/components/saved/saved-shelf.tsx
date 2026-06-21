"use client";

/**
 * SavedShelf — the flat, typed Saved surface (Plan 10-04 Task 3, SAVE-01).
 *
 * FLAT by construction (D-07): a heading + subtitle, an optional flat
 * type-filter chip row (client-side filter — NOT folders), a flat grid of
 * typed-item cards, and a calm empty state. NO folders, NO tags, NO collection
 * grouping (ROADMAP guard). P12 EXTENDS this shape; it never reworks it.
 *
 * Flat-warm SSOT throughout (10-UI-SPEC): cream text on charcoal, shelf grid
 * gap --spacing-6, card radius --radius-lg.
 */

import { useMemo, useState } from "react";
import { useSavedItems } from "@/hooks/queries/use-saved-items";
import type { SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import { SavedItemCard } from "./saved-item-card";

// Flat filter chips — a client-side item_type filter, NOT a folder structure.
const FILTERS: { id: SavedItemType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "read", label: "Reads" },
  { id: "idea", label: "Ideas" },
  { id: "hook", label: "Hooks" },
  { id: "script", label: "Scripts" },
  { id: "outlier", label: "Outliers" },
  { id: "format", label: "Formats" },
];

export function SavedShelf() {
  const [filter, setFilter] = useState<SavedItemType | "all">("all");
  // Fetch the full list once; filtering is a flat client-side concern.
  const { data, isLoading, isError } = useSavedItems();

  const visible = useMemo(() => {
    const items = data?.items ?? [];
    return filter === "all"
      ? items
      : items.filter((i) => i.item_type === filter);
  }, [data, filter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Library</h1>
        <p className="text-sm text-foreground-muted">
          Everything you&rsquo;ve saved — Reads, ideas, hooks, scripts, outliers
          — ready to pull back into a thread.
        </p>
      </header>

      {/* Flat type-filter chip row (client-side filter, NOT folders) */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter saved items by type">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                active
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground-secondary",
              )}
              style={{
                backgroundColor: active
                  ? "var(--color-charcoal-chip)"
                  : "transparent",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Body: loading / error / empty / grid */}
      {isLoading ? (
        <p className="text-sm text-foreground-muted">Loading your library…</p>
      ) : isError ? (
        <p className="text-sm text-foreground-muted">
          Couldn&rsquo;t load your library. Try again in a moment.
        </p>
      ) : visible.length === 0 ? (
        <EmptyState filtered={filter !== "all"} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <SavedItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Calm informational empty state — not an error (UI-SPEC §Honesty). */
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-white/[0.06] px-6 py-16 text-center">
      <p className="text-base font-semibold text-foreground">
        {filtered ? "Nothing of this type yet" : "Nothing in your Library yet"}
      </p>
      <p className="max-w-md text-sm text-foreground-muted">
        Save a Read, idea, hook, or outlier from any thread and it lands here —
        ready to pull back in.
      </p>
    </div>
  );
}
