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
 *   • thin-baseline extremes (≥100×) are ADMITTED but never presented as proof — the printed
 *     number clamps at 100× and the badge drops the green ▲ for a muted "100× ⚠" (B1, owner
 *     ruling 2026-08-11). They used to be excluded outright. The reason the old rule existed —
 *     "a feed sorted by highest × must not open on a 20,154×" — is served instead by the clamp
 *     PLUS the sort: flagged rows rank last under "Highest ×", so it opens on the best genuine
 *     receipt rather than on 55 rows tied at the ceiling (owner ruling 2026-08-12).
 *   • the footer states when the corpus was last refreshed instead of implying "today".
 *
 * REWORKED 2026-08-04 (owner, against a Sandcastles reference):
 *   · the counted niche chip row is GONE. It was the surface's densest number cluster —
 *     "All 230 · Content Creation 86 · Business 24 · … · +11 more" — a wrapping wall of
 *     tallies that priced every branch before you had chosen one. Niche is now one select
 *     inside the filter panel, where it sits beside the other seven axes as a peer.
 *   · filtering moved from that single axis to a real panel (DiscoverFilters): creator,
 *     niche, platform, views, outlier score, engagement, age.
 *   · sort moved out of a three-button segmented control into the toolbar beside Filters.
 */

import { useMemo, useState } from "react";
import {
  ArrowRight,
  FunnelSimple,
  InstagramLogo,
  TiktokLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CoverFill } from "@/components/primitives/CoverFill";
import type { CorpusVideo } from "@/lib/discover/corpus-reads";
import { useRemixLaunch } from "./use-remix-launch";
import { RemixBriefDialog, useRemixBrief } from "./remix-brief-dialog";
import { fmtAge, fmtMultiplier, fmtViews } from "./discover-primitives";
import {
  DiscoverFilters,
  EMPTY_FILTERS,
  activeFilterCount,
  matchesFilters,
  type DiscoverFilterState,
} from "./discover-filters";

type Sort = "recent" | "multiplier" | "views";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "multiplier", label: "Highest ×" },
  { id: "views", label: "Most viewed" },
];

const PAGE_SIZE = 24;

export function OutliersPanel({
  videos,
  query,
  refreshedLabel,
  onOpen,
}: {
  /** The feed pool, already filtered to proven (extremes included, clamped) and sorted newest-first. */
  videos: CorpusVideo[];
  /** The hub's search box — filters here rather than opening a second search. */
  query: string;
  refreshedLabel: string;
  /** Opens the teardown detail, which the hub owns. */
  onOpen: (id: string) => void;
}) {
  const [filters, setFilters] = useState<DiscoverFilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [panelOpen, setPanelOpen] = useState(false);
  const { remix, pendingId } = useRemixLaunch();
  // D3 — the tap opens the brief sheet; only Remix or Skip inside it starts the billed run.
  const brief = useRemixBrief(remix);

  const q = query.trim().toLowerCase();

  // Option lists come from the pool being filtered, so a select can never offer a value
  // that yields nothing. Sorted for findability — 413 creators in source order is a list
  // nobody can scan.
  const options = useMemo(() => {
    const creators = new Set<string>();
    const platforms = new Set<string>();
    const niches = new Set<string>();
    for (const v of videos) {
      if (v.handle) creators.add(v.handle);
      if (v.platform) platforms.add(v.platform);
      if (v.niche) niches.add(v.niche);
    }
    return {
      creators: [...creators].sort((a, b) => a.localeCompare(b)),
      platforms: [...platforms].sort((a, b) => a.localeCompare(b)),
      niches: [...niches].sort((a, b) => a.localeCompare(b)),
    };
  }, [videos]);

  const visible = useMemo(() => {
    const filtered = videos.filter((v) => {
      if (!matchesFilters(v, filters)) return false;
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
    // Flagged rows sort LAST (owner ruling 2026-08-12). Once the band clamps instead of dropping,
    // 55 thin-baseline rows all tie at exactly 100× — sorting on the number alone opens "Highest ×"
    // on a wall of them and buries the best genuine receipt (a real 41.6×) underneath. The control
    // promises the highest MEASURED multiple, so in-band rows rank first and the flagged band
    // follows, still findable, still ordered among themselves.
    if (sort === "multiplier") {
      copy.sort((a, b) => {
        if (a.extreme !== b.extreme) return a.extreme ? 1 : -1;
        return (b.multiplier ?? 0) - (a.multiplier ?? 0);
      });
    }
    if (sort === "views") copy.sort((a, b) => b.views - a.views);
    return copy;
  }, [videos, filters, q, sort]);

  const activeCount = activeFilterCount(filters);

  return (
    <div>
      {/* Under `lg` the rail collapses, so the toggle that reveals it lives here. Above `lg`
          the rail is always present and this row disappears entirely. */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border px-3 text-label font-medium transition-colors",
            activeCount > 0
              ? "border-transparent bg-white/[0.09] text-foreground"
              : "border-border text-foreground-secondary hover:border-border-hover hover:text-foreground",
          )}
        >
          <FunnelSimple size={14} />
          Filters
          {activeCount > 0 ? (
            <span className="tabular-nums opacity-60">{activeCount}</span>
          ) : null}
        </button>
      </div>

      <div className="lg:flex lg:items-start lg:gap-5">
        {/* The panel is a permanent column from `lg` up and a toggled block below it. Not a
            fixed overlay: this grid is the page's only scroll context, and an overlay panel
            would trap the scroll behind it on exactly the widths where the list is longest. */}
        {/* Sticky from `lg` up. The cards got large enough that the grid is many screens
            tall while the panel is one — without this the filters scroll away after the
            first row and every adjustment means scrolling back to the top. */}
        <div
          className={cn(
            "mb-4 lg:sticky lg:top-6 lg:mb-0 lg:block lg:w-60 lg:shrink-0",
            panelOpen ? "block" : "hidden",
          )}
        >
          <DiscoverFilters
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setLimit(PAGE_SIZE); // a narrower pool starts at the top, not 96 rows down
            }}
            creators={options.creators}
            platforms={options.platforms}
            niches={options.niches}
            onClose={() => setPanelOpen(false)}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Sort belongs to the GRID, not to the page — it orders these cards. Sitting inside
              the grid column puts it on the rail's top edge instead of floating above both
              with dead space beside it. */}
          <div className="mb-3 flex justify-end">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5">
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
              {activeCount > 0 ? (
                <>
                  Nothing matches those filters.{" "}
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-foreground-secondary underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    Clear them
                  </button>{" "}
                  to see the library again.
                </>
              ) : (
                <>
                  No outliers match that. Paste a{" "}
                  <span className="text-foreground-secondary">@handle</span> above to pull one
                  live instead.
                </>
              )}
            </p>
          ) : (
            <>
              {/* Deliberately one column fewer at every step than a dense index would use
                  (owner, 2026-08-04: "make them bigger"). The cover IS the content on this
                  surface — a hook you cannot read off the first frame is not a browsable
                  result — so at a 1440 laptop this is two ~460px cards rather than three
                  ~290px ones, and only the widest screens go to three. */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visible.slice(0, limit).map((v) => (
                  <OutlierCard
                    key={v.id}
                    video={v}
                    pending={pendingId === v.id}
                    onRemix={() =>
                      brief.ask(v.id, v.videoUrl, v.spokenHook || v.template || null)
                    }
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
                    Show more
                  </button>
                ) : null}
                <p className="text-caption text-foreground-muted">{refreshedLabel}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <RemixBriefDialog {...brief.dialogProps} />
    </div>
  );
}

