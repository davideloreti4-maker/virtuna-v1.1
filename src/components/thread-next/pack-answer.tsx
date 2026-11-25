"use client";

import { useId } from "react";

import { creditCost } from "@/lib/pricing";
import { afterRows, landStyle, rowLand } from "@/lib/thread-next/landing";
import { leadOf } from "@/lib/thread-next/pack-lead";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, CardHeader, PROSE, creditsLabel, keepHyphens } from "./answer-card";
import { PulseGlyph, SmallGauge, clipName, type GaugeState } from "./answer-gauge";
import { ChevronIcon, DocIcon } from "./field-icons";

/**
 * The hook pack and the idea pack (spec §4.1, §4.2; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axHooks` and `axIdeas`, `.tq-hook`, `.ax-gc`,
 * `.ax-best`, `.tq-prog`, `.tq-f`, `.ax-id`): one card, a gauge on every row.
 *
 * - Header: the rows counted ("3 hooks", "4 ideas", "1 hook") while every row is empty and none has
 *   failed, then "Would stop to watch" as soon as one waits, runs, has its number or has failed
 *   (thread feel §4.7). At the right
 *   "1 credit each" while any row is not simulated (empty) and "out of 100" once every row is: the
 *   numbers' scale, said once instead of a "%" in each ring.
 * - Rows: the gauge, then the text (a hook's line; an idea's title and its one grey line). A waiting
 *   row's text is in the secondary ink. With `onOpen` (step 2) the row is ONE button ("Open: <text>",
 *   a dialog's opener) holding its text and a 14 chevron, described by the lines its name leaves out
 *   (an idea's grey line, "Couldn't simulate"); its `::after` covers the whole row. The gauge column
 *   sits above it and passes every tap through (`pointer-events-none`) but the gauge's own: an empty
 *   gauge simulates, and a simulated one with its result page (`href`) is a link to it (design ruling,
 *   fix round 1); a simulated gauge without one, "Best" and the space beside them open the row.
 *   Without `onOpen`, no chevron (step 1).
 * - Under the leader's gauge, once every row is simulated: "Best" when it leads by 10 or more
 *   (`leadOf`), "Ahead" on a smaller lead (the row "Script hook K" and the sentence name; rows carry
 *   no numbers of their own), nothing on a tie.
 * - The one primary: "Simulate all N" with "N credits" (N = the rows not simulated) while any row
 *   is empty ("Simulate the rest" once some are simulated); while a queue runs, a thin progress line and "2 of 3" instead; once every row is
 *   simulated, "Script the best" (a clear best) or "Script hook K" / "Script idea K" (K = the
 *   highest, the first on a tie), "2 credits". A row that is running or waiting outside a queue
 *   leaves the card without a primary until it lands.
 * - A failed row says "Couldn't simulate" under its text and keeps its empty gauge.
 *
 * - In a landing (thread feel §4.3, `[data-thread-landing] .land`): the rows come in one after another
 *   (`--i` the row's index, the rest with the tenth), then the button's row. That row is one element
 *   whatever it holds, so the progress line or "Script the best" taking its place later is not
 *   landed again. The card itself takes its height at once. Outside a landing `land` does nothing.
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
  /** Its result page, once simulated and its key is known (step 2): the gauge links there. */
  href?: string | null;
}

