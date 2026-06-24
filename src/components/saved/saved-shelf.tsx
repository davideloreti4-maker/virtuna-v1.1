"use client";

/**
 * SavedShelf — the flat, typed Saved surface (Plan 10-04 Task 3, SAVE-01).
 *
 * FLAT by construction (D-07): a heading + subtitle, an optional flat
 * type-filter row (client-side filter — NOT folders), a flat grid of
 * typed-item cards, and a calm empty state. NO folders, NO tags, NO collection
 * grouping (ROADMAP guard). P12 EXTENDS this shape; it never reworks it.
 *
 * Flat-warm SSOT throughout (10-UI-SPEC): cream text on charcoal, shelf grid
 * gap --spacing-6, card radius --radius-lg. Filter row is a segmented control
 * with client-derived per-type counts; loading is a branded skeleton grid;
 * empty state carries the Constellation motif + a neutral CTA (de-Claude P2).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSavedItems } from "@/hooks/queries/use-saved-items";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Constellation, buildLoadingDots } from "@/components/brand/constellation";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
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

  const items = useMemo<SavedItem[]>(() => data?.items ?? [], [data]);

  // Per-type counts (client-side presentation — no new query).
  const counts = useMemo(() => {
    const by: Record<string, number> = { all: items.length };
    for (const i of items) by[i.item_type] = (by[i.item_type] ?? 0) + 1;
    return by;
  }, [items]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.item_type === filter)),
    [items, filter],
  );

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

      {/* Flat type-filter — a segmented control (client-side filter, NOT folders) */}
      <div
        className="flex flex-wrap gap-1 self-start rounded-[var(--radius-md)] p-1"
        style={{ backgroundColor: "var(--color-charcoal-chip)" }}
        role="tablist"
        aria-label="Filter saved items by type"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10",
                active
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground-secondary",
              )}
              style={{
                backgroundColor: active ? "var(--color-charcoal-composer)" : "transparent",
                boxShadow: active ? "rgba(255,255,255,0.05) 0 1px 0 0 inset" : undefined,
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={cn(
                    "tabular-nums text-[11px]",
                    active ? "text-foreground-secondary" : "text-foreground-muted/70",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body: loading / error / empty / grid */}
      {isLoading ? (
        <SavedShelfSkeleton />
      ) : isError ? (
        <p className="text-sm text-foreground-muted">
          Couldn&rsquo;t load your library. Try again in a moment.
        </p>
      ) : visible.length === 0 ? (
        <EmptyState filtered={filter !== "all"} onClearFilter={() => setFilter("all")} />
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

/** Branded skeleton grid — mirrors the real card layout (P2 reuses P0's pattern). */
function SavedShelfSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
      data-testid="saved-shelf-skeleton"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-white/[0.06] p-4"
          style={{ backgroundColor: "var(--color-charcoal-composer)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-14 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-[90%] rounded-md" />
            <Skeleton className="h-4 w-[60%] rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Calm informational empty state — not an error (UI-SPEC §Honesty). */
function EmptyState({
  filtered,
  onClearFilter,
}: {
  filtered: boolean;
  onClearFilter: () => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const dots = useMemo(() => buildLoadingDots(120, 32, 8), []);

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-[var(--radius-lg)] border border-white/[0.06] px-6 py-16 text-center">
      <Constellation
        dots={dots}
        reducedMotion={reducedMotion}
        width={140}
        height={38}
        vbW={120}
        vbH={32}
        ariaLabel="Your library is waiting"
      />
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-foreground">
          {filtered ? "Nothing of this type yet" : "Nothing in your Library yet"}
        </p>
        <p className="max-w-md text-sm text-foreground-muted">
          {filtered
            ? "Try another type, or run a Simulation to start filling this shelf."
            : "Save a Read, idea, hook, or outlier from any thread and it lands here — ready to pull back in."}
        </p>
      </div>
      {filtered ? (
        <Button variant="secondary" onClick={onClearFilter}>
          Show all
        </Button>
      ) : (
        <Button variant="primary" onClick={() => router.push("/home")}>
          Start a Simulation
        </Button>
      )}
    </div>
  );
}
