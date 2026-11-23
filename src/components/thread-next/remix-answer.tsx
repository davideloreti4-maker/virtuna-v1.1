"use client";

import { useState } from "react";

import { BackIcon } from "@/components/shell/icons";
import { formatCount } from "@/lib/competitors-utils";
import { creditCost } from "@/lib/pricing";
import type { HookProof, RemixCardBlock } from "@/lib/tools/blocks";
import { formatSteps } from "@/lib/thread-next/remix-steps";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerPrimary, PROSE, keepHyphens } from "./answer-card";
import { GaugeSlot, type GaugeState } from "./answer-gauge";
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
 * - The one primary "Script it" · "2 credits": `onScript(adaptedHook)` of the page shown.
 * - Two or more remixes: the card is named "Remix 2 of 3" and a pager closes it, the dots (the
 *   current one in ink) between "Previous" and "Next" (44 to tap, disabled at either end). Built:
 *   "Remix 2 of 3" in words between the arrows instead of the dots.
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

/**
 * What the multiplier is measured against, in the card's words. The stored `baselineLabel` is never
 * printed: the runners write "vs their usual views" (`blocks.ts`), and spec §3.3 bans "usual". It is
 * read for its meaning only: a usual / average / median / typical baseline is "their average", a
 * follower baseline "their followers", anything else (or none) no basis at all.
 */
function basisOf(label: string | null | undefined): string | null {
  const l = label?.toLowerCase() ?? "";
  if (/usual|average|median|typical/.test(l)) return "their average";
  if (/follower/.test(l)) return "their followers";
  return null;
}

/** "5.2×" under ten, "40×" from ten: a decimal on a two-digit multiplier says nothing ("40.2×"). */
function timesLabel(m: number): string {
  return `${m >= 10 ? Math.round(m) : Number(m.toFixed(1))}×`;
}

/** `formatCount` without a decimal from 100K ("849K", not "849.1K"); below that and for millions as it is. */
function viewsLabel(views: number): string {
  return views >= 100_000 && views < 1_000_000 ? `${Math.round(views / 1000)}K` : formatCount(views);
}

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

/** The headline as drawn, in curly quotes; quotes the text already carries are not doubled. */
function quoted(text: string): string {
  return `“${text.trim().replace(/^["“]+|["”]+$/g, "")}”`;
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

function SourceRow({ proof, coverUrl }: { proof: HookProof; coverUrl: string | null }) {
  const handle = proof.handle.trim().replace(/^@+/, "");
  const stats = proofStats(proof);
  return (
    <div className="mt-2.5 flex items-center gap-[11px] rounded-xl bg-foreground/5 p-2.5">
      <ProofCover src={proof.coverUrl ?? coverUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-reading font-[620] leading-[21px] text-foreground">@{handle}</p>
        {stats && <p className="text-meta leading-[21px] text-foreground-secondary tabular-nums">{stats}</p>}
      </div>
    </div>
  );
}

function Pager({ index, count, onPage }: { index: number; count: number; onPage: (next: number) => void }) {
  const arrow =
    "tap-44 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-150 hover:text-foreground focus-visible:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:text-foreground-secondary";
  return (
    <div className="-mb-2 mt-1.5 flex items-center justify-center gap-1">
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

export function RemixAnswer({
  items,
  hookOf,
  onScript,
}: {
  items: RemixCardBlock[];
  /** The adapted hook's gauge: its state, what a tap on the empty slot does, and its result page (step 2). */
  hookOf: (adaptedHook: string) => { state: GaugeState; onSimulate?: () => void; href?: string | null };
  onScript?: (adaptedHook: string) => void;
}) {
  const [page, setPage] = useState(0);
  const index = Math.max(0, Math.min(page, items.length - 1));
  const item = items[index];
  if (!item) return null;

  const { adaptedHook, formatBorrowed, proof, coverUrl } = item.props;
  const hook = hookOf(adaptedHook);
  const steps = formatSteps(formatBorrowed);
  const paged = items.length > 1;

  const body = (
    <>
      {proof && <SourceRow proof={proof} coverUrl={coverUrl ?? null} />}
      <p
        className={cn(
          "px-0.5 pb-1 text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground",
          proof ? "pt-3.5" : "pt-2.5",
          PROSE,
        )}
      >
        {keepHyphens(quoted(adaptedHook))}
      </p>
      <GaugeSlot
        state={hook.state}
        label="Simulate the hook"
        text={adaptedHook}
        onSimulate={hook.onSimulate}
        href={hook.href ?? null}
        className="mt-0.5"
      />
      {steps.length > 0 && (
        <ol
          data-part="steps"
          className={cn(
            "m-0 grid list-none gap-x-3 gap-y-1.5 px-0.5 pb-0.5 pt-2.5",
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
      <div className="mt-3.5 md:mt-5">
        <AnswerPrimary
          icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
          label="Script it"
          price={SCRIPT_PRICE}
          onClick={onScript ? () => onScript(adaptedHook) : undefined}
        />
      </div>
    </>
  );

  return (
    <AnswerCard>
      {paged ? (
        <section aria-label={`Remix ${index + 1} of ${items.length}`}>
          {body}
          <Pager index={index} count={items.length} onPage={setPage} />
        </section>
      ) : (
        body
      )}
    </AnswerCard>
  );
}
