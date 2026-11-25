"use client";

import { useLayoutEffect, useRef } from "react";
import { Chip } from "@/components/ui/chip";
import type { TurnShown } from "@/lib/edit/edit-view";
import { lookName } from "@/lib/edit/said";
import { chipLabel, momentLabel, type NextChip } from "./edit-session";

/**
 * editor-thread.tsx — the conversation (spec §3 screens 3-5, §5.3, §5.4, E7, E19; plan 2026-11-24-editor-screens-a, Task 12):
 * each turn's request (the first cut, made by itself, has none; a look picked later reads "Look: Clean") and what was said,
 * the latest answer with Undo on it when it changed the edit; a request out; one problem with Try again; and the chips under the
 * latest answer. The latest exchange is what shows; older turns are a scroll away: the conversation is its own scroll area, kept
 * at its end whenever something new arrives in it. The chips are one row that scrolls sideways (ruling R30).
 *
 * Slice B (E15; plan 2026-11-25-editor-screens-b, Task 7): a request about a moment, out or answered, reads that moment's time
 * before its words ("0:06 · Zoom in here").
 *
 * Slice B, Task 8: the chips follow from the change shown (a step, or a change by hand), and a line the page has to say for a
 * while (the read of a video's style, with its Stop) is drawn in the chips row's place (`status`): while it is set the chips row
 * is not drawn, and it comes back when the line goes.
 *
 * Slice B, Task 9 (E18): "N to check" opens the card of a thing to check (`card`, the page's `FindingCard`) in the chips' place,
 * where slice A listed them all. In that place stands the card while it is open; else the line, while it is set; else the chips.
 */

/** What the creator asked, as the conversation shows it. */
export function requestOf(turn: TurnShown): string | null {
  if (turn.kind === "cut") return turn.n === 1 ? null : `Look: ${lookName(turn.request)}`;
  return turn.request;
}

export interface ThreadProps {
  turns: readonly TurnShown[];
  /** The request out, with the moment it is about (a film frame) or null. */
  pending: { request: string; at: number | null } | null;
  /** The latest answer changed the edit and Undo can go back. */
  undoable: boolean;
  onUndo(): void;
  chips: readonly NextChip[];
  onChip(chip: NextChip): void;
  problem: { text: string; again: (() => void) | null } | null;
  disabled: boolean;
  /** A line drawn in the chips row's place; while it is set the chips row is not drawn. */
  status: React.ReactNode | null;
  /** The card of a thing to check, in the chips row's place before the line; while it is set neither is drawn. */
  card: React.ReactNode | null;
}

/** The id of the chip "N to check". */
export const CHECK_CHIP = "edit-check";

const ASKED = "max-w-[290px] self-end rounded-[18px] bg-surface-sunken px-3.5 py-2 text-ui text-foreground";

/** A request as the conversation shows it: the moment it was about before its words ("0:06 · Zoom in here"; drawing `.me .q`). */
function Asked({ request, at }: { request: string; at: number | null }) {
  return (
    <p className={ASKED}>
      {at !== null && <span className="text-foreground-muted tabular-nums">{`${momentLabel(at)} · `}</span>}
      {request}
    </p>
  );
}

export function EditorThread({ turns, pending, undoable, onUndo, chips, onChip, problem, disabled, status, card }: ThreadProps) {
  const box = useRef<HTMLElement>(null);
  const latest = turns.at(-1);
  // Something new in the conversation (a request out, its answer, a problem, the card opened or closed) brings its end into
  // view. A read that brings the same turns anew is nothing new, so a creator reading older turns is left where they are.
  // A turn is known by its number, a request out by its words and moment: every render hands new objects.
  const latestTurn = latest?.n ?? null;
  const pendingRequest = pending?.request ?? null;
  const pendingAt = pending?.at ?? null;
  const problemText = problem?.text ?? null;
  const saying = status !== null;
  const carding = card !== null;
  useLayoutEffect(() => {
    const element = box.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [latestTurn, pendingRequest, pendingAt, problemText, carding, saying]);
  return (
    // 4 px each side inside the scroll area, so the focus ring (2 out, 2 wide) and a tap area are not cut at its edges. It
    // takes the focus, so a keyboard can scroll it in every browser. 6 at its foot hold the chips' row, whose own room
    // reaches that far under it: without them a conversation that ends on its chips would scroll by those 6.
    <section
      ref={box} tabIndex={0} data-part="thread" aria-label="Your edit's changes"
      className="-mx-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden px-1 pb-1.5"
    >
      {/* A request out and its answer are read as they arrive, each once: a read that brings the same turns adds nothing. */}
      <ol aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2.5">
        {turns.map((turn) => {
          const asked = requestOf(turn);
          return (
            <li key={turn.n} data-turn={turn.n} className="flex flex-col gap-2.5">
              {asked !== null && <Asked request={asked} at={turn.at} />}
              <p className="text-ui leading-[21px] text-foreground proportional-nums">
                {turn.say}
                {turn === latest && undoable && turn.doc && (
                  <button type="button" disabled={disabled} onClick={onUndo} className="tap-44 ml-1.5 whitespace-nowrap font-[600] text-foreground disabled:opacity-40">
                    Undo
                  </button>
                )}
              </p>
            </li>
          );
        })}
        {pending !== null && (
          <li className="flex flex-col gap-2.5">
            <Asked request={pending.request} at={pending.at} />
            <p className="text-ui text-foreground-secondary">Working on it…</p>
          </li>
        )}
      </ol>
      {problem && (
        <p role="alert" className="text-meta text-foreground-secondary">
          {problem.text}{" "}
          {problem.again && (
            <button type="button" onClick={problem.again} className="tap-44 font-[600] text-foreground">
              Try again
            </button>
          )}
        </p>
      )}
      {carding ? card : saying ? status : chips.length > 0 && pending === null && (
        // One row, however many (ruling R30): on a phone it scrolls sideways and never wraps, so the answer above it stays in
        // view. Room inside the row's own scroll area (4 at the sides, 6 above and below, taken back by the margins) keeps a
        // chip's focus ring and its 44 tap area from being cut, and from making the row scroll up and down.
        <div data-part="chips" className="-mx-1 -my-1.5 flex shrink-0 gap-2 overflow-x-auto px-1 py-1.5 [scrollbar-width:none]">
          {chips.map((chip) => (
            // "N to check" is found by its id: the page gives the focus back to it when the card it opened is closed.
            <Chip key={chipLabel(chip)} id={chip.kind === "check" ? CHECK_CHIP : undefined} surface="card" disabled={disabled} onClick={() => onChip(chip)}>
              {chip.kind === "check" && <span aria-hidden className="size-2.5 rounded-full border-[1.7px] border-current" />}
              {chipLabel(chip)}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}
