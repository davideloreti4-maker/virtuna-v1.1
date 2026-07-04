"use client";

/**
 * FeedFilters — the Videos feed filter sidebar (Discover Feed Phase 2.2, UI-refinement).
 *
 * Sandcastles-style ranges over the columns Phase 1.1/2.1 store: each numeric control is
 * a min–max pair that maps to gte/lte WHEREs on GET /api/feed. Tab-aware: the outlier
 * range and per-channel narrowing only show on the WATCHED tab — trending rows carry no
 * outlier_multiplier (it stays NULL until a per-niche recompute job), so an outlier filter
 * there would empty the grid (the route filters its sort/where column NOT NULL).
 *
 * The numeric inputs hold local draft strings and patch the feed args on a shared debounce
 * (no refetch per keystroke); keyword search keeps its own debounce. Engagement is entered
 * as a percent and converted to the stored ratio. "Status" (Analyzed / Unanalyzed) is
 * rendered for parity but does not filter yet — we don't track an analyzed flag until the
 * analyze pipeline lands (shown honestly as "coming soon"). Flat-warm matte — active state
 * = white/[0.08], no coral (the feed's one accent lives on the tile's Remix CTA).
 */
import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, BookmarkSimple } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  /** Merge a partial filter change (ranges patch on a debounce; q debounces internally). */
  onPatch: (patch: Partial<FeedFilterState>) => void;
  onClear: () => void;
  /** The user's watched channels (watched tab only) — drives the narrowing chips. */
  watchedChannels: WatchedChannelOption[];
  /** Whether any filter is currently applied (enables the Clear action). */
  activeCount: number;
  /** Persist the current filters to localStorage. */
  onSaveFilter: () => void;
  /** Re-apply the saved filters (no-op if none). */
  onRestoreFilter: () => void;
  /** Whether a saved filter exists (drives the Restore affordance). */
  savedFilterExists: boolean;
}