/** The corpus carries three platforms and the reference badges each cover with its own.
 *  Unknown/absent → no badge at all rather than a fallback glyph that would assert a
 *  platform we do not actually know. */
const PLATFORM_ICON: Record<string, typeof TiktokLogo> = {
  tiktok: TiktokLogo,
  instagram: InstagramLogo,
  youtube: YoutubeLogo,
};

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
  const PlatformIcon = video.platform ? PLATFORM_ICON[video.platform] : undefined;
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-surface-elevated transition-all hover:border-border-hover hover:bg-white/[0.02]">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-sunken">
        <CoverFill
          coverUrl={video.coverUrl}
          playSize={26}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* A scrim, not a solid pill behind each badge. Covers here are arbitrary frames —
            white kitchens, blown-out skies — and a badge with its own dark chip read as two
            stuck-on stickers. One gradient carries both and lets the frame stay the object. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent"
          aria-hidden="true"
        />
        {/* The same honesty rule MultiplierChip enforces (discover-primitives.tsx), applied with
            the overlay's styling rather than its pill — a pill on an arbitrary video frame read as
            a stuck-on sticker, which is why this badge is bare text over the scrim.
            ⚠️ Do NOT collapse this back to one green ▲. Once the band CLAMPS instead of dropping
            (B1), extreme rows reach this feed, and a green ▲100× on a thin baseline is the exact
            claim the clamp exists to avoid — the number is real, the proof is not. */}
        {video.multiplier !== null ? (
          video.extreme ? (
            <span
              title="Measured against a very thin baseline — shown, but not treated as proof"
              className="absolute left-2.5 top-2.5 text-label font-semibold tabular-nums text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
            >
              {fmtMultiplier(video.multiplier)} ⚠
            </span>
          ) : (
            <span
              title={`${fmtMultiplier(video.multiplier)} ${video.baselineLabel ?? ""}`}
              className="absolute left-2.5 top-2.5 text-label font-semibold tabular-nums text-[color:var(--color-positive)] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
            >
              ▲ {fmtMultiplier(video.multiplier)}
            </span>
          )
        ) : null}
        {PlatformIcon ? (
          <PlatformIcon
            size={17}
            weight="fill"
            aria-label={video.platform ?? undefined}
            className="absolute right-2.5 top-2.5 text-white/85 [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))]"
          />
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
      {/* The hook leads at body size — it is the thing being browsed, and at text-label it
          sat at the same weight as the handle beneath it, so the card had no first read.
          `min-h` reserves both lines so a one-line hook does not shorten its card and ragged
          the row. */}
      <div className="p-3.5">
        <p className="line-clamp-2 min-h-[2.75em] text-body leading-snug text-foreground">
          {hook}
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-caption text-foreground-muted">
          <span className="min-w-0 flex-1 truncate">@{video.handle ?? "unknown"}</span>
          <span className="shrink-0 tabular-nums">{fmtViews(video.views)}</span>
          {age ? (
            <>
              <span aria-hidden="true" className="shrink-0 opacity-40">
                ·
              </span>
              <span className="shrink-0 tabular-nums">{age}</span>
            </>
          ) : null}
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
