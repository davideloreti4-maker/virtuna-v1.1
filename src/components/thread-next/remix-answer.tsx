"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { BackIcon } from "@/components/shell/icons";
import { basisOf, timesLabel, viewsLabel } from "@/lib/multiple-words";
import { creditCost } from "@/lib/pricing";
import type { HookProof, RemixCardBlock } from "@/lib/tools/blocks";
import { landStyle } from "@/lib/thread-next/landing";
import { remixBeatsOf, remixFilmOf, type RemixBeatRow, type RemixFilm } from "@/lib/thread-next/remix-film";
import { formatSteps } from "@/lib/thread-next/remix-steps";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerPrimary, PROSE, keepHyphens } from "./answer-card";
import { GaugeSlot, type GaugeState } from "./answer-gauge";
import { WithFilmButton } from "./film-button";
import { RemixFilmSheet, quoted } from "./film-sheet";
import { ChevronIcon, DocIcon } from "./field-icons";

/**
 * The remix card (spec §4.4; drawing `.scratch/next-look/part3/answers/answers.html`, `axRemix`,
 * `.src.ax-rsrc`, `.ax-rh`, `.ax-slot`, `.ax-steps`; the pager is v11's `.tq-pg`): one card for a
 * run of remix blocks, with a pager when there are several.
 *
 * - The source row: the cover (`proof.coverUrl`, else the card's `coverUrl`; a plain tile when
 *   there is none or it fails to load), "@handle", and "{multiplier}× {basis} · {views} views"
 *   (the basis read from the stored label, never printed as stored: `basisOf`)
 *   when the receipt carries a multiplier, else "{views} views". Handles are stored without "@".
 * - The adapted hook in quotes as the headline; under it the slot "Simulate the hook" · "1 credit"
 *   (`GaugeSlot`, the text `adaptedHook`).
 * - The borrowed format as up to four numbered steps (`formatSteps`) on grey discs: two columns
 *   while every step is a short label, one column on a phone when any is longer (review
 *   2026-11-23: real step names wrapped and left the grid ragged).
 * - The one primary "Script it" · "2 credits": `onScript(adaptedHook)` of the page shown. With it,
 *   when the page has a decode or a plan (`remixFilmOf`), the quiet "How to film it" (second part
 *   §4, `WithFilmButton`, as on the script card), which opens that page's sheet (`RemixFilmSheet`).
 *   The page's beats are read when its sheet first opens, once (`loadBeats`, the blueprint route by
 *   default), only for a page with a `blueprintId`.
 * - Two or more remixes: the card is named "Remix 2 of 3" and a pager closes it, the dots (the
 *   current one in ink) between "Previous" and "Next" (44 to tap, disabled at either end). Built:
 *   "Remix 2 of 3" in words between the arrows instead of the dots.
 * - In a landing (thread feel §4.3, `[data-thread-landing] .land`): the source row, the headline, the slot,
 *   the steps, the button (with "How to film it") and the pager come in one after another
 *   (`remixLands`). The card itself takes its height at once.
 *
 * Geometry as drawn: the source row 10 under the card's top padding, 10 inside, radius 16 (drawn
 * 18), 5% of the ink, the cover 40 × 56 at radius 8 (drawn 9), 11 to the text (14 / 620 and 13 in
 * the secondary ink, both on 21 lines); the headline 14 above and 4 under, 18 / 26 at 620 (drawn
 * 19); the slot 2 under it; the steps two columns 12 apart, rows 26 tall 6 apart, 10 above, discs
 * 20 on the sunken tint; the primary 14 under the steps (20 on a desk, as the other cards).
 */

const SCRIPT_PRICE = creditCost("script");

/** A step this long or shorter fits half the phone's card on one line ("The shot", "Visual Hook"). */
const SHORT_STEP = 14;

/** "10× their average · 154K views", "5.2× · 21K views", "21K views", or null when it has neither. */
export function proofStats(proof: HookProof): string | null {
  const parts: string[] = [];
  const m = proof.multiplier;
  if (typeof m === "number" && Number.isFinite(m)) {
    const basis = basisOf(proof.baselineLabel);
    parts.push(`${timesLabel(m)}${basis ? ` ${basis}` : ""}`);
  }
  if (typeof proof.views === "number" && Number.isFinite(proof.views)) parts.push(`${viewsLabel(proof.views)} views`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ProofCover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <span data-part="cover" className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
      {show && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored cover address (it can expire); next/image has nothing to optimise
        <img src={src} alt="" onError={() => setFailed(src)} className="block size-full object-cover" />
      )}
    </span>
  );
}

/**
 * The source row's markup: the cover, "@handle" and its stats. Shared with the remix's outline
 * (`answer-outline.tsx`), which draws the post the run fetched in it before the card exists.
 * `handle` null draws no handle line (an evidence item may carry a picture only).
 */
