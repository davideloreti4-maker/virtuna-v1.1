"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { frameOf, type Edit, type Op } from "@/lib/edit";
import { sameWord } from "@/lib/edit/said";
import { cn } from "@/lib/utils";

/**
 * captions-sheet.tsx — fix a word (spec §3 screen 10, E5, E22; plan 2026-11-24-editor-screens-a, Task 13; drawing `.words`,
 * `.tog`): the take's words as they were heard; a tap on one sends the video to it and opens it for typing; Enter (or leaving
 * it) sets it with `word.set`, no agent and no wait, and a word heard in other places too offers "Fix all N", each other place
 * keeping its own marks ("claudel." becomes "Claude."). A word left as it was sends nothing (R22). Escape leaves a word as it
 * was and the sheet open; Enter and Escape hand the focus back to the word. The switch turns captions off and on
 * (`captions.set`). The sheet opens fresh each time: a word being typed and a "Fix all" offered go when it closes.
 *
 * What a failed change says is the page's (`onOps` answers false and the edit stays as it was).
 */

/** The film frame a moment of the take shows on, in whichever of the take's shots shows it; null when the cut left it out. */
export function wordFrame(edit: Edit, ms: number, takeId: string): number | null {
  for (const shot of edit.shots) {
    if (shot.asset !== takeId) continue; // another file's shot may show the same moment of its own
    const frame = frameOf(edit, shot.id, ms);
    if (frame !== null) return frame;
  }
  return null;
}

/** The other places a word was heard, by index. */
export function othersLike(words: readonly { text: string }[], index: number): number[] {
  const text = words[index]?.text ?? "";
  return words.flatMap((word, j) => (j !== index && sameWord(word.text, text) ? [j] : []));
}

/** The marks around a word, as `sameWord` reads them: what is not a letter or a digit at either end. */
const MARKS = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

/** A fix given to another place the word was heard: the fixed word, with that place's own marks around it. */
function fixedThere(there: string, fix: string): string {
  const [, , core = ""] = MARKS.exec(fix) ?? [];
  if (core === "") return fix; // a fix that is all marks is given as it is
  const [, before = "", , after = ""] = MARKS.exec(there) ?? [];
  return `${before}${core}${after}`;
}

/** The mark of the word being typed, by which the sheet knows an Escape is the word's. */
const TYPED = "word-typed";

export interface CaptionsSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  edit: Edit;
  takeId: string;
  disabled: boolean;
  /** Sends a change by hand (`POST …/ops`); true when it was made. */
  onOps(ops: Op[]): Promise<boolean>;
  onSeek(frame: number): void;
}

