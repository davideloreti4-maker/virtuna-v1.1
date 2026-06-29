"use client";

/**
 * FeedToolbar — the Videos feed control bar (Discover Feed Phase 2.2).
 *
 * Left: the Watched | Trending tab switch (drives which corpus the feed reads).
 * Right: a total-count readout, Sort menu (tab-aware options), "Add video URL"
 * (a popover that launches the Remix → Read chain on a one-off URL — the same moat
 * action as a tile's Remix), "Customize channels" (→ /feed/channels), and Export.
 *
 * Flat-warm matte: the tabs use the shared pill Tabs; every button is secondary chrome.
 * No coral here — the feed's single accent lives on each tile's Remix CTA.
 */
import { useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  Plus,
  Faders,
  FunnelSimple,
  DownloadSimple,
  LinkSimple,
} from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { FeedTab, FeedSort } from "@/lib/feed/feed-query";

export interface SortOption {
  value: FeedSort;
  label: string;
}

interface FeedToolbarProps {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  sort: FeedSort;
  onSortChange: (sort: FeedSort) => void;
  sortOptions: SortOption[];
  total: number;
  /** How many tiles are currently loaded (for "Showing N of {total}"). */
  loaded: number;
  /** Whether the filter sidebar is shown (the toggle is filled when open). */
  filtersOpen: boolean;
  onToggleFilters: () => void;
  /** Number of active filters (badge on the toggle). */
  activeFilterCount: number;
  /** Launch the Remix → Read chain on a pasted one-off URL. */
  onAddVideoUrl: (url: string) => void;
  addVideoPending: boolean;
  /** Export the currently-loaded tiles to CSV. */
  onExport: () => void;
  exportDisabled: boolean;
}

export function FeedToolbar({
  tab,
  onTabChange,
  sort,
  onSortChange,
  sortOptions,
  total,
  loaded,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  onAddVideoUrl,
  addVideoPending,
  onExport,
  exportDisabled,
}: FeedToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState("");

  const sortLabel = sortOptions.find((o) => o.value === sort)?.label ?? "Sort";

  const submitUrl = () => {
    const v = url.trim();
    if (!v) return;
    onAddVideoUrl(v);
    setUrl("");
    setAddOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Tab switch — Watched | Trending */}
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as FeedTab)}>
        <TabsList>
          <TabsTrigger value="watched" size="sm">
            Watched
          </TabsTrigger>
          <TabsTrigger value="trending" size="sm">
            Trending
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        {total > 0 && (
          <span className="mr-1 text-xs text-foreground-muted tabular-nums">
            Showing {loaded.toLocaleString()} of {total.toLocaleString()}
          </span>
        )}

        {/* Filters toggle — filled when open; badge shows the active-filter count. */}
        <button
          type="button"
          onClick={onToggleFilters}
          aria-pressed={filtersOpen}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
            filtersOpen
              ? "border-white/[0.12] bg-white/[0.08] text-foreground"
              : "border-white/[0.06] text-foreground-secondary hover:bg-white/[0.03] hover:text-foreground",
          )}
        >
          <FunnelSimple size={14} weight={filtersOpen ? "fill" : "regular"} aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/[0.12] px-1 text-[10px] tabular-nums text-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort menu — options are tab-aware (no outlier sort on trending). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Sort: {sortLabel}
              <CaretDown size={14} weight="bold" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[11rem]">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => onSortChange(v as FeedSort)}
            >
              {sortOptions.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" aria-hidden="true" />

        {/* Add video URL — launches Remix → Read on a one-off link. */}
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus size={14} weight="bold" aria-hidden="true" />
              Add video URL
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-2">
            <p className="text-sm font-medium text-foreground">Remix a video URL</p>
            <p className="text-xs text-foreground-muted">
              Paste any TikTok URL to adapt it for your audience — drops a Read into your
              thread.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitUrl();
                }}
                placeholder="Paste a TikTok video URL"
                leftIcon={<LinkSimple size={16} />}
                aria-label="Video URL to remix"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={submitUrl}
                loading={addVideoPending}
                disabled={url.trim().length === 0}
                className="shrink-0"
              >
                Remix
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button asChild variant="secondary" size="sm">
          <Link href="/feed/channels">
            <Faders size={14} aria-hidden="true" />
            Customize channels
          </Link>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          disabled={exportDisabled}
        >
          <DownloadSimple size={14} aria-hidden="true" />
          Export
        </Button>
      </div>
    </div>
  );
}
