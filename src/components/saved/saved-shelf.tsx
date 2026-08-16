"use client";

/**
 * SavedShelf — the Library surface (sketch rev 5, public/_sketch-library-v5.html).
 *
 * A collection, not an inventory. Projects on top, then the Unfiled shelf with its type facets,
 * then borderless rows. Replaces the P10/P12 flat masonry shelf.
 *
 * Why the grid went, measured live signed in rather than argued:
 *  - `columns-1 sm:columns-2 lg:columns-3 xl:columns-4` inside the 880px PageShell gave each card
 *    **196px**, so every hook truncated mid-sentence and the segment chips rendered "Sleep-…",
 *    "T…", "St…", "Open…".
 *  - CSS multicol fills column-by-column, so it broke its own sort: reading the live shelf
 *    left-to-right gave Jul 28 → Jun 26 → Jun 24 → Jun 21 → **Jun 29**.
 *
 * D-07 ("FLAT by construction") is not violated — it is EXTENDED, which is the path
 * 20260619100200_saved_items.sql itself sanctioned. `saved_items` is still one flat table; a
 * project is a nullable `project_id`, and NULL (the value every pre-existing row has) means
 * Unfiled. There are no tags and no nesting.
 *
 * §R5-3 UNFILED STAYS VISIBLE once projects exist. It is the inbox you are meant to clear, so
 * collapsing it behind a toggle would hide the work the rework exists to make easy. The label is
 * omitted entirely when there are no projects — "Unfiled" means nothing when nothing is filed.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretRight, FolderSimple, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useSavedItems, useDeleteSavedItem, useFileSavedItems } from "@/hooks/queries/use-saved-items";
import { useLibraryProjects, useProjectRollups, rollupFor } from "@/hooks/queries/use-library-projects";
import { useThreadList } from "@/hooks/queries/use-threads";
import { useOpenThread } from "@/hooks/useOpenThread";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import { SurfaceHeader } from "@/components/surfaces/surface-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Constellation, buildLoadingDots } from "@/components/brand/constellation";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SavedRow } from "./saved-row";
import { ProjectPickerPopover } from "./project-picker";
import { FORWARD, PIPELINE_ORDER, TYPE_PLURAL, buildRowVM } from "./saved-item-vm";

type SortKey = "recent" | "oldest" | "az";

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

/** "2 hooks · 1 script · 1 read" — pipeline order, so a project always reads the same way. */
export function describeCounts(byType: Partial<Record<SavedItemType, number>>): string {
  return PIPELINE_ORDER.filter((t) => (byType[t] ?? 0) > 0)
    .map((t) => {
      const n = byType[t]!;
      const label = n === 1 ? TYPE_PLURAL[t].replace(/e?s$/, "") : TYPE_PLURAL[t];
      return `${n} ${label.toLowerCase()}`;
    })
    .join(" · ");
}

