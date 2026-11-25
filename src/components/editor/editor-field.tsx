"use client";

import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { SendIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CloseIcon } from "./editor-icons";

/**
 * editor-field.tsx — "Ask for a change" (spec §3 screen 4, §5.2; plan 2026-11-24-editor-screens-a, Task 12; drawing `.field`):
 * one field of its own, not the chat; 52 tall, the surface floating on the page, growing to three lines; Enter sends,
 * Shift+Enter breaks the line; the send button is the ink circle (36). Off while a call is out or the export is being made.
 * A request that failed comes back to it (the page's).
 *
 * Slice B (E15; plan 2026-11-25-editor-screens-b, Task 7): the moment the request is about, when the video is paused inside
 * the film, stands first in the pill as a tag with its time ("0:06"); a press on it, or Backspace at the start of the words,
 * takes it away (the page's to hold). A screen reader hears it as the field's description.
 */

/** The longest request the routes take (`MOST.request`). */
export const MOST_REQUEST = 500;
const LINE = 22;

export interface FieldHandle {
  focus(): void;
  focused(): boolean;
}

interface Props {
  text: string;
  onText(text: string): void;
  onSend(request: string): void;
  disabled: boolean;
  sending: boolean;
  /** The moment the request is about (E15): the film frame the video is paused on and its time ("0:06"); null for none. */
  moment: { frame: number; label: string } | null;
  /** The creator takes the moment away: a press on its tag, or Backspace at the very start of the words. */
  onDropMoment(): void;
}

export const EditorField = forwardRef<FieldHandle, Props>(function EditorField({ text, onText, onSend, disabled, sending, moment, onDropMoment }, handle) {
  const area = useRef<HTMLTextAreaElement>(null);
  const about = useId();
  // Focused without scrolling to it: it is docked on screen, and a scroll of its own would move the conversation.
  useImperativeHandle(handle, () => ({ focus: () => area.current?.focus({ preventScroll: true }), focused: () => document.activeElement === area.current }), []);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 3 * LINE)}px`;
  }, [text]);
  const request = text.trim();
  const send = () => {
    if (!disabled && request !== "") onSend(request);
  };
  return (
    <form
      data-part="field"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      // The text is one 22 px line in a 52 px pill: a press anywhere on the pill but its send puts the caret at the end of the
      // words. Pressed again while in it, the caret stays where the creator put it.
      onClick={(event) => {
        const element = area.current;
        if (!element || disabled || document.activeElement === element) return;
        if (event.target instanceof Element && event.target.closest("button")) return;
        element.focus({ preventScroll: true });
        element.setSelectionRange(element.value.length, element.value.length);
      }}
      className={cn("flex min-h-[52px] items-center gap-2 rounded-[26px] bg-surface py-2 pl-[18px] pr-2 shadow-[var(--shadow-float)]", disabled && "opacity-60")}
    >
      {moment && (
        // The moment, first in the pill (drawing `.field .at`): 10 from the pill's edge, 9 from the words. Pressed, it goes, and
        // the focus stays in the field rather than on the page's body.
        <button
          type="button" disabled={disabled} aria-label={`Remove the moment at ${moment.label}`}
          onClick={() => {
            onDropMoment();
            area.current?.focus({ preventScroll: true });
          }}
          className="tap-44 -ml-2 mr-px flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2.5 text-meta font-[600] tabular-nums text-foreground"
        >
          {moment.label}
          <CloseIcon size={12} strokeWidth={2} aria-hidden className="text-foreground-muted" />
        </button>
      )}
      <textarea
        ref={area} rows={1} maxLength={MOST_REQUEST} disabled={disabled}
        aria-label="Ask for a change" placeholder="Ask for a change" value={text} aria-describedby={moment ? about : undefined}
        onChange={(event) => onText(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          // Backspace at the very start of the words, nothing selected, takes the moment before them away.
          const { selectionStart, selectionEnd } = event.currentTarget;
          if (event.key === "Backspace" && moment && selectionStart === 0 && selectionEnd === 0) {
            event.preventDefault();
            onDropMoment();
            return;
          }
          // Not the Enter that ends a composition: Safari fires it not composing, as the composer's key (229).
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          send();
        }}
        className="block min-w-0 flex-1 resize-none bg-transparent text-ui text-foreground placeholder:text-foreground-muted focus:outline-none"
        style={{ lineHeight: `${LINE}px` }}
      />
      <Button
        type="submit" variant="primary" size="sm" aria-label="Send" disabled={disabled || request === ""} loading={sending}
        className={cn(
          "tap-44 h-9 min-h-0 w-9 min-w-0 shrink-0 rounded-full p-0 next:rounded-full",
          "disabled:bg-surface-sunken disabled:text-foreground-muted disabled:opacity-100 disabled:shadow-none next:disabled:opacity-100 next:disabled:shadow-none",
        )}
      >
        {sending ? null : <SendIcon size={18} strokeWidth={2.3} aria-hidden />}
      </Button>
      {moment && (
        <span id={about} hidden>
          {`This request is about the moment at ${moment.label}.`}
        </span>
      )}
    </form>
  );
});
