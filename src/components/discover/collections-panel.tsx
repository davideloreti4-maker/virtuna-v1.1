"use client";

/**
 * CollectionsPanel — the 105 curated groupings of the teardown corpus, and the drill-in.
 *
 * The collections come from `teardown_collections`, the hand-curated mapping. They are NOT
 * derived from the teardown taxonomy columns: deriving them once produced 82 worse, different
 * groupings, so the table is the source of truth and this only renders it.
 *
 * Replaces the Hooks tab, whose 12 rows were hardcoded templates carrying, per their own
 * source comment, "static illustration" numbers — rendered in the same green multiplier pill
 * as the measured ones two tabs over.
 */

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { CoverFill } from "@/components/primitives/CoverFill";
import type {
  CollectionCategory,
  CollectionSummary,
  CorpusVideo,
} from "@/lib/discover/corpus-reads";
import { useRemixLaunch } from "./use-remix-launch";
import { Chip, Kicker, MultiplierChip, fmtAge, fmtViews } from "./discover-primitives";

/** Shelf order is value order — formats first: the biggest set and the most legible to a
 *  creator deciding what to make. */
const CATEGORIES: { id: CollectionCategory; label: string }[] = [
  { id: "formats", label: "Formats" },
  { id: "visual_hooks", label: "Visual hooks" },
  { id: "editing_styles", label: "Editing styles" },
  { id: "signature_series", label: "Signature series" },
];

/** One full grid row at the widest breakpoint — a 6-of-4 preview left a ragged half row. */
const PREVIEW_PER_SHELF = 4;

export function CollectionsPanel({
  collections,
  teardowns,
  query,
  onOpen,
}: {
  collections: CollectionSummary[];
  teardowns: Record<string, CorpusVideo>;
  query: string;
  /** Opens the teardown detail, which the hub owns. */
  onOpen: (id: string) => void;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<CollectionCategory | null>(null);

  const q = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      collections.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.subcategory ?? "").toLowerCase().includes(q),
      ),
    [collections, q],
  );

  const open = openSlug ? collections.find((c) => c.slug === openSlug) ?? null : null;
  if (open) {
    return (
      <CollectionDetail
        collection={open}
        teardowns={teardowns}
        onBack={() => setOpenSlug(null)}
        onOpen={onOpen}
      />
    );
  }

  return (
    <div className="space-y-7">
      {CATEGORIES.map((cat) => {
        const list = matching
          .filter((c) => c.category === cat.id)
          .sort((a, b) => b.itemIds.length - a.itemIds.length);
        if (list.length === 0) return null;
        const isOpen = expanded === cat.id || Boolean(q);
        const shown = isOpen ? list : list.slice(0, PREVIEW_PER_SHELF);
        return (
          <section key={cat.id}>
            {/* No blurb beside the heading (owner, 2026-08-04). "Formats — the shape of the
                whole video" explained a word the covers underneath explain better, and it
                was truncating at narrow widths anyway. */}
            <div className="mb-3 flex items-baseline gap-3">
              <h3 className="text-body font-semibold text-foreground">{cat.label}</h3>
              {list.length > PREVIEW_PER_SHELF && !q ? (
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : cat.id)}
                  className="ml-auto shrink-0 text-label font-medium text-foreground-muted transition-colors hover:text-foreground"
                >
                  {isOpen ? "Show less" : `See all ${list.length}`}
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((c) => (
                <CollectionCard key={`${c.category}-${c.slug}`} collection={c} onOpen={() => setOpenSlug(c.slug)} />
              ))}
            </div>
          </section>
        );
      })}

      {matching.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-label text-foreground-muted">
          No collection matches that.
        </p>
      ) : null}
    </div>
  );
}

function CollectionCard({
  collection,
  onOpen,
}: {
  collection: CollectionSummary;
  onOpen: () => void;
}) {
  const covers = collection.coverUrls;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-border bg-surface-elevated text-left transition-colors hover:border-border-hover"
    >
      <div className="grid grid-cols-2 grid-rows-2 gap-px bg-white/[0.05]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative h-[70px] overflow-hidden bg-surface-sunken">
            <CoverFill coverUrl={covers[i] ?? null} playSize={14} />
          </div>
        ))}
      </div>
      <div className="p-2.5">
        <Kicker>
          {collection.subcategory ? collection.subcategory : collection.category.replace(/_/g, " ")}
        </Kicker>
        <p className="mt-1 truncate text-label font-semibold text-foreground">{collection.name}</p>
        <div className="mt-2 flex gap-1.5">
          <Chip>
            {collection.itemIds.length} video{collection.itemIds.length === 1 ? "" : "s"}
          </Chip>
          {collection.provenCount > 0 ? (
            <Chip tone="proven">{collection.provenCount} proven</Chip>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function CollectionDetail({
  collection,
  teardowns,
  onBack,
  onOpen,
}: {
  collection: CollectionSummary;
  teardowns: Record<string, CorpusVideo>;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { remix, pendingId } = useRemixLaunch();
  const items = collection.itemIds
    .map((id) => teardowns[id])
    .filter((v): v is CorpusVideo => Boolean(v));

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-label text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={13} weight="bold" /> All collections
      </button>

      {/* Block wrapper: Kicker is an inline span, so beside the inline-flex back button it
          ran on as "All collectionsFORMATS". */}
      <div>
        <Kicker>
          {collection.subcategory ? collection.subcategory : collection.category.replace(/_/g, " ")}
        </Kicker>
      </div>
      <div className="mb-1 mt-1 flex items-baseline gap-3">
        <h2 className="text-subhead font-semibold text-foreground">{collection.name}</h2>
        <span className="text-caption tabular-nums text-foreground-muted">
          {items.length} videos · {collection.provenCount} proven
        </span>
      </div>
      <p className="mb-4 max-w-2xl text-caption text-foreground-muted">
        Every row is a real video we tore down. The number is measured against that creator&apos;s
        own usual views — a row with no baseline says <span className="text-foreground-secondary">curated</span> and makes
        no claim.
      </p>

      <div className="space-y-2">
        {items.map((v) => (
          <article
            key={v.id}
            className="relative flex items-center gap-3.5 rounded-xl border border-border bg-surface-elevated p-2.5 transition-colors hover:border-border-hover"
          >
            <div className="relative h-[74px] w-[56px] shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
              <CoverFill coverUrl={v.coverUrl} playSize={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-body text-foreground">
                {v.template || v.spokenHook || "—"}
              </p>
              <p className="mt-1 truncate text-caption text-foreground-muted">
                Inspired by @{v.handle ?? "unknown"}
                {v.multiplier !== null && v.baselineLabel ? ` · ${v.baselineLabel}` : ""}
                {fmtAge(v.postedAt) ? ` · ${fmtAge(v.postedAt)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MultiplierChip video={v} />
              <Chip>{fmtViews(v.views)} views</Chip>
              <button
                type="button"
                onClick={() => void remix(v.id, v.videoUrl)}
                disabled={pendingId === v.id}
                className="relative z-20 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-action)] px-3 py-1.5 text-label font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pendingId === v.id ? "Starting…" : "Remix"}
                {pendingId === v.id ? null : <ArrowRight size={12} weight="bold" />}
              </button>
            </div>
            {/* The row opens the same teardown detail an outlier card does — this is where the
                template shown above comes from, and the analysis behind it lives only there. */}
            <button
              type="button"
              onClick={() => onOpen(v.id)}
              aria-label={`Open teardown: ${v.template || v.spokenHook || "untitled"}`}
              className="absolute inset-0 z-10 rounded-xl"
            />
          </article>
        ))}
      </div>
    </div>
  );
}
