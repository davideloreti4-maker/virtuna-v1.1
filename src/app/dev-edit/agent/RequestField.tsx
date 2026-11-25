"use client";

/**
 * RequestField.tsx — "Ask for a change" (Task 13b): a field that grows to three lines with Send (Enter sends, Shift+Enter
 * breaks the line), and under it four suggestions that fill the field. All of it is off while a call is out; a change that
 * failed is one sentence under the field with "Try again".
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

/** The longest request the route takes (`MOST.request` in `/api/edit/agent`). */
const MOST = 500;
const LINE = 22;
const SUGGESTIONS = [["Bigger captions", "Tighter cuts"], ["Move the title lower", "Black and white"]] as const;

interface Props {
  text: string;
  onText: (text: string) => void;
  onSend: (request: string) => void;
  disabled: boolean;
  /** A change that failed: its sentence, and what trying again does. */
  problem: { text: string; again: (() => void) | null } | null;
}

export interface FieldHandle {
  focus: () => void;
  focused: () => boolean;
}

export const RequestField = forwardRef<FieldHandle, Props>(function RequestField({ text, onText, onSend, disabled, problem }, handle) {
  const field = useRef<HTMLTextAreaElement>(null);
  // Focused without scrolling to it: it is always on screen, and a scroll of its own would stop the thread's.
  useImperativeHandle(handle, () => ({ focus: () => field.current?.focus({ preventScroll: true }), focused: () => document.activeElement === field.current }));
  // As tall as its text, from one line to three.
  useLayoutEffect(() => {
    const area = field.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 3 * LINE)}px`;
  }, [text]);
  const request = text.trim();
  const send = () => {
    if (!disabled && request !== "") onSend(request);
  };

  return (
    <div data-part="request" className="grid gap-2">
      <form
        className="flex items-end gap-2 rounded-md border border-border bg-surface py-1.5 pl-3 pr-1.5 focus-within:border-foreground/40 has-[:disabled]:opacity-50"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={field} rows={1} maxLength={MOST} disabled={disabled}
          aria-label="Ask for a change" placeholder="Ask for a change"
          value={text}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            send();
          }}
          className="my-[5px] block min-w-0 flex-1 resize-none bg-transparent text-[15px] text-foreground placeholder:text-foreground-muted"
          style={{ lineHeight: `${LINE}px` }}
        />
        <button type="submit" disabled={disabled || request === ""} className="h-8 flex-none rounded-md border border-transparent bg-action px-3 text-[13px] font-medium text-action-foreground disabled:border-border disabled:bg-transparent disabled:text-foreground-muted">
          Send
        </button>
      </form>
      {problem ? (
        <p role="alert" className="text-[13px] leading-[18px] text-foreground-secondary">
          {problem.text}{" "}
          {problem.again ? (
            <button type="button" disabled={disabled} onClick={problem.again} className="text-foreground underline underline-offset-4">
              Try again
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
});

/** The four suggestions, two to a row: each fills the field. */
export function Suggestions({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div data-part="suggestions" className="grid gap-2">
      {SUGGESTIONS.map((row) => (
        <div key={row[0]} className="flex gap-2">
          {row.map((each) => (
            <button key={each} type="button" disabled={disabled} onClick={() => onPick(each)} className="h-8 rounded-md border border-border px-3 text-[13px] text-foreground-secondary hover:border-border-hover hover:text-foreground disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground-secondary">
              {each}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
