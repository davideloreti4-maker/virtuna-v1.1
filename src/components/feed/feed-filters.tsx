"use client";

/**
 * FeedFilters — the Videos feed filter sidebar (Discover Feed Phase 2.2).
 *
 * Plain chip groups over the columns Phase 1.1/2.1 store, so each control maps to a
 * single WHERE on GET /api/feed. Tab-aware: the outlier-multiplier filter and the
 * per-channel narrowing only appear on the WATCHED tab — trending rows carry no
 * outlier_multiplier (it stays NULL until a per-niche recompute job), so a minOutlier
 * filter there would empty the grid (the route filters its sort/where column NOT NULL).
 *
 * Keyword search owns its own debounce (mirrors the Channels search tab) and reports the
 * settled value up via onPatch({ q }); every other chip patches immediately. Flat-warm
 * matte — active chip = white/[0.08], no coral anywhere (the feed's one accent lives on
 * the tile's Remix CTA).
 */
import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FeedFilterState } from "@/hooks/queries/use-feed";
import type { FeedTab } from "@/lib/feed/feed-query";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10";

/** A watched-channel option for the per-channel narrowing chips. */
export interface WatchedChannelOption {
  handle: string;
  label: string;
}

interface FeedFiltersProps {
  tab: FeedTab;
  filters: FeedFilterState;
  /** Merge a partial filter change (chips patch immediately; q is debounced internally). */
  onPatch: (patch: Partial<FeedFilterState>) => void;
  onClear: () => void;
  /** The user's watched channels (watched tab only) — drives the narrowing chips. */
  watchedChannels: WatchedChannelOption[];
  /** Whether any filter is currently applied (enables the Clear action). */
  activeCount: number;
}

interface ChipOption {
  label: string;
  /** undefined = "Any" (clears the filter). */
  value: number | undefined;
}

const OUTLIER_OPTIONS: ChipOption[] = [
  { label: "Any", value: undefined },
  { label: "2×+", value: 2 },
  { label: "3×+", value: 3 },
  { label: "5×+", value: 5 },
  { label: "10×+", value: 10 },
];

const VIEWS_OPTIONS: ChipOption[] = [
  { label: "Any", value: undefined },
  { label: "100K+", value: 100_000 },
  { label: "1M+", value: 1_000_000 },
  { label: "10M+", value: 10_000_000 },
];

// engagement_rate is stored as a ratio ((likes+comments+shares)/views) → 5% = 0.05.
const ENGAGEMENT_OPTIONS: ChipOption[] = [
  { label: "Any", value: undefined },
  { label: "5%+", value: 0.05 },
  { label: "10%+", value: 0.1 },
  { label: "20%+", value: 0.2 },
];

const POSTED_OPTIONS: ChipOption[] = [
  { label: "Any", value: undefined },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "1 year", value: 365 },
];

/** A single-select chip row — `selected === value` is active; clicking re-selects/clears. */
function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ChipOption[];
  selected: number | undefined;
  onSelect: (value: number | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                focusRing,
                active
                  ? "bg-white/[0.08] text-foreground"
                  : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FeedFilters({
  tab,
  filters,
  onPatch,
  onClear,
  watchedChannels,
  activeCount,
}: FeedFiltersProps) {
  // Keyword search owns its debounce; only the settled value patches the feed args.
  const [q, setQ] = useState(filters.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => onPatch({ q: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on q only; onPatch is stable
  }, [q]);

  const toggleChannel = (handle: string) => {
    const current = filters.channels ?? [];
    const next = current.includes(handle)
      ? current.filter((h) => h !== handle)
      : [...current, handle];
    onPatch({ channels: next.length > 0 ? next : undefined });
  };

  return (
    <aside className="space-y-5 rounded-xl border border-white/[0.06] bg-background-elevated p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "rounded text-xs font-medium text-foreground-muted hover:text-foreground transition-colors",
              focusRing,
            )}
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search captions"
        leftIcon={<MagnifyingGlass size={16} />}
        aria-label="Search captions"
      />

      {/* Outlier multiplier — watched only (trending rows have no outlier_multiplier). */}
      {tab === "watched" && (
        <ChipRow
          label="Outlier"
          options={OUTLIER_OPTIONS}
          selected={filters.minOutlier}
          onSelect={(v) => onPatch({ minOutlier: v })}
        />
      )}

      <ChipRow
        label="Views"
        options={VIEWS_OPTIONS}
        selected={filters.minViews}
        onSelect={(v) => onPatch({ minViews: v })}
      />

      <ChipRow
        label="Engagement"
        options={ENGAGEMENT_OPTIONS}
        selected={filters.minEngagement}
        onSelect={(v) => onPatch({ minEngagement: v })}
      />

      <ChipRow
        label="Posted within"
        options={POSTED_OPTIONS}
        selected={filters.postedWithinDays}
        onSelect={(v) => onPatch({ postedWithinDays: v })}
      />

      {/* Per-channel narrowing — watched tab only (your tracked creators). */}
      {tab === "watched" && watchedChannels.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            Channels
          </p>
          <div className="flex flex-wrap gap-1.5">
            {watchedChannels.map((c) => {
              const active = (filters.channels ?? []).includes(c.handle);
              return (
                <button
                  key={c.handle}
                  type="button"
                  onClick={() => toggleChannel(c.handle)}
                  aria-pressed={active}
                  className={cn(
                    "max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    focusRing,
                    active
                      ? "bg-white/[0.08] text-foreground"
                      : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
                  )}
                  title={c.label}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