function relativeStamp(iso: string | null): string {
  if (!iso) return "empty";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SavedShelf() {
  const router = useRouter();
  const { toast } = useToast();
  const openThread = useOpenThread();

  const { data, isLoading, isError } = useSavedItems();
  const { data: projectData } = useLibraryProjects();
  const { data: threads } = useThreadList();
  const remove = useDeleteSavedItem();
  const file = useFileSavedItems();

  const [filter, setFilter] = useState<SavedItemType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moveAnchor, setMoveAnchor] = useState<HTMLButtonElement | null>(null);

  const items = useMemo<SavedItem[]>(() => data?.items ?? [], [data]);
  const projects = useMemo(() => projectData?.projects ?? [], [projectData]);
  const rollups = useProjectRollups(items);

  /** thread_id → title, from the query the sidebar has already populated. */
  const threadTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of threads ?? []) if (t.title) map.set(t.id, t.title);
    return map;
  }, [threads]);

  const projectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  /**
   * The row's source label. A real thread title when we have one; "Discover" for an outlier,
   * which genuinely comes from there and never from a thread. Otherwise nothing — the ten rows
   * that predate provenance have no thread_id, and inventing a source would be a lie.
   */
  const sourceLabelFor = useCallback(
    (item: SavedItem): string | undefined => {
      if (item.thread_id) return threadTitles.get(item.thread_id) ?? "A thread";
      if (item.item_type === "outlier") return "Discover";
      return undefined;
    },
    [threadTitles],
  );

  // ── the Unfiled shelf ──────────────────────────────────────────────────────
  const unfiled = useMemo(() => items.filter((i) => i.project_id === null), [items]);

  const counts = useMemo(() => {
    const by: Record<string, number> = { all: unfiled.length };
    for (const i of unfiled) by[i.item_type] = (by[i.item_type] ?? 0) + 1;
    return by;
  }, [unfiled]);

  const searching = query.trim().length > 0;

  /**
   * Search spans the WHOLE library, not just Unfiled — a hit inside a project is exactly what you
   * are looking for when you search. Each result is badged with its project by the row itself.
   */
  const visible = useMemo(() => {
    const pool = searching ? items : unfiled;
    let v = filter === "all" ? pool : pool.filter((i) => i.item_type === filter);
    const q = query.trim().toLowerCase();
    if (q) v = v.filter((i) => searchText(i).includes(q));
    return [...v].sort((a, b) => {
      if (sort === "az") return (buildRowVM(a).hero ?? "").localeCompare(buildRowVM(b).hero ?? "");
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
  }, [items, unfiled, searching, filter, query, sort]);

  const selectMode = selected.size > 0;

  // Rail columns are reserved once for the whole visible list, so every row still aligns while a
  // column no row uses costs nothing. Measured: the shelf's rows carry no outlier, and the unused
  // 34px poster column was squeezing the content measure to 440px.
  const reserveThumb = useMemo(() => visible.some((i) => buildRowVM(i).coverUrl), [visible]);
  const reserveAction = useMemo(
    () => visible.some((i) => FORWARD[i.item_type] !== undefined),
    [visible],
  );

  /**
   * The thread behind the current selection, if they all share ONE. With a mixed selection there
   * is no single answer, so the picker infers nothing rather than badging an arbitrary thread's
   * project as the default.
   */
  const selectedThreadId = useMemo(() => {
    const threads = new Set(
      items.filter((i) => selected.has(i.id)).map((i) => i.thread_id).filter(Boolean),
    );
    return threads.size === 1 ? ([...threads][0] as string) : null;
  }, [items, selected]);

  // ── selection: click, ⇧-range over the VISIBLE order ───────────────────────
  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedId) {
          const order = visible.map((i) => i.id);
          const from = order.indexOf(lastClickedId);
          const to = order.indexOf(id);
          if (from !== -1 && to !== -1) {
            const [lo, hi] = from < to ? [from, to] : [to, from];
            // A range ADDS — shift-clicking never silently drops what you already picked.
            for (let k = lo; k <= hi; k++) next.add(order[k]!);
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedId(id);
    },
    [lastClickedId, visible],
  );

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visible.map((i) => i.id)));
  }, [visible]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setLastClickedId(null);
    setPickerOpen(false);
  }, []);

  const handleBulkFile = (projectId: string | null) => {
    const ids = [...selected];
    file.mutate(
      { ids, projectId },
      {
        onSuccess: () =>
          toast({
            variant: "success",
            title: projectId
              ? `Moved ${ids.length} to ${projectNames.get(projectId) ?? "project"}`
              : `Unfiled ${ids.length}`,
          }),
        onError: () => toast({ variant: "error", title: "Couldn't move those items." }),
      },
    );
    clearSelection();
  };

  const handleUnsaveOne = (item: SavedItem) => {
    remove.mutate(item.id, {
      onSuccess: () => toast({ variant: "success", title: "Removed from your Library" }),
      onError: () => toast({ variant: "error", title: "Couldn't remove this item." }),
    });
  };

  const handleBulkUnsave = () => {
    const ids = [...selected];
    for (const id of ids) remove.mutate(id);
    toast({ variant: "success", title: `Removed ${ids.length} from your Library` });
    clearSelection();
  };

  // ⌘A over the active facet, once a selection exists — a global hotkey would fight every
  // text field on the page, so it is scoped to the list and only while selecting.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && selectMode) {
      e.preventDefault();
      selectAllVisible();
    }
    if (e.key === "Escape" && selectMode) clearSelection();
  };

  if (isLoading) return <ShelfSkeleton />;

  if (isError) {
    return (
      <p className="text-sm text-foreground-muted">
        Couldn&rsquo;t load your library. Try again in a moment.
      </p>
    );
  }

  if (items.length === 0 && projects.length === 0) return <FirstRun />;

  return (
    <div className="flex flex-col gap-6" onKeyDown={onListKeyDown}>
      {/* ── header ───────────────────────────────────────────────────────────
          The house SurfaceHeader, not a hand-rolled h1. It already carries the on-scale type
          roles (`text-subhead lg:text-heading`) that the type-scale gate enforces, and reusing it
          is what keeps this page's title aligned with /audience and /settings — the exact
          alignment PR #407 fixed by moving this route onto PageShell. */}
      <div className="rv-in" style={{ animationDelay: "0.02s" }}>
        <SurfaceHeader
          title="Library"
          // Counts reconcile: total saved = filed + unfiled (§R5-8).
          subtitle={
            <>
              {items.length} saved
              {projects.length > 0 &&
                ` · ${projects.length} project${projects.length === 1 ? "" : "s"}`}
            </>
          }
          actions={
            <>
              {/* Stacked under the title below `sm` (see SurfaceHeader), where the row is the
                  full measure and the field should use it rather than sit at its 230px minimum. */}
              <div className="relative min-w-0 flex-1 sm:min-w-[230px] sm:flex-none">
                <MagnifyingGlass
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your library"
                  aria-label="Search saved items"
                  className="h-9 w-full rounded-[9px] border border-white/[0.06] bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-white/[0.10] focus:outline-none"
                />
              </div>
              <label htmlFor="library-sort" className="sr-only">
                Sort
              </label>
              <select
                id="library-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 cursor-pointer rounded-[9px] border border-white/[0.06] bg-surface px-3 text-sm text-foreground-secondary focus:border-white/[0.10] focus:outline-none"
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="az">A–Z</option>
              </select>
            </>
          }
        />
      </div>

      {/* ── projects ───────────────────────────────────────────────────────── */}
      {!searching && (
        <div className="rv-in" style={{ animationDelay: "0.06s" }}>
          <SectionLabel>Projects</SectionLabel>
          <div className="-mx-3 flex flex-col gap-0.5">
            {projects.map((project) => {
              const roll = rollupFor(rollups, project.id);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/library/${project.id}`)}
                  className="flex items-center gap-[15px] rounded-[11px] px-3 py-[15px] text-left transition-colors hover:bg-surface-thread focus-visible:outline-none focus-visible:bg-surface-thread"
                >
                  {/* Bare icon in the same 34px slot — the boxed chip went with the shelf's
                      (Apple-grammar pass); hierarchy comes from the name, not a tile. */}
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center text-foreground-muted">
                    <FolderSimple size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title font-medium tracking-[-0.012em] text-foreground">
                      {project.name}
                    </span>
                    <span className="mt-1 block text-body text-foreground-muted">
                      {roll.total > 0 ? describeCounts(roll.byType) : "Nothing filed yet"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3.5 text-body text-foreground-muted">
                    {relativeStamp(roll.newestSavedAt ?? project.updated_at)}
                    <CaretRight size={13} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
            <NewProjectRow items={items} countFor={(id) => rollupFor(rollups, id).total} />
          </div>
        </div>
      )}

      {/* ── the shelf ──────────────────────────────────────────────────────── */}
      <div className="rv-in" style={{ animationDelay: "0.09s" }}>
        {/* The label is omitted when nothing is filed — "Unfiled" means nothing then. */}
        {searching ? (
          <SectionLabel>
            {visible.length} result{visible.length === 1 ? "" : "s"} across your library
          </SectionLabel>
        ) : projects.length > 0 ? (
          <SectionLabel>Unfiled</SectionLabel>
        ) : null}

        {/* facets — the house pill segmented control (same grammar as DiscoverTabBar), replacing
            an underline tab bar that gave the identical job a second control language. Counts
            stay: unlike Discover's arrival tallies (owner ruling, 2026-08-04, about pricing a
            library you haven't asked anything), these describe the creator's OWN saved items. */}
        <div className="mb-4.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="inline-flex w-max items-center rounded-lg border border-border bg-surface-elevated p-0.5"
            role="tablist"
            aria-label="Filter by type"
          >
            {(["all", ...PIPELINE_ORDER] as const)
              .filter((id) => id === "all" || (counts[id] ?? 0) > 0)
              .map((id) => {
                const active = filter === id;
                const label = id === "all" ? "All" : TYPE_PLURAL[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-label font-medium transition-colors",
                      active
                        ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                        : "text-foreground-secondary hover:text-foreground",
                    )}
                  >
                    {label}
                    <span className="ml-1.5 opacity-60">{counts[id] ?? 0}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* §R5-5 selection bar — destructive action named, counted, and separated */}
        {selectMode && (
          <div
            className="mb-6 flex items-center gap-2.5 rounded-[12px] px-4 py-3.5 text-sm"
            style={{ backgroundColor: "var(--color-charcoal-chip)" }}
            role="toolbar"
            aria-label="Selection actions"
          >
            <span className="font-semibold text-foreground">{selected.size} selected</span>
            <span className="flex-1" />
            <div>
              <BarButton
                emphasis
                ref={setMoveAnchor}
                onClick={() => setPickerOpen((v) => !v)}
              >
                Move to project
              </BarButton>
              {pickerOpen && (
                <ProjectPickerPopover
                  anchorEl={moveAnchor}
                  align="right"
                  items={items}
                  // The single thread behind the selection, when there is exactly one — that is
                  // what lets the picker badge "this thread" instead of guessing.
                  threadId={selectedThreadId}
                  countFor={(id) => rollupFor(rollups, id).total}
                  onPick={(projectId) => handleBulkFile(projectId)}
                  onClose={() => setPickerOpen(false)}
                  unfiledLabel="Library — unfiled"
                />
              )}
            </div>
            <BarButton onClick={selectAllVisible}>Select all {visible.length}</BarButton>
            <BarButton bare onClick={clearSelection}>
              Cancel
            </BarButton>
            <span className="mx-1 h-5 w-px bg-white/[0.06]" />
            <BarButton danger onClick={handleBulkUnsave}>
              Unsave {selected.size}
            </BarButton>
          </div>
        )}

        {visible.length === 0 ? (
          <FilteredEmpty
            onClear={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          // The unified shelf panel (Apple-grammar pass): sibling rows on ONE bordered surface
          // with hairline dividers, replacing borderless whitespace-separated rows. `divide-y`
          // lands BETWEEN SavedRow units, so a row and its expansion stay one visual block;
          // `overflow-hidden` clips the square row-hover fill to the panel's own corners.
          <div className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-[12px] border border-white/[0.06]">
            {visible.map((item) => (
              <SavedRow
                key={item.id}
                item={item}
                sourceLabel={sourceLabelFor(item)}
                projectName={item.project_id ? projectNames.get(item.project_id) : undefined}
                expanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
                selectMode={selectMode}
                selected={selected.has(item.id)}
                onSelectToggle={(shiftKey) => toggleSelect(item.id, shiftKey)}
                onUnsave={() => handleUnsaveOne(item)}
                onMoveToProject={() => {
                  // Filing one row reuses the bulk path — one code path for one behaviour.
                  setSelected(new Set([item.id]));
                  setLastClickedId(item.id);
                  setPickerOpen(true);
                }}
                onOpenThread={item.thread_id ? () => openThread(item.thread_id!) : undefined}
                reserveThumb={reserveThumb}
                reserveAction={reserveAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3.5 px-3 text-caption font-semibold uppercase tracking-[0.14em] text-foreground-muted">
      {children}
    </p>
  );
}

/** `ref` is forwarded so the portaled picker can anchor to this button's box. */
function BarButton({
  children,
  onClick,
  emphasis,
  bare,
  danger,
  ref,
}: {
  children: React.ReactNode;
  onClick: () => void;
  emphasis?: boolean;
  bare?: boolean;
  danger?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className={cn(
        "rounded-[8px] px-3 py-1.5 text-body transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        bare || danger ? "border border-transparent" : "border border-white/[0.06]",
        emphasis && "border-white/[0.10] bg-surface text-foreground",
        danger
          ? "text-[color:var(--color-error)] hover:bg-white/[0.04]"
          : !emphasis && "text-foreground-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** The "New project" row — a dashed tile, matching the sketch's first-run affordance. */
function NewProjectRow({
  items,
  countFor,
}: {
  items: SavedItem[];
  countFor: (id: string) => number;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        ref={setAnchor}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[15px] rounded-[11px] px-3 py-[15px] text-left text-reading text-foreground-muted transition-colors hover:bg-surface-thread hover:text-foreground-secondary focus-visible:outline-none focus-visible:bg-surface-thread"
      >
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center">
          <Plus size={15} weight="bold" aria-hidden="true" />
        </span>
        New project
      </button>
      {open && (
        <ProjectPickerPopover
          anchorEl={anchor}
          items={items}
          countFor={countFor}
          onPick={(projectId) => {
            setOpen(false);
            if (projectId) router.push(`/library/${projectId}`);
          }}
          onClose={() => setOpen(false)}
          unfiledLabel="Library — unfiled"
        />
      )}
    </div>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="px-3 py-10">
      <p className="text-reading text-foreground-muted">Nothing matches.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-body text-foreground-secondary underline decoration-white/20 underline-offset-4 hover:text-foreground"
      >
        Clear search and filters
      </button>
    </div>
  );
}

/** Calm informational first run — not an error. */
function FirstRun() {
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
      title="Nothing in your Library yet"
      action={
        <Button variant="primary" onClick={() => router.push("/home")}>
          Start a Simulation
        </Button>
      }
    >
      Save a Read, idea, hook or outlier from any thread and it lands here — ready to pull back in.
    </SurfaceEmptyState>
  );
}

/** Skeleton shaped like the ROWS, so nothing shifts when the real list arrives. */
export function ShelfSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" data-testid="saved-shelf-skeleton">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-[230px] rounded-[9px]" />
          <Skeleton className="h-9 w-24 rounded-[9px]" />
        </div>
      </div>
      <div className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-[12px] border border-white/[0.06]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-[15px] px-3 py-3">
            <div className="grid h-[34px] w-[34px] shrink-0 place-items-center">
              <Skeleton className="h-[17px] w-[17px] rounded-[4px]" />
            </div>
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className="h-[17px] w-[min(70%,420px)] rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
            <Skeleton className="h-4 w-[92px] shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