const PLATFORM_OPTIONS = [
  { value: "all", label: "All platforms" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

const POSTED_UNITS = [
  { value: "1", label: "Days" },
  { value: "7", label: "Weeks" },
  { value: "30", label: "Months" },
];

/** Parse a (possibly comma-grouped) numeric string → number | undefined. */
function toNum(s: string): number | undefined {
  const n = parseFloat((s ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}
const numStr = (n: number | undefined) => (n != null ? String(n) : "");
const pctStr = (r: number | undefined) => (r != null ? String(Math.round(r * 100)) : "");
const pctToRatio = (s: string) => {
  const n = toNum(s);
  return n == null ? undefined : n / 100;
};

/** A min–max numeric pair (e.g. Views 0 – 10,000,000). */
function RangeRow({
  label,
  minVal,
  maxVal,
  onMin,
  onMax,
  minPlaceholder,
  maxPlaceholder,
}: {
  label: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          inputMode="decimal"
          value={minVal}
          onChange={(e) => onMin(e.target.value)}
          placeholder={minPlaceholder}
          aria-label={`${label} minimum`}
          className="tabular-nums"
        />
        <span className="shrink-0 text-foreground-muted">–</span>
        <Input
          size="sm"
          inputMode="decimal"
          value={maxVal}
          onChange={(e) => onMax(e.target.value)}
          placeholder={maxPlaceholder}
          aria-label={`${label} maximum`}
          className="tabular-nums"
        />
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
  onSaveFilter,
  onRestoreFilter,
  savedFilterExists,
}: FeedFiltersProps) {
  // Keyword search owns its debounce; only the settled value patches the feed args.
  const [q, setQ] = useState(filters.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => onPatch({ q: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on q only; onPatch is stable
  }, [q]);

  // Numeric ranges live as local draft strings (init from props so a Restore/Clear remount
  // re-seeds them), patched to the feed args on a shared debounce.
  const [outlierMin, setOutlierMin] = useState(numStr(filters.minOutlier));
  const [outlierMax, setOutlierMax] = useState(numStr(filters.maxOutlier));
  const [viewsMin, setViewsMin] = useState(numStr(filters.minViews));
  const [viewsMax, setViewsMax] = useState(numStr(filters.maxViews));
  const [engMin, setEngMin] = useState(pctStr(filters.minEngagement));
  const [engMax, setEngMax] = useState(pctStr(filters.maxEngagement));
  const [postedValue, setPostedValue] = useState(numStr(filters.postedWithinDays));
  const [postedUnit, setPostedUnit] = useState("1");

  useEffect(() => {
    const t = setTimeout(() => {
      const v = toNum(postedValue);
      const days = v != null && v > 0 ? Math.round(v * Number(postedUnit)) : undefined;
      onPatch({
        minOutlier: tab === "watched" ? toNum(outlierMin) : undefined,
        maxOutlier: tab === "watched" ? toNum(outlierMax) : undefined,
        minViews: toNum(viewsMin),
        maxViews: toNum(viewsMax),
        minEngagement: pctToRatio(engMin),
        maxEngagement: pctToRatio(engMax),
        postedWithinDays: days,
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on drafts/tab; onPatch is stable
  }, [outlierMin, outlierMax, viewsMin, viewsMax, engMin, engMax, postedValue, postedUnit, tab]);

  const toggleChannel = (handle: string) => {
    const current = filters.channels ?? [];
    const next = current.includes(handle)
      ? current.filter((h) => h !== handle)
      : [...current, handle];
    onPatch({ channels: next.length > 0 ? next : undefined });
  };

  const platformValue = useMemo(() => filters.platform ?? "all", [filters.platform]);

  return (
    <aside className="elev-rest space-y-5 rounded-xl border border-white/[0.06] bg-background-elevated p-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      {/* Outlier range — watched only (trending rows have no outlier_multiplier). */}
      {tab === "watched" && (
        <RangeRow
          label="Outlier score"
          minVal={outlierMin}
          maxVal={outlierMax}
          onMin={setOutlierMin}
          onMax={setOutlierMax}
          minPlaceholder="0×"
          maxPlaceholder="100×"
        />
      )}

      <RangeRow
        label="Views"
        minVal={viewsMin}
        maxVal={viewsMax}
        onMin={setViewsMin}
        onMax={setViewsMax}
        minPlaceholder="0"
        maxPlaceholder="10,000,000"
      />

      <RangeRow
        label="Engagement"
        minVal={engMin}
        maxVal={engMax}
        onMin={setEngMin}
        onMax={setEngMax}
        minPlaceholder="0%"
        maxPlaceholder="100%"
      />

      {/* Posted in last — value + unit (Days / Weeks / Months) → postedWithinDays. */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          Posted in last
        </p>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            inputMode="numeric"
            value={postedValue}
            onChange={(e) => setPostedValue(e.target.value)}
            placeholder="0"
            aria-label="Posted in last (amount)"
            className="w-20 shrink-0 tabular-nums"
          />
          <div className="flex-1">
            <Select size="sm" options={POSTED_UNITS} value={postedUnit} onChange={setPostedUnit} />
          </div>
        </div>
      </div>

      {/* Platform — omitted (All) = no platform filter. */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          Platform
        </p>
        <Select
          size="sm"
          options={PLATFORM_OPTIONS}
          value={platformValue}
          onChange={(v) => onPatch({ platform: v === "all" ? undefined : v })}
        />
      </div>

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

      {/* Save / restore filters (localStorage). */}
      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={onSaveFilter}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium",
            "text-foreground-secondary hover:bg-white/[0.03] hover:text-foreground transition-colors",
            focusRing,
          )}
        >
          <BookmarkSimple size={14} />
          Save filter
        </button>
        {savedFilterExists && (
          <button
            type="button"
            onClick={onRestoreFilter}
            className={cn(
              "w-full rounded text-center text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors",
              focusRing,
            )}
          >
            Restore saved filter
          </button>
        )}
      </div>
    </aside>
  );
}
