"use client";

import { Card } from "@/components/ui/card";
import { OPENING_S, countAt, endCount, formatCount, pastOpening } from "@/lib/result/count";
import { timecode } from "@/lib/result/format";
import { barLength, mostLikely } from "@/lib/result/most-likely";
import type { Intent, VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { INTENT_GLYPHS } from "./engagement-icons";
import { usePlayhead } from "./playhead";

/**
 * Engagement: two cards, 10 apart on the phone and 16 on desktop.
 *
 * "Of 1,000 viewers": counts of the simulated audience (past the first 3 seconds, watched to the end)
 * and the average watch with its bar. Away from rest a sunken row says how many are still watching at
 * the video's moment, and a coral marker stands on the bar there: besides the named scene, the video's
 * moment is the one thing coral marks. At rest both are gone.
 *
 * "What viewers are likely to do": the four actions, longest bar first, no numbers and no verdict
 * words (the intent value is the engine's 0 to 100 index, not a share of viewers). The single highest
 * carries "Most likely"; a tie for the highest names none.
 */
export function EngagementPanel({ model }: { model: VideoModel }) {
  return (
    <div data-result="engagement" className="flex flex-col gap-2.5 md:gap-4">
      <OfViewers model={model} />
      {model.intents && <LikelyActions intents={model.intents} />}
    </div>
  );
}

/** Both cards' heading, at the same place in each card. */
const HEADING = "px-0.5 pb-[5px] pt-3 text-label font-[560] text-foreground-secondary";

/** A time of the clip as a share of its length, 0 to 100. */
const shareOf = (seconds: number, clipS: number) =>
  clipS > 0 ? Math.min(100, Math.max(0, (seconds / clipS) * 100)) : 0;

/**
 * A bar of the track's full length, filled in ink to `pct` (0 to 100), and, when given, a coral
 * marker at `marker` (0 to 100), 5 taller than the bar above and below. Decorative to readers.
 */
function Bar({
  pct,
  kind,
  marker = null,
  className,
}: {
  pct: number;
  kind: "avg-watch" | "intent";
  marker?: number | null;
  className?: string;
}) {
  return (
    <div data-bar={kind} aria-hidden="true" className={cn("relative h-2", className)}>
      <div className="h-full overflow-hidden rounded-full bg-track">
        <div data-fill className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      {marker !== null && (
        <span
          data-part="marker"
          className="absolute -top-[5px] h-[18px] w-0.5 -translate-x-1/2 rounded-full bg-below"
          style={{ left: `${marker}%` }}
        />
      )}
    </div>
  );
}

/** One row of the first card: its name left, its figure right, on one baseline. */
function Figure({ name, value, suffix, last = false }: { name: string; value: string; suffix?: string; last?: boolean }) {
  return (
    <div
      data-part="figure"
      className={cn("flex items-baseline justify-between gap-3", last ? "pb-1 pt-[9px]" : "border-b border-border py-[9px]")}
    >
      <dt className="text-ui text-foreground-secondary">{name}</dt>
      <dd className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-heading font-bold tracking-[-0.03em] text-foreground">{value}</span>
        {suffix && <span className="text-ui font-[560] text-foreground-secondary">{suffix}</span>}
      </dd>
    </div>
  );
}

/**
 * "Of 1,000 viewers": the heading, while the video is away from rest the Now row (10 under it, as
 * drawn), then the three figures and the average watch's bar.
 */
function OfViewers({ model }: { model: VideoModel }) {
  const { t, resting } = usePlayhead();
  const { audience, avgWatchS, clipS } = model;
  const watching = resting ? null : countAt(audience, t, false).n;
  return (
    <Card data-result="of-viewers" className="px-[18px] pb-[18px] pt-1.5 md:px-[22px] md:pt-2">
      <h2 className={HEADING}>Of 1,000 viewers</h2>
      {watching !== null && (
        <p
          data-part="now"
          // One line from a panel of 310; in a narrower one (a 320 phone) the count always stands
          // under the time, so the row is as tall at 1,000 as at 99.
          className="mb-2.5 mt-1 flex flex-col gap-0.5 rounded-xl bg-surface-sunken px-3 py-2.5 text-ui text-foreground-secondary @min-[310px]:flex-row @min-[310px]:items-baseline @min-[310px]:justify-between @min-[310px]:gap-3"
        >
          <span className="tabular-nums">Now, at {timecode(t)}</span>
          <span className="whitespace-nowrap">
            <span className="text-title font-bold text-foreground tabular-nums">{formatCount(watching)}</span> still watching
          </span>
        </p>
      )}
      <dl className="mt-1">
        {/* A clip that ends before 0:03 has no such moment: the row would repeat the end's count under a name that is not true. */}
        {clipS >= OPENING_S && <Figure name="Past the first 3 seconds" value={formatCount(pastOpening(audience))} />}
        <Figure name="Watched to the end" value={formatCount(endCount(audience))} />
        <Figure name="Average watch" value={timecode(avgWatchS)} suffix={`of ${timecode(clipS)}`} last />
      </dl>
      <Bar
        kind="avg-watch"
        pct={shareOf(avgWatchS, clipS)}
        marker={watching === null ? null : shareOf(t, clipS)}
        className="mt-1"
      />
    </Card>
  );
}

/**
 * "What viewers are likely to do" (`.en-c`, `.en-h`, `.en-r.ra`): the heading, then one row per
 * action, longest bar first, hairlines between the rows. A row: the glyph (18, secondary), the label
 * (76 wide), the bar (`barLength`: a near-zero action still shows a stub), and on the row with the
 * single longest bar "Most likely" at its right end. The other rows keep the tag's room empty:
 * all four tracks are the same length, or the most likely action would get the shortest bar. Without
 * a tag the tracks run to the card's edge. Rows are 56 tall on the phone and 50 on desktop.
 */
const TAG = "shrink-0 rounded-full bg-action px-2 text-label font-[560] leading-5 text-action-foreground";

function LikelyActions({ intents }: { intents: Intent[] }) {
  const top = mostLikely(intents);
  return (
    <Card data-result="intents" className="px-[18px] pb-2.5 pt-1.5 md:px-[22px] md:pt-2">
      <h2 className={HEADING}>What viewers are likely to do</h2>
      <ol aria-label="Most likely first">
        {intents.map((intent, i) => {
          const Glyph = INTENT_GLYPHS[intent.id];
          return (
            <li
              key={intent.id}
              className={cn("flex h-14 items-center gap-3 md:h-[50px]", i > 0 && "border-t border-border")}
            >
              <Glyph size={18} className="shrink-0 text-foreground-secondary" />
              <span className="w-[76px] shrink-0 text-ui font-[560] text-foreground">{intent.label}</span>
              <Bar kind="intent" pct={barLength(intent.value)} className="min-w-0 flex-1" />
              {top !== null &&
                (intent.id === top ? (
                  <span data-part="most-likely" className={TAG}>
                    Most likely
                  </span>
                ) : (
                  // The tag's room in the other rows, so every track is the same length and the bars
                  // compare. Its words are drawn by CSS only: nothing for a reader, nothing to copy.
                  <span
                    data-part="most-likely-room"
                    aria-hidden="true"
                    className={cn(TAG, "invisible after:content-['Most_likely']")}
                  />
                ))}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
