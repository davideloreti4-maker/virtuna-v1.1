"use client";

import type { ScriptCardBlock } from "@/lib/tools/blocks";
import { clockLabel, timingEnd, timingStart } from "@/lib/thread-next/beat-timing";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, CardHeader, PROSE, keepHyphens } from "./answer-card";
import { GaugeSlot, type GaugeState } from "./answer-gauge";
import { UploadIcon } from "./answer-icons";

/**
 * The script card (spec §4.3; drawing `.scratch/next-look/part3/answers/answers.html`, `axScript`,
 * `.tq-beat`, `.ax-b0`, `.ax-slot`): one card, the beats on a time rail.
 *
 * - Header "Script" and, when the last beat's timing has an end, the total ("0:24").
 * - A beat: its start ("0:03") when its timing parses, else no time; the rail; its `content`.
 * - Under the opening beat the slot "Simulate the opening" · "1 credit" (`GaugeSlot`): the text it
 *   simulates is `openingBeatSeed`, else the first beat's content (the text today's door fires and
 *   looks its seal up by). Simulated: the gauge with its number and "would stop to watch".
 * - The one primary "Add your take" (upload icon, free, the arrow).
 *
 * Geometry as drawn: rows 2 / 2 on a 28 · 3 · 1fr grid 10 apart; the time 12 / 21 in the muted ink
 * 6 down; the rail 3 wide on 13% of the ink; the text 15 / 21, 6 above and 8 under (the opening's
 * 2 under, then the 40 slot and 4). The header's "Script" 14 / 640 in ink (`.tq-h b`).
 */
export function ScriptAnswer({
  block,
  opener,
  onAddTake,
}: {
  block: ScriptCardBlock;
  opener: { state: GaugeState; onSimulate?: () => void };
  onAddTake?: () => void;
}) {
  const { beats, openingBeatSeed } = block.props;
  const last = beats[beats.length - 1];
  const end = last ? timingEnd(last.timing) : null;
  const openingText = openingBeatSeed || beats[0]?.content || "";

  return (
    <AnswerCard>
      <CardHeader
        left={<b className="block text-reading font-[640] leading-[21px] text-foreground">Script</b>}
        right={end !== null ? clockLabel(end) : undefined}
      />
      <ol className="m-0 list-none p-0">
        {beats.map((beat, i) => {
          const start = timingStart(beat.timing);
          return (
            <li key={i} data-part="beat" className="grid grid-cols-[28px_3px_minmax(0,1fr)] gap-x-2.5 p-0.5">
              <span data-part="time" className="pt-1.5 text-label leading-[21px] text-foreground-muted tabular-nums">
                {start !== null ? clockLabel(start) : ""}
              </span>
              <i aria-hidden className="block rounded-full bg-foreground/13" />
              <div className={cn("min-w-0", PROSE)}>
                <p className={cn("text-pretty text-ui leading-[21px] text-foreground", i === 0 ? "pb-0.5 pt-1.5" : "pb-2 pt-1.5")}>
                  {keepHyphens(beat.content)}
                </p>
                {i === 0 && (
                  <GaugeSlot
                    state={opener.state}
                    label="Simulate the opening"
                    text={openingText}
                    onSimulate={opener.onSimulate}
                    className="mb-1"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <AnswerFoot>
        <AnswerPrimary
          icon={<UploadIcon size={20} aria-hidden className="shrink-0" />}
          label="Add your take"
          onClick={onAddTake}
          trailingArrow
        />
      </AnswerFoot>
    </AnswerCard>
  );
}
