"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";

import { EditorActions, ErrorLine, RowButton, cancelOnEscape } from "./row-parts";
import { SAVE_FAILED, countLabel } from "./you-words";

/**
 * A free-text row of "In your words" (spec §3.1 point 4): closed, a button; open, one field with its count,
 * Cancel and Save. The closed button unmounts while the row is open, so the PARENT returns the focus to it
 * (`buttonRef`) when the row closes; the same holds for the niche and goal rows.
 */
export interface FactRowProps {
  label: string;
  value: string | null;
  open: boolean;
  draft: string;
  limit: number;
  placeholder: string;
  hint: string | null;
  busy: boolean;
  failed: boolean;
  onOpen(): void;
  onDraft(text: string): void;
  onSave(): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function FactRow(props: FactRowProps): React.JSX.Element {
  if (!props.open) return <RowButton label={props.label} value={props.value} onOpen={props.onOpen} buttonRef={props.buttonRef} />;
  return <FactEditor {...props} />;
}

function FactEditor({ label, draft, limit, placeholder, hint, busy, failed, onDraft, onSave, onCancel }: FactRowProps) {
  const id = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Opened: the focus in the field, the caret after what is there.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);
  const describedBy = [hint ? `${id}-hint` : null, `${id}-count`, failed ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="pb-4 pt-3.5" onKeyDown={cancelOnEscape(busy, onCancel)}>
      <label htmlFor={`${id}-field`} className="block text-title font-[640] text-foreground">
        {label}
      </label>
      <textarea
        id={`${id}-field`}
        ref={fieldRef}
        value={draft}
        rows={3}
        maxLength={limit}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={failed || undefined}
        // While a save is out the field is held (read-only keeps the focus): the text shown is the text sent.
        readOnly={busy}
        // The limit holds for a paste too (and in a browser that ignores maxlength on a paste).
        onChange={(e) => {
          if (!busy) onDraft(e.target.value.slice(0, limit));
        }}
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768. Radius 16, as drawn.
        className="mt-2 block min-h-[84px] w-full resize-none rounded-xl bg-surface-sunken px-3.5 py-3 text-title text-foreground placeholder:text-foreground-muted md:text-ui"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-2 px-0.5 text-meta text-foreground-secondary">
          {hint}
        </p>
      )}
      {failed && <ErrorLine id={`${id}-error`}>{SAVE_FAILED}</ErrorLine>}
      <EditorActions count={countLabel(draft.length, limit)} countId={`${id}-count`} busy={busy} onCancel={onCancel} onSave={onSave} />
    </div>
  );
}
