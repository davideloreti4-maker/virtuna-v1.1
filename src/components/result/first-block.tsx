"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RADIUS, TILE } from "./player";

/**
 * The result's first block as layout parts with slots. The result and the screen shown while it
 * simulates are both drawn through them, so the wait cannot stand anywhere the result does not and the
 * result takes its place without a jump. Every size of that block is written here, once.
 *
 * Phone (`FirstCard`): one card. The 9:16 tile centred; 16 under it the line under the tile (the count,
 * or the wait's words); 14 under that a hairline and 30 over the plot; the plot, the strip and the two
 * times (`LineFrame`).
 *
 * Wide window (`WideFrame`, the mock's `simD` and `.desk` rules): a 980 grid centred in the content
 * area, 32 under the header row. Left the tile (372) and 18 under it its line; 20 to its right a 588
 * column with 16 between its parts: the sentence's card, "After posting", the line's card, the rest
 * (the switch and the panel).
 */

/** The plot's height: 100 in the phone's card, 104 in the wide window's line card. */
export const PLOT_PX = { phone: 100, wide: 104 } as const;
/** Between two tiles of the strip. */
export const STRIP_GAP_PX = 3;
/** The strip's height: 38, and 46 on a line wider than 400 (a wide window). */
export const stripHeight = (width: number): number => (width > 400 ? 46 : 38);
/** How a scene's frame is cropped in a strip tile (the result's strip and the wait's). */
export const STRIP_CROP = "object-cover object-[50%_14%]";
/** A strip tile's surface: the result's scenes and the wait's empty tiles. */
export const STRIP_TILE = "rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]";
/** The phone's line before its card is measured: a 393 phone (the card's inside, 361 less 2 × 14). */
export const PHONE_LINE_FALLBACK = 333;
/** The wide window's line before its card is measured (588 less 2 × 24). */
export const WIDE_LINE_FALLBACK = 540;
/**
 * The phone's column: 16 at the sides; the first card 9 into <main> (main reserves the header's band,
 * 46, and the 40 header sits centred in it, so the card lands 12 under the header, as in the mock).
 */
export const PHONE_COLUMN = "px-4 pt-[9px] pb-[calc(env(safe-area-inset-bottom)+40px)]";
/** The column's top, in px: where the pinned player sits under the header band. */
export const PHONE_TOP_PX = 9;

/** The line under the tile: at least one line of the count (its number is 30), centred. */
// A container: what stands in it (the count) lays itself out for this box's width, not the window's.
const UNDER = "@container flex min-h-[34px] items-center justify-center";

/**
 * How the line under the tile lays out its two parts (the count's number and words; while a run is
 * in flight the words and the clock): on one baseline, centred, from a box of 290; in a narrower one
 * (a 320 phone) the second part always stands under the first, so the box is as tall in every state
 * and nothing under it moves. The first part is 25 tall in both uses (`UNDER_FIRST_LINE`).
 */
export const UNDER_LINE =
  "flex flex-col items-center text-center @min-[290px]:flex-row @min-[290px]:items-baseline @min-[290px]:justify-center @min-[290px]:gap-x-2";
export const UNDER_FIRST_LINE = "leading-[25px]";

/**
 * Phone or wide window, and whether the window has been measured yet (`useIsMobileHydrated`). The page
 * measures once and hands it to whichever of its bodies is showing: a body that measured for itself
 * would show the loading frame for one paint each time it takes another's place.
 */
export interface Viewport {
  isMobile: boolean;
  hydrated: boolean;
}
/** The sentence's card at rest: the moment's frame (114 tall) and the card's padding (2 × 22). */
const SENTENCE_CARD_MIN = "min-h-[158px]";

interface FirstCardProps {
  /** The card's `data-result`: "hero" for the result, "running" while it simulates. */
  name?: string;
  cardRef?: React.Ref<HTMLDivElement>;
  /** The 9:16 tile, as wide as its box: 53% of the card's inside, never under 140 or over 200. */
  tile: React.ReactNode;
  /** 16 under the tile: the count, or the wait's words. */
  under: React.ReactNode;
  /** Under the hairline: a `LineFrame`. */
  line: React.ReactNode;
}

/** Phone: the first card. */
export function FirstCard({ name, cardRef, tile, under, line }: FirstCardProps) {
  return (
    <Card ref={cardRef} data-result={name} className="px-3.5 pb-3 pt-5">
      <div data-part="tile-box" className="mx-auto w-[clamp(140px,53%,200px)]">
        {tile}
      </div>
      <div data-part="under" className={cn("mt-4", UNDER)}>
        {under}
      </div>
      <div data-part="line-box" className="mt-3.5 border-t border-border pt-[30px]">
        {line}
      </div>
    </Card>
  );
}

