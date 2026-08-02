"use client";

/**
 * OutliersPanel — the Discover hub's lead tab: every video in the corpus that beat its own
 * creator's usual views by 3× or more.
 *
 * This is the surface the old hub never had. "Trending" sorted 7,438 rows of which 49
 * carried a multiplier and none carried a cover; this reads the teardown corpus, where the
 * proof, the cover and the date are all present by construction.
 *
 * Two honesty rules are visible in the layout, not just the copy:
 *   • the pool excludes thin-baseline extremes (≥100×) — they stay findable inside their
 *     collections, flagged, but a feed sorted by "highest ×" must not open on a 20,154×;
 *   • the footer states when the corpus was last refreshed instead of implying "today".
 */

import { useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CoverFill } from "@/components/primitives/CoverFill";
import type { CorpusVideo } from "@/lib/discover/corpus-reads";
import { useRemixLaunch } from "./use-remix-launch";
import { fmtAge, fmtMultiplier, fmtViews } from "./discover-primitives";

type Sort = "recent" | "multiplier" | "views";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "multiplier", label: "Highest ×" },
  { id: "views", label: "Most viewed" },
];

/** Chips beyond this collapse behind "+N more" — a filter row that wraps to three lines
 *  is a wall, and the tail niches hold single digits. */
const VISIBLE_NICHES = 5;
const PAGE_SIZE = 24;

const nicheLabel = (id: string) =>
  id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function OutliersPanel({
  videos,
  niches,
  query,
  refreshedLabel,
  onOpen,
}: {
  /** The feed pool, already filtered to proven + non-extreme and sorted newest-first. */
  videos: CorpusVideo[];
  niches: { id: string; count: number }[];
  /** The hub's search box — filters here rather than opening a second search. */
  query: string;
  refreshedLabel: string;
  /** Opens the teardown detail, which the hub owns. */
  onOpen: (id: string) => void;
}) {
  const [niche, setNiche] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [showAllNiches, setShowAllNiches] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { remix, pendingId } = useRemixLaunch();

  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    const filtered = videos.filter((v) => {
      if (niche && v.niche !== niche) return false;
      if (!q) return true;
      return (
        (v.spokenHook ?? "").toLowerCase().includes(q) ||
        (v.template ?? "").toLowerCase().includes(q) ||
        (v.handle ?? "").toLowerCase().includes(q) ||
        (v.niche ?? "").includes(q)
      );
    });
    if (sort === "recent") return filtered;
    const copy = [...filtered];
    if (sort === "multiplier") copy.sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0));
    if (sort === "views") copy.sort((a, b) => b.views - a.views);
    return copy;
  }, [videos, niche, q, sort]);

  const shownNiches = showAllNiches ? niches : niches.slice(0, VISIBLE_NICHES);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <NicheChip active={!niche} count={videos.length} onClick={() => setNiche(null)}>
          All
        </NicheChip>
        {shownNiches.map((n) => (
          <NicheChip
            key={n.id}
            active={niche === n.id}
            count={n.count}
            onClick={() => setNiche(niche === n.id ? null : n.id)}
          >
            {nicheLabel(n.id)}
          </NicheChip>
        ))}
        {!showAllNiches && niches.length > VISIBLE_NICHES ? (
          <button
            type="button"
            onClick={() => setShowAllNiches(true)}
            className="rounded-lg border border-border px-2.5 py-1 text-label font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            +{niches.length - VISIBLE_NICHES} more
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={cn(
                "rounded-md px-2.5 py-1 text-label font-medium transition-colors",
                sort === s.id
                  ? "bg-white/[0.09] text-foreground"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-label text-foreground-muted">
          No outliers match that. Paste a <span className="text-foreground-secondary">@handle</span>{" "}
          above to pull one live instead.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.slice(0, limit).map((v) => (
              <OutlierCard
                key={v.id}
                video={v}
                pending={pendingId === v.id}
                onRemix={() => void remix(v.id, v.videoUrl)}
                onOpen={() => onOpen(v.id)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {limit < visible.length ? (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE * 2)}
                className="rounded-lg border border-border bg-surface-elevated px-3.5 py-2 text-label font-semibold text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
              >
                Show more · {visible.length - limit} left
              </button>
            ) : null}
            <p className="text-caption text-foreground-muted">{refreshedLabel}</p>
          </div>
        </>
      )}
    </div>
  );
}

function NicheChip({
  children,
  count,
  active,
  onClick,
}: {
  children: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-label font-medium transition-colors",
        active
          ? "border-transparent bg-white/[0.09] text-foreground"
          : "border-border text-foreground-muted hover:border-border-hover hover:text-foreground-secondary",
      )}
    >
      {children} <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function OutlierCard({
  video,
  pending,
  onRemix,
  onOpen,
}: {
  video: CorpusVideo;
  pending: boolean;
  onRemix: () => void;
  onOpen: () => void;
}) {
  const age = fmtAge(video.postedAt);
  const hook = video.spokenHook || video.template || "Untitled teardown";
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-surface-elevated transition-colors hover:border-border-hover">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-sunken">
        <CoverFill coverUrl={video.coverUrl} playSize={20} />
        {video.multiplier !== null ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-micro font-semibold tabular-nums text-[color:var(--color-positive)]">
            ▲ {fmtMultiplier(video.multiplier)}
          </span>
        ) : null}
        {/* A MOUSE ACCELERATOR, and nothing more. The real Remix is the plain visible button
            inside the teardown detail this card opens — which is what makes the action
            reachable by touch and by keyboard at all.
            ⚠️ `pointer-events-none` while hidden is load-bearing, not tidiness: an opacity-0
            button still occupies its slot and still takes the tap, so on a touch device a
            thumb landing on the lower third of a card fired a remix nobody could see and got
            dropped on /home. Hidden from AT (`aria-hidden` + `tabIndex={-1}`) because it is a
            duplicate of an action already reachable, and a focusable invisible control is its
            own defect. */}
        <button
          type="button"
          onClick={onRemix}
          disabled={pending}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-action)] px-3 py-1.5 text-label font-semibold text-[color:var(--color-action-foreground)] opacity-0 transition-opacity disabled:opacity-60 group-hover:pointer-events-auto group-hover:opacity-100"
        >
          {pending ? "Starting…" : "Remix"}
          {pending ? null : <ArrowRight size={13} weight="bold" />}
        </button>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[2.6em] text-label text-foreground">{hook}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-caption text-foreground-muted">
          <span className="truncate">@{video.handle ?? "unknown"}</span>
          <span className="shrink-0 tabular-nums">
            {fmtViews(video.views)}
            {age ? ` · ${age}` : ""}
          </span>
        </div>
      </div>
      {/* The whole card is the target — one tab stop, one tap, no hover required. Rendered
          last and stretched over the card rather than wrapped around it: a button cannot
          nest inside a button, and clamping text inside a stretched link is fragile. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open teardown: ${hook}`}
        className="absolute inset-0 z-10 rounded-xl"
      />
    </article>
  );
}