/** What the sheet holds while it is open: gone with the sheet's content when it closes, so it opens fresh. */
function CaptionsBody({ onOpenChange, edit, takeId, disabled, onOps, onSeek }: Omit<CaptionsSheetProps, "open">) {
  const asset = edit.assets.find((each) => each.id === takeId);
  const words = asset?.kind === "video" ? (asset.words ?? []) : [];
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  /** The fix just made, as the ops that give it to every other place the word was heard. */
  const [fixAll, setFixAll] = useState<Op[] | null>(null);
  const on = edit.captions.on;

  // The word being typed, in a ref too: a word is set once (Enter, then the blur of an input going away, would set it twice)
  // and never after Escape.
  const typingAt = useRef<number | null>(null);
  // Where the focus goes when typing ends: back to the word after Enter or Escape; after a blur it is where the creator put it.
  const handBack = useRef<number | null>(null);
  const typing = useRef<HTMLInputElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const editingAt = editing?.index ?? null;
  useEffect(() => {
    if (editingAt !== null) {
      typing.current?.focus();
    } else if (handBack.current !== null) {
      buttons.current[handBack.current]?.focus();
      handBack.current = null;
    }
  }, [editingAt]);

  const openWord = (index: number) => {
    const word = words[index];
    if (!word) return;
    setFixAll(null);
    typingAt.current = index;
    setEditing({ index, text: word.text });
    const frame = wordFrame(edit, word.startMs, takeId);
    if (frame !== null) onSeek(frame);
  };
  const cancel = () => {
    if (typingAt.current === null) return;
    handBack.current = typingAt.current;
    typingAt.current = null;
    setEditing(null);
  };
  const commit = async (keyed: boolean) => {
    if (!editing || typingAt.current !== editing.index) return;
    const { index } = editing;
    typingAt.current = null;
    if (keyed) handBack.current = index;
    setEditing(null);
    const was = words[index]?.text ?? "";
    const to = editing.text.trim();
    if (to === "" || to === was) return;
    const others = othersLike(words, index).flatMap((j): Op[] => {
      const text = fixedThere(words[j]!.text, to);
      return text === words[j]!.text ? [] : [{ op: "word.set", asset: takeId, index: j, text }];
    });
    const made = await onOps([{ op: "word.set", asset: takeId, index, text: to }]);
    // Offered only while no other word is being typed: a tap on another word took the creator elsewhere.
    if (made && others.length > 0 && typingAt.current === null) setFixAll(others);
  };
  const fixEverywhere = (ops: Op[]) => {
    setFixAll(null);
    void onOps(ops);
  };

  return (
    <>
      <div className="flex h-11 items-center gap-2.5 px-0.5">
        <SheetTitle className="flex-1 text-subhead font-[640]">Captions</SheetTitle>
        <button
          type="button" role="switch" aria-checked={on} aria-label="Captions" disabled={disabled}
          onClick={() => void onOps([{ op: "captions.set", on: !on }])}
          className={cn("tap-44 relative h-7 w-[46px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40", on ? "bg-action" : "bg-surface-sunken")}
        >
          {/* The knob: the action's own ink on it when on; off, a white knob in light and a grey one in dark, both seen on the track. */}
          <span
            aria-hidden
            className={cn(
              "absolute top-[3px] size-[22px] rounded-full transition-[left] duration-150",
              on ? "left-[21px] bg-action-foreground" : "left-[3px] bg-surface shadow-[var(--shadow-control)] dark:bg-foreground-secondary",
            )}
          />
        </button>
        <IconButton surface="card" aria-label="Close" onClick={() => onOpenChange(false)} className="h-9 w-9 [&_svg]:size-4">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>
      {words.length === 0 ? (
        <p className="mt-2 px-0.5 text-ui text-foreground-secondary">No speech was found in this take.</p>
      ) : (
        // Each word is a word of the sentence, as tall as its line (36): a 44 halo would reach into the words beside it.
        <p data-part="words" className="mt-0.5 px-0.5 text-title leading-9 text-foreground">
          {words.map((word, i) => (
            <Fragment key={i}>
              {editing?.index === i ? (
                <input
                  ref={typing} data-part={TYPED} aria-label={`Word ${i + 1}`} value={editing.text} size={Math.max(2, editing.text.length)} maxLength={80}
                  autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done"
                  onChange={(event) => setEditing({ index: i, text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commit(true);
                    }
                    if (event.key === "Escape") cancel(); // the sheet stays: its `onEscapeKeyDown`
                  }}
                  onBlur={() => void commit(false)}
                  className="mx-0.5 rounded-md bg-transparent px-1.5 py-[5px] leading-5 text-foreground shadow-[0_0_0_1.7px_var(--color-action)] focus:outline-none"
                />
              ) : (
                <button
                  ref={(button) => void (buttons.current[i] = button)}
                  type="button" disabled={disabled} onClick={() => openWord(i)}
                  className={cn("rounded-md px-px py-[5px] leading-5 hover:bg-surface-sunken disabled:opacity-60", word.hidden && "text-foreground-muted")}
                >
                  {word.text}
                </button>
              )}{" "}
            </Fragment>
          ))}
        </p>
      )}
      {fixAll && (
        <div className="mt-1.5">
          <Chip surface="card" disabled={disabled} onClick={() => fixEverywhere(fixAll)}>{`Fix all ${fixAll.length + 1}`}</Chip>
        </div>
      )}
      <p className="mt-3 px-0.5 text-meta text-foreground-secondary">Tap a word to fix it. The video jumps to it.</p>
    </>
  );
}

export function CaptionsSheet({ open, ...props }: CaptionsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={() => props.onOpenChange(false)}
        // Radix hears Escape on the document before the word's own keys. Pressed in a word being typed it is the word's: the
        // word's keys leave it as it was, and the sheet stays.
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest(`[data-part="${TYPED}"]`)) event.preventDefault();
        }}
        className="max-h-[70dvh] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-[560px]"
      >
        <CaptionsBody {...props} />
      </SheetContent>
    </Sheet>
  );
}
