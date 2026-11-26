"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { EditorActions, ErrorLine, RowButton, cancelOnEscape } from "@/components/you-next/row-parts";
import { cn } from "@/lib/utils";

import {
  NEW_PASSWORD,
  PASSWORD,
  PASSWORD_AGAIN,
  PASSWORD_HINT,
  PASSWORD_LINE,
  PASSWORD_MIN,
  PASSWORD_MISMATCH,
  PASSWORD_OPEN_LINE,
  PASSWORD_SAVED,
  PASSWORD_TOO_SHORT,
} from "./settings-words";

/**
 * Password (spec 2026-11-26-settings-design 2.3; drawing frame 5): closed, a row ("Set or change";
 * "Saved" once one was saved on this visit); open, in place, the new password typed twice, the rule at
 * the left of Cancel and Save. Presentational: the PARENT sends (`onSave`), holds `busy` and the
 * server's refusal (`error`), and returns the focus to the closed button (`buttonRef`), as You's rows.
 *
 * - Save checks here first, and sends nothing that fails: shorter than 8, or the two differ. The line
 *   says which, the field it is about is marked and takes the focus; typing takes the line away.
 * - What is typed lives only in the open row: closing it, by any way, forgets it.
 * - While a save is out the fields are held (read-only keeps the focus) and Cancel, Save and Escape wait.
 * - Enter in a field saves.
 */
export interface PasswordRowProps {
  open: boolean;
  /** A password was saved since the page was opened. */
  saved: boolean;
  busy: boolean;
  /** A save that did not go through, in the container's words. */
  error: string | null;
  onOpen(): void;
  onSave(password: string): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * You's open field (`fact-row.tsx`), one line tall. 16 on the phone: iOS zooms the page into a field
 * set smaller; 15 from 768. Focused, it is drawn as the drawing has it: the card's white with an ink
 * outline (a field carries no focus ring of its own, and here two stand together).
 */
export const FIELD =
  "block h-12 w-full rounded-xl bg-surface-sunken px-3.5 text-title text-foreground placeholder:text-foreground-muted focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_2px_var(--color-foreground)] md:text-ui";
export const FIELD_LABEL = "block px-0.5 text-meta font-[560] text-foreground-secondary";

export function PasswordRow(props: PasswordRowProps): React.JSX.Element {
  if (!props.open) {
    return <RowButton label={PASSWORD} value={props.saved ? PASSWORD_SAVED : PASSWORD_LINE} onOpen={props.onOpen} buttonRef={props.buttonRef} />;
  }
  return <PasswordEditor {...props} />;
}

function PasswordEditor({ busy, error, onSave, onCancel }: PasswordRowProps) {
  const id = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [refused, setRefused] = useState<"short" | "mismatch" | null>(null);

  // Opened: the focus in the first field.
  useLayoutEffect(() => {
    firstRef.current?.focus();
  }, []);

  const message = refused === "short" ? PASSWORD_TOO_SHORT : refused === "mismatch" ? PASSWORD_MISMATCH : error;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const save = () => {
    if (busy) return;
    if (password.length < PASSWORD_MIN) {
      setRefused("short");
      firstRef.current?.focus();
      return;
    }
    if (password !== again) {
      setRefused("mismatch");
      againRef.current?.focus();
      return;
    }
    setRefused(null);
    onSave(password);
  };
  const escape = cancelOnEscape(busy, onCancel);

  return (
    <form
      noValidate
      className="pb-4 pt-3.5"
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        escape(e);
        if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement) || e.nativeEvent.isComposing) return;
        e.preventDefault();
        save();
      }}
    >
      <p className="text-title font-[640] text-foreground">{PASSWORD}</p>
      <p className="mt-0.5 text-ui text-foreground-secondary">{PASSWORD_OPEN_LINE}</p>

      <label htmlFor={`${id}-new`} className={cn("mt-3", FIELD_LABEL)}>
        {NEW_PASSWORD}
      </label>
      <input
        id={`${id}-new`}
        ref={firstRef}
        type="password"
        autoComplete="new-password"
        value={password}
        // While a save is out the fields are held: what is shown is what was sent.
        readOnly={busy}
        onChange={(e) => {
          if (busy) return;
          setPassword(e.target.value);
          setRefused(null);
        }}
        aria-describedby={refused === "short" ? `${hintId} ${errorId}` : hintId}
        aria-invalid={refused === "short" || undefined}
        className={cn("mt-1.5", FIELD)}
      />

      <label htmlFor={`${id}-again`} className={cn("mt-3", FIELD_LABEL)}>
        {PASSWORD_AGAIN}
      </label>
      <input
        id={`${id}-again`}
        ref={againRef}
        type="password"
        autoComplete="new-password"
        value={again}
        readOnly={busy}
        onChange={(e) => {
          if (busy) return;
          setAgain(e.target.value);
          setRefused(null);
        }}
        aria-describedby={refused === "mismatch" ? errorId : undefined}
        aria-invalid={refused === "mismatch" || undefined}
        className={cn("mt-1.5", FIELD)}
      />

      {message && <ErrorLine id={errorId}>{message}</ErrorLine>}
      <EditorActions count={PASSWORD_HINT} countId={hintId} busy={busy} onCancel={onCancel} onSave={save} />
    </form>
  );
}
