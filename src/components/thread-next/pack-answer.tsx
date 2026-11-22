"use client";

import { creditCost } from "@/lib/pricing";
import { leadOf } from "@/lib/thread-next/pack-lead";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, CardHeader, PROSE, creditsLabel, keepHyphens } from "./answer-card";
import { PulseGlyph, SmallGauge, type GaugeState } from "./answer-gauge";
import { DocIcon } from "./field-icons";

/**
 * The hook pack and the idea pack (spec §4.1, §4.2; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axHooks` and `axIdeas`, `.tq-hook`, `.ax-gc`,
 * `.ax-best`, `.tq-prog`, `.tq-f`, `.ax-id`): one card, a gauge on every row.
 *
 * - Header "Would stop to watch", and "1 credit each" while any row is not simulated (empty).
 * - Rows: the gauge, then the text (a hook's line; an idea's title and its one grey line). No
 *   chevron: nothing opens from a row in step 1. A waiting row's text is in the secondary ink.
 * - "Best" under the leader's gauge only when every row is simulated and it leads by 10 or more
 *   (`leadOf`).
 * - The one primary: "Simulate all N" with "N credits" (N = the rows not simulated) while any row
 *   is empty ("Simulate the rest" once some are simulated); while a queue runs, a thin progress line and "2 of 3" instead; once every row is
 *   simulated, "Script the best" (a clear best) or "Script hook K" / "Script idea K" (K = the
 *   highest, the first on a tie), "2 credits". A row that is running or waiting outside a queue
 *   leaves the card without a primary until it lands.
 * - A failed row says "Couldn't simulate" under its text and keeps its empty gauge.
 *
 * Geometry as drawn: rows 10 / 2 with a hairline above each, the gauge column 5 between gauge and
 * pill, 13 to the text; hook text 15 / 20 at 520, an idea's title 15 / 20 at 620 and its line
 * 13 / 18 in the secondary ink (drawn 13.5), all in proportional figures with hyphenated words kept
 * whole (`PROSE`, `keepHyphens`); the primary 8 under the last row (20 on a desk, `AnswerFoot`);
 * the progress line 6 tall, 12 above it.
 */

export interface PackRow {
  /** The row's seal key (a hook's line, an idea's title): what `onSimulate` receives. */
  key: string;
  /** A hook's line, or an idea's title. */
  text: string;
  /** An idea's one grey line. */
  sub?: string | null;
  state: GaugeState;
  /** Its last simulation failed: billed or not, there is no number. */
  failed?: boolean;
}

/** A queue in flight: `done` runs finished of `total`. The label counts the run in flight. */
export interface PackQueue {
  done: number;
  total: number;
}

function ProgressLine({ queue }: { queue: PackQueue }) {
  const total = Math.max(1, queue.total);
  const current = Math.min(queue.done + 1, total);
  // The run in flight counts half, as drawn: one of three done and the second running is 50%.
  const share = Math.max(0, Math.min(1, (queue.done + 0.5) / total));
  const text = `${current} of ${total}`;
  return (
    <div className="flex items-center gap-3 px-0.5 pb-0.5 pt-3">
      <div
        role="progressbar"
        aria-label="Simulating"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={queue.done}
        aria-valuetext={text}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-gauge-track"
      >
        <div className="h-full rounded-full bg-foreground" style={{ width: `${(share * 100).toFixed(2)}%` }} />
      </div>
      <span aria-hidden className="text-meta font-semibold leading-[21px] text-foreground-secondary tabular-nums">
        {text}
      </span>
    </div>
  );
}

export function PackAnswer({
  kind,
  rows,
  queue,
  onSimulate,
  onSimulateAll,
  onScript,
}: {
  kind: "hook" | "idea";
  rows: PackRow[];
  /** Non-null while "Simulate all" runs: the progress line replaces the primary. */
  queue: PackQueue | null;
  onSimulate?: (key: string) => void;
  onSimulateAll?: () => void;
  /** The row to script (0-based): the best, else the highest. */
  onScript?: (rowIndex: number) => void;
}) {
  const lead = leadOf(rows.map((r) => (r.state.kind === "done" ? r.state.value : null)));
  const emptyRows = rows.filter((r) => r.state.kind === "empty").length;
  const simulatePrice = creditCost("react");
  const scriptRow = lead.allDone ? (lead.best ?? lead.top) : null;

  let footer: React.ReactNode = null;
  if (queue) {
    footer = <ProgressLine queue={queue} />;
  } else if (emptyRows > 0) {
    footer = (
      <AnswerFoot>
        <AnswerPrimary
          icon={<PulseGlyph size={20} className="shrink-0" />}
          label={emptyRows === rows.length ? `Simulate all ${emptyRows}` : "Simulate the rest"}
          price={emptyRows * simulatePrice}
          onClick={onSimulateAll}
        />
      </AnswerFoot>
    );
  } else if (scriptRow !== null) {
    footer = (
      <AnswerFoot>
        <AnswerPrimary
          icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
          label={lead.best !== null ? "Script the best" : `Script ${kind} ${scriptRow + 1}`}
          price={creditCost("script")}
          onClick={onScript ? () => onScript(scriptRow) : undefined}
        />
      </AnswerFoot>
    );
  }

  return (
    <AnswerCard>
      <CardHeader left="Would stop to watch" right={emptyRows > 0 ? `${creditsLabel(simulatePrice)} each` : undefined} />
      <ul className="m-0 list-none p-0">
        {rows.map((row, i) => {
          const waiting = row.state.kind === "waiting";
          return (
            // Two rows can carry the same text (they share one seal), so the place is in the key.
            <li key={`${i}:${row.key}`} data-row={i} className="flex items-center gap-[13px] border-t border-border px-0.5 py-2.5">
              <span className="flex shrink-0 flex-col items-center gap-[5px]">
                <SmallGauge
                  state={row.state}
                  label={row.text}
                  onSimulate={onSimulate ? () => onSimulate(row.key) : undefined}
                />
                {lead.best === i && (
                  <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--color-foreground)_7%,transparent)] px-[7px] text-label font-[650] leading-none tracking-normal text-foreground">
                    Best
                  </span>
                )}
              </span>
              <div className={cn("min-w-0 flex-1", PROSE)}>
                {kind === "idea" ? (
                  <>
                    <p
                      className={cn(
                        "text-ui font-[620] leading-5 tracking-[-0.012em]",
                        waiting ? "text-foreground-secondary" : "text-foreground",
                      )}
                    >
                      {keepHyphens(row.text)}
                    </p>
                    {row.sub && (
                      <p className="mt-0.5 text-pretty text-meta leading-[18px] text-foreground-secondary">{keepHyphens(row.sub)}</p>
                    )}
                  </>
                ) : (
                  <p
                    className={cn(
                      "text-pretty text-ui font-[520] leading-5 tracking-[-0.01em]",
                      waiting ? "text-foreground-secondary" : "text-foreground",
                    )}
                  >
                    {keepHyphens(row.text)}
                  </p>
                )}
                {row.failed && <p className="mt-0.5 text-meta text-foreground-secondary">Couldn&apos;t simulate</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {footer}
    </AnswerCard>
  );
}