export function SourceRowView({
  cover,
  handle,
  stats,
  className,
  style,
}: {
  cover: string | null;
  handle: string | null;
  stats: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("mt-2.5 flex items-center gap-[11px] rounded-xl bg-foreground/5 p-2.5", className)} style={style}>
      <ProofCover src={cover} />
      <div className="min-w-0 flex-1">
        {handle !== null && <p className="truncate text-reading font-[620] leading-[21px] text-foreground">@{handle}</p>}
        {stats && <p className="text-meta leading-[21px] text-foreground-secondary tabular-nums">{stats}</p>}
      </div>
    </div>
  );
}

function SourceRow({ proof, coverUrl, className, style }: { proof: HookProof; coverUrl: string | null; className?: string; style?: CSSProperties }) {
  const handle = proof.handle.trim().replace(/^@+/, "");
  return <SourceRowView cover={proof.coverUrl ?? coverUrl} handle={handle} stats={proofStats(proof)} className={className} style={style} />;
}

/**
 * The beats of a remix's blueprint, from the route the old card read (`GET /api/remix/blueprint/[id]`):
 * its answer as sent. The `loadBeats` contract: a read that failed (a network error, an answer that is
 * not ok) rejects, and is tried again on the next open; whatever it resolves to is an answer, read by
 * `remixBeatsOf` (beats or none) and not asked again (spec §4 point 2).
 */
export async function readBlueprint(blueprintId: string): Promise<unknown> {
  const res = await fetch(`/api/remix/blueprint/${encodeURIComponent(blueprintId)}`);
  if (!res.ok) throw new Error(`blueprint read: ${res.status}`);
  return res.json();
}

/** What a read found is kept under its blueprint and the card's variant (one blueprint serves a run's pages). */
function readKey(film: RemixFilm): string | null {
  return film.blueprintId === null ? null : `${film.blueprintId}#${film.variant}`;
}

/**
 * "Script it" and, when the page has notes, "How to film it" with its sheet: one page's, keyed by
 * page and read key, so a read that answers after the page changed or the card went away finds this
 * part gone and sets nothing. What a read that answered found is kept by the card, by blueprint and
 * variant (`read`, `onRead`), so going back to a page does not read it again. A read dropped that way
 * is not kept, nor is one that failed: the next open reads again.
 */
function RemixFoot({
  film,
  primary,
  read,
  onRead,
  loadBeats,
}: {
  film: RemixFilm | null;
  primary: React.ReactNode;
  /** The beats this page's read found, once it has settled. */
  read: readonly RemixBeatRow[] | undefined;
  onRead: (rows: readonly RemixBeatRow[]) => void;
  loadBeats: (blueprintId: string) => Promise<unknown>;
}) {
  // Whether the sheet is open (null until the first press, so a card never pressed carries none), the
  // button it hands the focus back to, and whether the read is running.
  const [open, setOpen] = useState<boolean | null>(null);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!film) return primary;
  const id = film.blueprintId;

  const openSheet = () => {
    setOpen(true);
    if (id === null || read !== undefined || pending) return;
    setPending(true);
    // A reader that throws at once counts as a read that failed.
    new Promise<unknown>((resolve) => resolve(loadBeats(id))).then(
      (answer) => {
        if (!mounted.current) return;
        setPending(false);
        onRead(remixBeatsOf(answer, film.variant));
      },
      () => {
        // Failed: no rows now, and nothing kept, so the next open reads again.
        if (!mounted.current) return;
        setPending(false);
      },
    );
  };

  return (
    <>
      <WithFilmButton primary={primary} expanded={open === true} onOpen={openSheet} buttonRef={setButton} />
      {open !== null && (
        <RemixFilmSheet film={film} beats={pending ? "pending" : (read ?? [])} open={open} onOpenChange={setOpen} returnFocus={button} />
      )}
    </>
  );
}

function Pager({ index, count, onPage, style }: { index: number; count: number; onPage: (next: number) => void; style?: CSSProperties }) {
  const arrow =
    "tap-44 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-150 hover:text-foreground focus-visible:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:text-foreground-secondary";
  return (
    <div className="land -mb-2 mt-1.5 flex items-center justify-center gap-1" style={style}>
      <button type="button" aria-label="Previous" disabled={index === 0} onClick={() => onPage(index - 1)} className={arrow}>
        <BackIcon size={18} strokeWidth={2.1} aria-hidden />
      </button>
      {/* Says what the arrows page through; three bare dots did not (critic 2026-11-23). The section
          is named the same for a screen reader, so this one is hidden from it. */}
      <span aria-hidden data-part="pager-label" className="px-1.5 text-meta font-[560] text-foreground-secondary tabular-nums">
        Remix {index + 1} of {count}
      </span>
      <button type="button" aria-label="Next" disabled={index === count - 1} onClick={() => onPage(index + 1)} className={arrow}>
        <ChevronIcon size={18} strokeWidth={2.1} aria-hidden />
      </button>
    </div>
  );
}

