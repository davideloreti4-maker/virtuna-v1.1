"use client";

import { Card } from "@/components/ui/card";
import { timecode } from "@/lib/result/format";
import type { Intent, VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { INTENT_GLYPHS } from "./engagement-icons";

/**
 * Engagement (spec §5, plan Task 5; the mock's `engTiles` and `actCard`, RUN branches).
 *
 * Two cards, 10 apart on the phone and 16 on desktop. Neither moves with the playhead: the engine
 * has nothing per moment for them, so this panel does not read it.
 *
 * Bars are ink on the track, 8 tall and fully round. No coral, no numbers on the bars and no verdict
 * words: the intent value is the engine's 0 to 100 index, not a share of viewers, and the engine has
 * no threshold for "low" or "high". The rows' order says which is most likely.
 */
export function EngagementPanel({ model }: { model: VideoModel }) {
  return (
    <div data-result="engagement" className="flex flex-col gap-2.5 md:gap-4">
      <AvgWatch avgWatchS={model.avgWatchS} clipS={model.clipS} />
      {model.intents && <LikelyActions intents={model.intents} />}
    </div>
  );
}

/** A bar of the track's full length, filled in ink to `pct` (0 to 100). Decorative to readers. */
function Bar({ pct, kind, className }: { pct: number; kind: "avg-watch" | "intent"; className?: string }) {
  return (
    <div data-bar={kind} aria-hidden="true" className={cn("h-2 overflow-hidden rounded-full bg-track", className)}>
      <div data-fill className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * "Avg watch": the label left, the time right on the same baseline with "of 0:29" beside it, and
 * under them a bar as long as the clip filled to the average watch (`.aw`: padding 16/18/18,
 * the bar 12 under the row).
 */
function AvgWatch({ avgWatchS, clipS }: { avgWatchS: number; clipS: number }) {
  const pct = clipS > 0 ? Math.min(100, Math.max(0, (avgWatchS / clipS) * 100)) : 0;
  return (
    <Card data-result="avg-watch" className="px-[18px] pb-[18px] pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ui text-foreground-secondary">Avg watch</span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-3xl font-bold leading-[25px] tracking-[-0.04em] text-foreground">
            {timecode(avgWatchS)}
          </span>
          <span className="text-ui font-[560] text-foreground-secondary">of {timecode(clipS)}</span>
        </span>
      </div>
      <Bar kind="avg-watch" pct={pct} className="mt-3" />
    </Card>
  );
}

/**
 * "What viewers are likely to do" (`.en-c`, `.en-h`, `.en-r.ra`): the heading, then one row per
 * action, longest bar first, hairlines between the rows. A row: the glyph (18, secondary), the label
 * (76 wide), the bar to the card's edge, `max(4, round(value))`% long so a near-zero action still
 * shows a stub. Rows are 56 tall on the phone and 50 on desktop.
 */
function LikelyActions({ intents }: { intents: Intent[] }) {
  return (
    <Card data-result="intents" className="px-[18px] pb-2.5 pt-1.5 md:px-[22px] md:pt-2">
      <h2 className="px-0.5 pb-[5px] pt-3 text-label font-[560] text-foreground-secondary">
        What viewers are likely to do
      </h2>
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
              <Bar kind="intent" pct={Math.max(4, Math.round(intent.value))} className="min-w-0 flex-1" />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