interface LineFrameProps {
  /** The plot's width; without it the frame is as wide as its box (the loading frame). */
  width?: number;
  /** The plot's height (`PLOT_PX`). */
  height: number;
  /** The box around the plot and the strip: the result's slider (role, keys, pointer), or nothing. */
  box?: React.HTMLAttributes<HTMLDivElement>;
  plotRef?: React.Ref<HTMLDivElement>;
  /** The plot's `data-result` ("curve" on the result). */
  plotName?: string;
  plot?: React.ReactNode;
  /** 8 under the plot; null: no strip. */
  strip: React.ReactNode | null;
  stripClassName?: string;
  /** The two times under it all; null: the row keeps its height and shows nothing. */
  times: readonly [string, string] | null;
}

/** The plot, the strip and the two times: the result's line, and the place the wait keeps for it. */
export function LineFrame({ width, height, box = {}, plotRef, plotName, plot, strip, stripClassName, times }: LineFrameProps) {
  const { className: boxClassName, ...boxProps } = box;
  return (
    <div data-part="line-frame" style={width === undefined ? undefined : { width }}>
      <div {...boxProps} className={cn("relative rounded-md", boxClassName)}>
        <div ref={plotRef} data-result={plotName} data-part="plot" className="relative" style={{ height }}>
          {plot}
        </div>
        {strip !== null && (
          <div data-part="strip-slot" className={cn("pointer-events-none mt-2", stripClassName)}>
            {strip}
          </div>
        )}
      </div>
      <div
        data-part="times"
        className={cn(
          "flex h-[21px] justify-between text-label leading-[21px] text-foreground-muted tabular-nums",
          strip !== null ? "mt-0.5" : "mt-1",
        )}
      >
        {times && (
          <>
            <span>{times[0]}</span>
            <span>{times[1]}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface WideFrameProps {
  /** The root's `data-result` ("running" while it simulates). */
  name?: string;
  /** The left column's 9:16 tile, as wide as the column. */
  tile: React.ReactNode;
  /** 18 under the tile, centred on it: the count, or the wait's words. */
  under: React.ReactNode;
  /** The right column's first card: the sentence alone; nothing while it simulates. */
  first: React.ReactNode;
  firstClassName?: string;
  /** Under the first card ("After posting"); not drawn when undefined, no room while empty. */
  after?: React.ReactNode;
  afterClassName?: string;
  lineCardRef?: React.Ref<HTMLDivElement>;
  /** The line's card: a `LineFrame`. */
  line: React.ReactNode;
  /** Under the line's card (the switch and the panel); not drawn when undefined. */
  rest?: React.ReactNode;
  restClassName?: string;
}

/** Wide window: the two columns. */
export function WideFrame({
  name,
  tile,
  under,
  first,
  firstClassName,
  after,
  afterClassName,
  lineCardRef,
  line,
  rest,
  restClassName,
}: WideFrameProps) {
  return (
    <div data-result={name} className="px-8 pb-12 pt-8">
      <div className="mx-auto grid max-w-[980px] grid-cols-[minmax(0,372fr)_minmax(0,588fr)] items-start gap-5">
        <div data-part="tile-column" className="min-w-0">
          {tile}
          <div data-part="under" className={cn("mt-[18px]", UNDER)}>
            {under}
          </div>
        </div>
        <div className="@container flex min-w-0 flex-col gap-4">
          <Card
            data-result="sentence-card"
            className={cn("flex items-center p-[22px] @min-[460px]:pr-[30px]", SENTENCE_CARD_MIN)}
          >
            {first != null && <div className={cn("w-full min-w-0", firstClassName)}>{first}</div>}
          </Card>
          {after !== undefined && (
            <div data-part="after" className={cn("empty:hidden", afterClassName)}>
              {after}
            </div>
          )}
          <Card ref={lineCardRef} data-part="line-card" className="px-6 pb-3.5 pt-8">
            {line}
          </Card>
          {rest !== undefined && <div className={cn("flex flex-col gap-4", restClassName)}>{rest}</div>}
        </div>
      </div>
    </div>
  );
}

/** An empty box of the strip's height. */
function EmptyStrip({ width }: { width: number }) {
  return <div style={{ height: stripHeight(width) }} />;
}

/**
 * The page's frame with empty boxes and no text: shown while the row loads, and for the one frame
 * before the viewport is measured (so the video is mounted once, in the right layout). The first
 * block's boxes are the result's own, so the result lands in them; on a phone one empty card stands
 * for what comes under the first.
 */
export function ResultFrame() {
  return (
    <div aria-busy="true">
      <div className={cn(PHONE_COLUMN, "md:hidden")}>
        <FirstCard
          tile={<div className={cn(TILE, "w-full bg-surface-sunken", RADIUS.hero)} />}
          under={null}
          line={<LineFrame height={PLOT_PX.phone} strip={<EmptyStrip width={PHONE_LINE_FALLBACK} />} times={null} />}
        />
        <Card className="mt-5 h-[350px]" />
      </div>
      <div className="hidden md:block">
        <WideFrame
          tile={<div className={cn(TILE, "w-full bg-surface-sunken", RADIUS.desktop)} />}
          under={null}
          first={null}
          line={<LineFrame height={PLOT_PX.wide} strip={<EmptyStrip width={WIDE_LINE_FALLBACK} />} times={null} />}
        />
      </div>
    </div>
  );
}