/**
 * A remix page's places in a landing (thread feel §4.3), one after another in the card's order: the
 * source row, the headline, the slot, the steps, the button, the pager; a part the page does not
 * have takes no place. `last` is the place of the card's last part.
 */
export function remixLands(item: RemixCardBlock, paged: boolean) {
  let next = 0;
  const source = item.props.proof ? next++ : null;
  const headline = next++;
  const slot = next++;
  const steps = formatSteps(item.props.formatBorrowed).length > 0 ? next++ : null;
  const button = next++;
  const pager = paged ? next++ : null;
  return { source, headline, slot, steps, button, pager, last: next - 1 };
}

export function RemixAnswer({
  items,
  hookOf,
  onScript,
  loadBeats = readBlueprint,
}: {
  items: RemixCardBlock[];
  /** The adapted hook's gauge: its state, what a tap on the empty slot does, and its result page (step 2). */
  hookOf: (adaptedHook: string) => { state: GaugeState; onSimulate?: () => void; href?: string | null };
  onScript?: (adaptedHook: string) => void;
  /** Reads a page's beats for its "How to film it" (the blueprint route by default; a test or the dev page hands in an answer). */
  loadBeats?: (blueprintId: string) => Promise<unknown>;
}) {
  const [page, setPage] = useState(0);
  // What each read that answered found, by blueprint and variant (`readKey`): kept for the life of the card.
  const [reads, setReads] = useState<Readonly<Record<string, readonly RemixBeatRow[]>>>({});
  const index = Math.max(0, Math.min(page, items.length - 1));
  const item = items[index];
  if (!item) return null;

  const { adaptedHook, formatBorrowed, proof, coverUrl } = item.props;
  const hook = hookOf(adaptedHook);
  const steps = formatSteps(formatBorrowed);
  const paged = items.length > 1;
  const land = remixLands(item, paged);
  const film = remixFilmOf(item.props);
  const key = film ? readKey(film) : null;

  const body = (
    <>
      {proof && <SourceRow proof={proof} coverUrl={coverUrl ?? null} className="land" style={landStyle(land.source ?? 0)} />}
      <p
        className={cn(
          "land px-0.5 pb-1 text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground",
          proof ? "pt-3.5" : "pt-2.5",
          PROSE,
        )}
        style={landStyle(land.headline)}
      >
        {keepHyphens(quoted(adaptedHook))}
      </p>
      {/* One element whatever the slot is (a button, its gauge, its link), so its number is not
          landed again; a plain block, so the slot's own margin stays. */}
      <div className="land" style={landStyle(land.slot)}>
        <GaugeSlot
          state={hook.state}
          label="Simulate the hook"
          text={adaptedHook}
          onSimulate={hook.onSimulate}
          href={hook.href ?? null}
          className="mt-0.5"
        />
      </div>
      {steps.length > 0 && (
        <ol
          data-part="steps"
          style={landStyle(land.steps ?? 0)}
          className={cn(
            "land m-0 grid list-none gap-x-3 gap-y-1.5 px-0.5 pb-0.5 pt-2.5",
            // Two columns as drawn while every step is a short label; a longer one would wrap in
            // half a phone's card and leave the grid ragged, so then one column (two from md).
            steps.every((step) => step.length <= SHORT_STEP) ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2",
          )}
        >
          {steps.map((step, i) => (
            <li key={i} className={cn("flex min-h-[26px] items-center gap-[9px] text-ui leading-5 text-foreground", PROSE)}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-bold leading-none tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="land mt-3.5 md:mt-5" style={landStyle(land.button)}>
        <RemixFoot
          // Per page, and per remix on it: a remix replaced in place starts with no read of its own running.
          key={`${index}:${key ?? ""}`}
          film={film}
          primary={
            <AnswerPrimary
              icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
              label="Script it"
              price={SCRIPT_PRICE}
              onClick={onScript ? () => onScript(adaptedHook) : undefined}
            />
          }
          read={key === null ? undefined : reads[key]}
          onRead={(rows) => {
            if (key !== null) setReads((r) => ({ ...r, [key]: rows }));
          }}
          loadBeats={loadBeats}
        />
      </div>
    </>
  );

  return (
    <AnswerCard>
      {paged ? (
        <section aria-label={`Remix ${index + 1} of ${items.length}`}>
          {body}
          <Pager index={index} count={items.length} onPage={setPage} style={landStyle(land.pager ?? 0)} />
        </section>
      ) : (
        body
      )}
    </AnswerCard>
  );
}
