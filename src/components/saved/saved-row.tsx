"use client";

/**
 * SavedRow — one saved item on the Library shelf (sketch rev 5, public/_sketch-library-v5.html).
 *
 * Borderless, space-separated, hover-lifted. Replaces the masonry card, which broke its own sort
 * (CSS multicol fills column-by-column, so under "Recent" the second-newest sat BELOW the newest)
 * and, measured live at four columns inside the 880px PageShell, gave each card 196px — every hook
 * truncated mid-sentence and the segment chips degraded to "Sleep-…", "T…", "St…".
 *
 * Three structural rules from rev 5, each fixing something measured:
 *
 *  §R5-2  The left column is a FIXED 34px slot. In selection mode the checkbox is centred inside
 *         it, so entering selection changes what the slot CONTAINS and never where the sentence
 *         starts. Rev 4 swapped a 34px tile for an 18px checkbox and shifted the body 173px→157px
 *         while its own note claimed "no reflow".
 *
 *  §R5-10 The right rail is a GRID with fixed columns (thumb · metric · action · caret), not a
 *         flex row. As flex, a wider hover action pushed the metric leftward and the tabular
 *         numbers never formed a column.
 *
 *  §R5-4  A row expands IN PLACE. Rev 4 justified its two-fact subtitle by moving rank and
 *         archetype "to the detail view" and then never drew one. Expanding rather than
 *         navigating matters because filing is why this rework exists — a click that leaves the
 *         shelf costs you your place and your selection.
 */

import { useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { useToast } from "@/components/ui/toast";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import {
  buildRowVM,
  anchorFromSnapshot,
  FORWARD,
  TYPE_ICON,
  TYPE_LABEL,
} from "./saved-item-vm";

export interface SavedRowProps {
  item: SavedItem;
  /** Resolved source label — a real thread title, or "Discover" for a scraped outlier. */
  sourceLabel?: string;
  /** Name of the owning project, when the row is shown outside that project. */
  projectName?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Selection mode swaps the type tile for a checkbox inside the same 34px slot. */
  selectMode: boolean;
  selected: boolean;
  /** `shiftKey` drives range selection in the parent. */
  onSelectToggle: (shiftKey: boolean) => void;
  onUnsave: () => void;
  onMoveToProject: () => void;
  /** Re-open the thread this output came from. Absent when the row has no thread_id. */
  onOpenThread?: () => void;
  /**
   * Rail columns are reserved PER SURFACE, not per row — alignment only has to hold between rows
   * shown together, and reserving a column that no row on the page uses is pure waste. Measured
   * live: the shelf's ten rows contain no outlier, so a permanently-reserved 34px poster column
   * was squeezing the content measure to 440px and wrapping hooks for nothing.
   */
  reserveThumb?: boolean;
  reserveAction?: boolean;
}

/** en-US pinned: `undefined` takes the ambient locale, so SSR rendered "29. Juni". */
function formatStamp(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SavedRow({
  item,
  sourceLabel,
  projectName,
  expanded,
  onToggleExpand,
  selectMode,
  selected,
  onSelectToggle,
  onUnsave,
  onMoveToProject,
  onOpenThread,
  reserveThumb = false,
  reserveAction = true,
}: SavedRowProps) {
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  const vm = buildRowVM(item);
  const TypeIcon = TYPE_ICON[item.item_type] ?? TYPE_ICON.hook;
  const forward = FORWARD[item.item_type];
  const stamp = formatStamp(item.created_at);

  // Forward = re-run the chain step, then land in the thread. Types with no endpoint do NOT get a
  // fake one; their action is "Open the thread", which is a real deep link.
  const handleForward = async () => {
    if (!forward || launching) return;
    setLaunching(true);
    try {
      const res = await fetch(forward.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchor: anchorFromSnapshot(item.snapshot), platform: "tiktok" }),
      });
      if (!res.ok) {
        const err: unknown = await res.json().catch(() => null);
        if (reportCredit402(res.status, err)) {
          setLaunching(false);
          return; // the credit wall is up — do not navigate
        }
        throw new Error("Launch failed");
      }
    } catch {
      toast({ variant: "error", title: "Couldn't launch this into a thread." });
      setLaunching(false);
      return;
    }
    // The run landed in the user's open thread; go read it.
    onOpenThread?.();
    setLaunching(false);
  };

  const rowTone = selected
    ? // §R5-1 selected is NOT the hover tone. Rev 4 painted both #252524, so a row under the
      // cursor looked chosen. A faint accent wash + 1px accent edge is the accent doing its
      // sanctioned job: interactive state.
      "bg-[rgba(255,99,99,0.055)] shadow-[inset_0_0_0_1px_rgba(255,99,99,0.22)]"
    : expanded
      ? "bg-surface-thread"
      : "hover:bg-surface-thread";

  return (
    <div className="flex flex-col">
      {/* ── the row ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "group relative flex items-start gap-[15px] rounded-[11px] px-3 py-[15px] transition-colors",
          rowTone,
        )}
        data-testid="saved-row"
        data-item-type={item.item_type}
        data-selected={selected || undefined}
      >
        {/* §R5-2 the fixed 34px slot — tile or checkbox, same footprint either way.
            §R5-12 BOTH are always rendered and CSS swaps them, which is how you ENTER selection
            mode: hovering (or tabbing to) a row turns its type tile into an empty checkbox in
            place, exactly as rev 4 specified. Rendering the checkbox only `if (selectMode)` — the
            first thing I built — was unreachable: selectMode is true only once something is
            selected, and nothing could be selected without a checkbox to click. */}
        <span className="mt-px grid w-[34px] shrink-0 place-items-center">
          {!selectMode && (
            <span
              className={cn(
                "col-start-1 row-start-1 grid h-[34px] w-[34px] place-items-center rounded-[9px] border transition-colors",
                "border-white/[0.06] bg-surface text-foreground-secondary",
                "group-hover:hidden group-focus-within:hidden",
              )}
              title={vm.typeLabel}
            >
              <TypeIcon size={17} aria-hidden="true" />
              <span className="sr-only">{vm.typeLabel}</span>
            </span>
          )}
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select ${vm.typeLabel}: ${vm.hero}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle(e.shiftKey);
            }}
            className={cn(
              "col-start-1 row-start-1 h-[18px] w-[18px] place-items-center rounded-[5px] border transition-colors",
              selected
                ? "border-accent bg-accent"
                : "border-white/[0.10] bg-surface hover:border-white/25",
              // Always laid out in selection mode; otherwise revealed by hover/keyboard focus.
              selectMode ? "grid" : "hidden group-hover:grid group-focus-within:grid",
            )}
          >
            {selected && <Check size={11} weight="bold" className="text-[#2a1212]" />}
          </button>
        </span>

        {/* ── content: the sentence is the interface ───────────────────────── */}
        <button
          type="button"
          onClick={selectMode ? () => onSelectToggle(false) : onToggleExpand}
          aria-expanded={selectMode ? undefined : expanded}
          className="min-w-0 flex-1 pt-0.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)] rounded-[6px]"
        >
          <span className="block max-w-[56ch] text-title font-normal leading-[1.45] tracking-[-0.011em] text-foreground">
            {vm.heroPrefix && <span className="font-semibold">{vm.heroPrefix} </span>}
            {vm.hero}
          </span>
          {/* Two facts only — where it came from and when. Rank and archetype are in the
              expansion. A legacy row with no thread_id shows the time alone rather than a
              fabricated source. */}
          <span className="mt-[7px] block text-body text-foreground-muted">
            {sourceLabel && <span className="text-foreground-secondary">{sourceLabel}</span>}
            {sourceLabel && <span className="px-[5px] opacity-40">·</span>}
            {stamp}
          </span>
        </button>

        {/* ── §R5-10 the rail: fixed columns so the numbers form a column ────
            §R5-13 the ACTION column is reserved only from `sm` up. The rail is `shrink-0`, so
            every pixel it reserves is taken from the sentence beside it — and measured live at
            390x844 the reserved 92+152+14+gaps came to 282px of a 358px content width, leaving
            the title button **12px**. Every hook wrapped to ten one-word lines, one word per
            row, down the whole shelf. Nothing flagged it because there is no horizontal
            overflow: the text wraps instead, so `scrollWidth === clientWidth` reads clean, and
            jsdom has no layout at all. Reserving the column was never right below `sm` anyway —
            what it holds is hover-only, and a touch pointer has no hover to give it. */}
        <span
          className={cn(
            "grid shrink-0 items-center gap-3 pt-1.5",
            reserveThumb
              ? reserveAction
                ? "grid-cols-[34px_92px_14px] sm:grid-cols-[34px_92px_152px_14px]"
                : "grid-cols-[34px_92px_14px]"
              : reserveAction
                ? "grid-cols-[92px_14px] sm:grid-cols-[92px_152px_14px]"
                : "grid-cols-[92px_14px]",
          )}
        >
          {/* 1. outlier poster */}
          {reserveThumb && (
          <span>
            {vm.coverUrl && (
              <span className="relative block h-11 w-[34px] overflow-hidden rounded-[6px] border border-white/[0.06] bg-white/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover */}
                <img
                  src={vm.coverUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </span>
            )}
          </span>
          )}

          {/* 2. the metric — §R5-3 band OR measured, tone on ONE word */}
          <span className="text-right text-body font-semibold tabular-nums tracking-[-0.01em] whitespace-nowrap">
            {vm.metric.band && (
              <>
                <span style={{ color: vm.metric.bandTone }}>{vm.metric.band}</span>
                {vm.metric.fraction && (
                  <span className="ml-1.5 text-foreground">{vm.metric.fraction}</span>
                )}
              </>
            )}
            {vm.metric.measured && <span className="text-foreground">{vm.metric.measured}</span>}
          </span>

          {/* 3. the forward action — reserved space, so hover moves nothing.
              Hidden outright below `sm`: it is revealed by hover, and a touch pointer never
              hovers, so below that width it is a column that can only ever be empty. */}
          {reserveAction && (
          <span className="hidden text-right sm:block">
            {forward && !selectMode && (
              <button
                type="button"
                onClick={() => void handleForward()}
                disabled={launching}
                className={cn(
                  // ⚠️ `pointer-events-none` is load-bearing, not tidying. `opacity-0` hides this
                  // button but leaves it hit-testing, and it is not a benign one: onClick POSTs
                  // `forward.endpoint`, which RUNS A BILLABLE SKILL. Measured at 390x844 before
                  // this line, `document.elementFromPoint` at the button's own centre returned the
                  // button — an invisible 88x20 tap target sitting over the right-hand side of
                  // every Library row, on a pointer that could never reveal it. Tapping there
                  // spent the creator's credits on a run they never asked for. The `sm:block`
                  // above closes it for phones; this closes it for a touch TABLET, which is wide
                  // enough to render the column and still has no hover to reveal it.
                  "whitespace-nowrap text-body text-foreground-secondary opacity-0 transition-opacity",
                  "pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto",
                  "hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100",
                  "disabled:opacity-60",
                )}
                aria-label={`${forward.label} — ${TYPE_LABEL[item.item_type]}`}
              >
                {launching ? "Launching…" : `${forward.label} →`}
              </button>
            )}
          </span>
          )}

          {/* 4. the disclosure caret. No ⋯ menu: its only two actions live in the expansion. */}
          <span className="justify-self-end">
            {!selectMode && (
              <CaretDown
                size={13}
                className={cn(
                  "text-foreground-muted transition-[opacity,transform]",
                  // Below `sm` the caret is always drawn: it is the ONLY thing on the row that
                  // says a row opens, and hover — the thing that reveals it everywhere else —
                  // does not exist on the pointer that reaches this width.
                  expanded
                    ? "rotate-180 opacity-100"
                    : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                )}
                aria-hidden="true"
              />
            )}
          </span>
        </span>
      </div>

      {/* ── §R5-4 the expansion ───────────────────────────────────────────── */}
      {expanded && !selectMode && (
        <div
          // Margin 0, NOT -12px: the parent list already carries the negative margin, so a second
          // one made the panel 12px wider than its own row on each side — a visible step.
          className="relative -top-0.5 mb-0.5 rounded-b-[11px] bg-surface-thread pb-[18px] pl-[61px] pr-3 pt-0.5"
          data-testid="saved-row-detail"
        >
          <div className="flex flex-wrap gap-8 border-t border-white/[0.06] pt-3.5">
            {/* The band is NOT repeated here — the rail above already reads it, and this panel is
                part of the same visual unit. The expansion adds what the row cannot hold. */}
            <Fact k="Type" v={vm.typeLabel} />
            {vm.archetype && <Fact k={item.item_type === "read" ? "Audience" : "Archetype"} v={vm.archetype} />}
            {vm.rank != null && <Fact k="Ranked" v={`${vm.rank}`} />}
            {vm.shape && <Fact k="Shape" v={vm.shape} />}
            {vm.views && <Fact k="Views" v={vm.views} />}
            {sourceLabel && <Fact k="Saved from" v={sourceLabel} />}
            <Fact k="Project" v={projectName ?? "Unfiled"} />
          </div>

          {vm.why && (
            <p className="mt-4 max-w-[62ch] text-reading leading-[1.72] text-foreground-secondary">
              {vm.why}
            </p>
          )}
          {vm.quote && (
            <p className="mt-3.5 max-w-[60ch] border-l-2 border-white/[0.10] pl-3 text-reading italic leading-[1.65] text-foreground-muted">
              &ldquo;{vm.quote}&rdquo;
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {forward && (
              <DetailButton primary onClick={() => void handleForward()} disabled={launching}>
                {launching ? "Launching…" : `${forward.label} →`}
              </DetailButton>
            )}
            {onOpenThread && (
              <DetailButton onClick={onOpenThread}>Open the thread</DetailButton>
            )}
            <span className="flex-1" />
            <DetailButton bare onClick={onMoveToProject}>
              Move to project
            </DetailButton>
            {/* §R5-5 named for what it does, in the error tone, past the neutral actions. */}
            <DetailButton bare danger onClick={onUnsave}>
              Unsave
            </DetailButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** One labelled fact in the expansion grid. */
function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-caption font-semibold uppercase tracking-[0.13em] text-foreground-muted">
        {k}
      </span>
      <span className="mt-1.5 block text-reading text-foreground">{v}</span>
    </span>
  );
}

function DetailButton({
  children,
  onClick,
  primary,
  bare,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  bare?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[8px] px-3 py-1.5 text-body transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        "disabled:opacity-60",
        bare
          ? "border border-transparent"
          : "border border-white/[0.06] hover:border-white/[0.10]",
        primary && "bg-surface text-foreground",
        danger ? "text-[color:var(--color-error)] hover:bg-white/[0.04]" : !primary && "text-foreground-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
