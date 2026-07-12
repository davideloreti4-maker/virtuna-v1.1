"use client";

/**
 * HooksClient — Discover Feed Hooks vault orchestrator for /feed/hooks (UI-refinement).
 *
 * A third Feed view: a searchable, sortable vault of viral hook templates. Two sections —
 * "Hooks from your analyzed videos" (populated by the Phase-3 analyze pipeline; an honest
 * empty state until then) and "Default hooks" (the curated default-hooks seed). The
 * "Showing format" toggle swaps the bracketed template for a filled example; the heart
 * favorites a hook (persisted to localStorage). "Create from video" points at the Videos
 * tab's Remix → Read flow — the vault keeps our moat verb, not Sandcastles' "Analyze".
 *
 * Flat-warm matte; the favorite heart is the surface's one accent (terracotta).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FilmSlate, DownloadSimple, CaretDown, MagnifyingGlass, ArrowRight } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DiscoverTabBar } from "@/components/discover/discover-tab-bar";
import { HookRow } from "@/components/feed/hook-row";
import { DEFAULT_HOOKS, type DefaultHook } from "@/lib/hooks/default-hooks";
import { cn } from "@/lib/utils";

type HookSort = "outlier" | "views" | "category";
const SORT_OPTIONS: { value: HookSort; label: string }[] = [
  { value: "outlier", label: "Biggest outlier" },
  { value: "views", label: "Most viewed" },
  { value: "category", label: "Category" },
];

const FAVORITES_KEY = "feed:hookFavorites";

/** Serialize the visible default hooks to CSV for Export (RFC-4180-ish quoting). */
function toCsv(hooks: DefaultHook[]): string {
  const header = ["template", "category", "inspired_by", "outlier_multiplier", "views"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = hooks.map((h) => [h.template, h.category, h.inspiredBy, h.multiplier, h.views]);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function HooksClient() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<HookSort>("outlier");
  const [showTemplate, setShowTemplate] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites after mount (a lazy initializer would mismatch SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFavorites(new Set(JSON.parse(raw) as string[]));
      }
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? DEFAULT_HOOKS.filter(
          (h) =>
            h.template.toLowerCase().includes(needle) ||
            h.example.toLowerCase().includes(needle) ||
            h.inspiredBy.toLowerCase().includes(needle) ||
            h.category.toLowerCase().includes(needle),
        )
      : DEFAULT_HOOKS;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "views") return b.views - a.views;
      if (sort === "category") return a.category.localeCompare(b.category);
      return b.multiplier - a.multiplier;
    });
    return sorted;
  }, [q, sort]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";

  const handleExport = useCallback(() => {
    if (visible.length === 0 || typeof document === "undefined") return;
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hooks-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [visible]);

  return (
    // Container + header mirror DiscoverHub exactly (title → mono subtitle → tabs)
    // so the tab bar doesn't jump position when switching Discover tabs.
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
      <header className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Hooks</h1>
        <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
          your vault of viral hooks — adapt any one into a script for your audience
        </p>

        <div className="mt-3">
          <DiscoverTabBar active="hooks" />
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="min-w-0 max-w-sm flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by hook or channel"
              leftIcon={<MagnifyingGlass size={16} />}
              aria-label="Search hooks"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <FilmSlate size={14} aria-hidden="true" />
                Create from video
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-2">
              <p className="text-sm font-medium text-foreground">Create a hook from a video</p>
              <p className="text-xs text-foreground-muted">
                Auto-extracting hooks from your analyzed videos is coming soon. For now, Remix a
                video into a Read from the Videos tab.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-1 w-full">
                <Link href="/feed">
                  Go to Videos
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          {/* Showing-format toggle: template (brackets) ⇄ filled example. */}
          <button
            type="button"
            role="switch"
            aria-checked={showTemplate}
            onClick={() => setShowTemplate((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium",
              "text-foreground-secondary hover:bg-white/[0.03] hover:text-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
            )}
            title={showTemplate ? "Showing templates" : "Showing examples"}
          >
            Format
            <span
              className={cn(
                "relative h-4 w-7 rounded-full transition-colors",
                showTemplate ? "bg-white/25" : "bg-white/10",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-foreground transition-all",
                  showTemplate ? "left-3.5" : "left-0.5",
                )}
              />
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                Sort: {sortLabel}
                <CaretDown size={14} weight="bold" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as HookSort)}>
                {SORT_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" size="sm" onClick={handleExport} disabled={visible.length === 0}>
            <DownloadSimple size={14} aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>

      {/* "From your analyzed videos" placeholder removed until the analyze pipeline
          lands — a permanently-empty dashed box above the vault pushed the real
          content below the fold; the Create-from-video popover carries the
          coming-soon note. */}

      {/* Default hooks. */}
      <section className="mt-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          Default hooks · {visible.length}
        </h2>
        {visible.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] px-4 py-8 text-center text-sm text-foreground-muted">
            No hooks match “{q}”.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((h) => (
              <HookRow
                key={h.id}
                hook={h}
                showTemplate={showTemplate}
                favorite={favorites.has(h.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
