"use client";

/**
 * SavedShelf — the flat, typed Library surface (lane/frame elevation of P10/P12 SAVE-01).
 *
 * FLAT by construction (D-07, ROADMAP guard): a heading + count, a toolbar (live search · sort ·
 * grid⇄list density), a flat type-filter segmented control, and a masonry grid (or list) of
 * type-specific cards that echo their thread card. NO folders, NO tags, NO collection grouping.
 *
 * Flat-warm SSOT throughout: cream on charcoal, 6% borders, 12px card radius; band tones are the
 * only color (sanctioned data tones, via the cards); terracotta stays liveness-only. Loading is a
 * branded skeleton grid; empty state carries the Constellation motif + a neutral CTA.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, SquaresFour, ListBullets } from "@phosphor-icons/react";
import { useSavedItems } from "@/hooks/queries/use-saved-items";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Constellation, buildLoadingDots } from "@/components/brand/constellation";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SavedItemCard } from "./saved-item-card";

// Flat type filter — a client-side item_type filter, NOT a folder structure.
const FILTERS: { id: SavedItemType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "read", label: "Reads" },
  { id: "idea", label: "Ideas" },
  { id: "hook", label: "Hooks" },
  { id: "script", label: "Scripts" },
  { id: "outlier", label: "Outliers" },
  { id: "format", label: "Formats" },
];

type SortKey = "recent" | "oldest" | "az";
type View = "grid" | "list";

/** Flatten an item's human-meaningful snapshot text into a search index (client-side). */
function searchText(item: SavedItem): string {
  const snap = item.snapshot ?? {};
  const parts: (string | null)[] = [item.title];
  for (const k of ["hookLine", "title", "mechanism", "angle", "whyItFits", "caption", "openingBeatSeed"]) {
    if (typeof snap[k] === "string") parts.push(snap[k] as string);
  }
  if (Array.isArray(snap.audiences)) {
    for (const a of snap.audiences as Record<string, unknown>[]) {
      for (const k of ["name", "interpretation", "lever"]) {
        if (typeof a[k] === "string") parts.push(a[k] as string);
      }
    }
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function SavedShelf() {
  const [filter, setFilter] = useState<SavedItemType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<View>("grid");
  const { data, isLoading, isError } = useSavedItems();

  const items = useMemo<SavedItem[]>(() => data?.items ?? [], [data]);

  // Per-type counts (client-side presentation — no new query).
  const counts = useMemo(() => {
    const by: Record<string, number> = { all: items.length };
    for (const i of items) by[i.item_type] = (by[i.item_type] ?? 0) + 1;
    return by;
  }, [items]);

  const visible = useMemo(() => {
    let v = filter === "all" ? items : items.filter((i) => i.item_type === filter);
    const q = query.trim().toLowerCase();
    if (q) v = v.filter((i) => searchText(i).includes(q));
    return [...v].sort((a, b) => {
      if (sort === "az") return (a.title ?? "").localeCompare(b.title ?? "");
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
  }, [items, filter, query, sort]);

  const isFiltered = filter !== "all" || query.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="rv-in flex items-start justify-between gap-4" style={{ animationDelay: "0.02s" }}>
        <div className="flex flex-col gap-1">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Library</h1>
        </div>
        {items.length > 0 && (
          <span className="shrink-0 rounded-full border border-white/[0.06] bg-surface-elevated px-3 py-1 text-xs text-foreground-muted">
            <b className="font-semibold tabular-nums text-foreground-secondary">{items.length}</b> saved
          </span>
        )}
      </header>

      {/* Toolbar — live search + sort + grid⇄list density toggle */}
      <div className="rv-in flex flex-wrap items-center gap-3" style={{ animationDelay: "0.06s" }}>
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library…"
            aria-label="Search saved items"
            className="h-9 w-full rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-elevated pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-white/[0.10] focus:outline-none"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="library-sort" className="sr-only">
            Sort
          </label>
          <select
            id="library-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 cursor-pointer rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-elevated px-3 text-sm text-foreground-secondary focus:border-white/[0.10] focus:outline-none"
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
          </select>
          <div
            className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-elevated p-0.5"
            role="group"
            aria-label="View"
          >
            {([
              ["grid", SquaresFour, "Grid"],
              ["list", ListBullets, "List"],
            ] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                aria-label={`${label} view`}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] transition-colors",
                  view === v
                    ? "bg-surface text-foreground"
                    : "text-foreground-muted hover:text-foreground-secondary",
                )}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flat type-filter — a segmented control (client-side filter, NOT folders) */}
      <div
        className="rv-in flex flex-wrap gap-1 self-start rounded-[var(--radius-md)] p-1"
        style={{ backgroundColor: "var(--color-charcoal-chip)", animationDelay: "0.09s" }}
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
                active ? "text-foreground" : "text-foreground-muted hover:text-foreground-secondary",
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

      {/* Body: loading / error / empty / grid / list */}
      <div className="rv-in" style={{ animationDelay: "0.12s" }}>
      {isLoading ? (
        <SavedShelfSkeleton />
      ) : isError ? (
        <p className="text-sm text-foreground-muted">
          Couldn&rsquo;t load your library. Try again in a moment.
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          filtered={isFiltered}
          onClear={() => {
            setFilter("all");
            setQuery("");
          }}
        />
      ) : view === "grid" ? (
        // Masonry — packs mixed-height cards tight (CSS multicol; no row-locked gaps).
        <div className="columns-1 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
          {visible.map((item) => (
            <div key={item.id} className="mb-4 break-inside-avoid">
              <SavedItemCard item={item} variant="card" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-surface">
          {visible.map((item) => (
            <SavedItemCard key={item.id} item={item} variant="row" />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/** Branded skeleton grid — mirrors the real card layout. */
function SavedShelfSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
            <Skeleton className="h-5 w-24 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-[90%] rounded-md" />
            <Skeleton className="h-4 w-[60%] rounded-md" />
          </div>
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

/** Calm informational empty state — not an error. */
function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const dots = useMemo(() => buildLoadingDots(120, 32, 8), []);

  return (
    <SurfaceEmptyState
      icon={
        <Constellation
          dots={dots}
          reducedMotion={reducedMotion}
          width={140}
          height={38}
          vbW={120}
          vbH={32}
          ariaLabel="Your library is waiting"
        />
      }
      title={filtered ? "Nothing matches" : "Nothing in your Library yet"}
      action={
        filtered ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button variant="primary" onClick={() => router.push("/home")}>
            Start a Simulation
          </Button>
        )
      }
    >
      {filtered
        ? "Try another type or clear your search."
        : "Save a Read, idea, hook, or outlier from any thread and it lands here — ready to pull back in."}
    </SurfaceEmptyState>
  );
}