/** The place of a pack's last part in a landing: its button's row, after the last staggered row. */
export function packLastLand(rowCount: number): number {
  return afterRows(rowCount);
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

/** A row's words: a hook's line, or an idea's title and its grey line; a failed row's note. The ids
 *  let the row's button be described by the lines its name leaves out. */
function RowText({
  kind,
  row,
  waiting,
  subId,
  failedId,
}: {
  kind: "hook" | "idea";
  row: PackRow;
  waiting: boolean;
  subId?: string;
  failedId?: string;
}) {
  const ink = waiting ? "text-foreground-secondary" : "text-foreground";
  return (
    <>
      {kind === "idea" ? (
        <>
          <span className={cn("block text-ui font-[620] leading-5 tracking-[-0.012em]", ink)}>{keepHyphens(row.text)}</span>
          {row.sub && (
            <span id={subId} className="mt-0.5 block text-pretty text-meta leading-[18px] text-foreground-secondary">
              {keepHyphens(row.sub)}
            </span>
          )}
        </>
      ) : (
        <span className={cn("block text-pretty text-ui font-[520] leading-5 tracking-[-0.01em]", ink)}>{keepHyphens(row.text)}</span>
      )}
      {row.failed && (
        <span id={failedId} className="mt-0.5 block text-meta text-foreground-secondary">
          Couldn&apos;t simulate
        </span>
      )}
    </>
  );
}

export function PackAnswer({
  kind,
  rows,
  queue,
  onSimulate,
  onSimulateAll,
  onScript,
  onOpen,
}: {
  kind: "hook" | "idea";
  rows: PackRow[];
  /** Non-null while "Simulate all" runs: the progress line replaces the primary. */
  queue: PackQueue | null;
  onSimulate?: (key: string) => void;
  onSimulateAll?: () => void;
  /** The row to script (0-based): the best, else the highest. */
  onScript?: (rowIndex: number) => void;
  /** Opens the row's details (step 2): the row becomes one button with a chevron. */
  onOpen?: (rowIndex: number, trigger: HTMLButtonElement) => void;
}) {
  const ids = useId();
  const lead = leadOf(rows.map((r) => (r.state.kind === "done" ? r.state.value : null)));
  const emptyRows = rows.filter((r) => r.state.kind === "empty").length;
  // Not one row tried yet: a failed row is empty again, but the header must not swap back to the count.
  const untried = emptyRows === rows.length && !rows.some((r) => r.failed);
  const simulatePrice = creditCost("react");
  const scriptRow = lead.allDone ? (lead.best ?? lead.top) : null;
  // The row the sentence and the primary name ("Hook 1 is ahead", "Script hook 1") is marked, since
  // rows carry no numbers of their own: "Best" on a clear lead, "Ahead" on a small one, nothing on a tie.
  const tagRow = lead.best ?? (lead.allDone && lead.lead !== null && lead.lead > 0 ? lead.top : null);

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
      <CardHeader
        left={untried ? `${rows.length} ${kind}${rows.length === 1 ? "" : "s"}` : "Would stop to watch"}
        right={emptyRows > 0 ? `${creditsLabel(simulatePrice)} each` : lead.allDone && rows.length > 0 ? "out of 100" : undefined}
      />
      <ul className="m-0 list-none p-0">
        {rows.map((row, i) => {
          const waiting = row.state.kind === "waiting";
          const subId = `${ids}-${i}-sub`;
          const failedId = `${ids}-${i}-failed`;
          const described = [kind === "idea" && row.sub ? subId : null, row.failed ? failedId : null].filter(Boolean).join(" ");
          return (
            // Two rows can carry the same text (they share one seal), so the place is in the key.
            <li
              key={`${i}:${row.key}`}
              data-row={i}
              className={cn("land flex items-center gap-[13px] border-t border-border px-0.5 py-2.5", onOpen && "relative")}
              style={landStyle(rowLand(i))}
            >
              {/* As wide as the gauge (46), whatever sits under it: "Ahead" is wider than the gauge and
                  used to widen the column, so that one row's text started further in than the others
                  (seen on a real pack, 2026-11-25). The tag is centred and may reach past the column. */}
              <span className={cn("flex w-[46px] shrink-0 flex-col items-center gap-[5px]", onOpen && "pointer-events-none relative z-[1]")}>
                <SmallGauge
                  state={row.state}
                  label={row.text}
                  onSimulate={onSimulate ? () => onSimulate(row.key) : undefined}
                  href={row.href ?? null}
                />
                {tagRow === i && (
                  <span
                    data-part="lead-tag"
                    className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--color-foreground)_7%,transparent)] px-[7px] text-label font-[650] leading-none tracking-normal text-foreground"
                  >
                    {lead.best !== null ? "Best" : "Ahead"}
                  </span>
                )}
              </span>
              {onOpen ? (
                <button
                  type="button"
                  aria-label={`Open: ${clipName(row.text)}`}
                  aria-haspopup="dialog"
                  aria-describedby={described || undefined}
                  onClick={(e) => onOpen(i, e.currentTarget)}
                  // Its ::after covers the whole row, so a tap anywhere but the gauge opens the sheet.
                  className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-left after:absolute after:inset-0", PROSE)}
                >
                  <span className="block min-w-0 flex-1">
                    <RowText kind={kind} row={row} waiting={waiting} subId={subId} failedId={failedId} />
                  </span>
                  <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="shrink-0 text-foreground-muted" />
                </button>
              ) : (
                <div className={cn("min-w-0 flex-1", PROSE)}>
                  <RowText kind={kind} row={row} waiting={waiting} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {/* A plain block: the footer's own top margin still sits between the rows and the button. */}
      <div className="land" style={landStyle(packLastLand(rows.length))}>
        {footer}
      </div>
    </AnswerCard>
  );
}
