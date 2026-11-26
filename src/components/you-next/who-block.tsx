"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";

import { AvatarFallback, AvatarImage, AvatarRoot } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { EditorActions, ErrorLine, ROW_BUTTON, cancelOnEscape } from "./row-parts";
import { CHANGE_PHOTO, NAME_LABEL, SAVE_FAILED, WHO_EDIT } from "./you-words";

/** The longest name `PATCH /api/profile` takes. */
export const NAME_MAX = 100;

/**
 * Who (spec §3.1 point 2; drawing `.who`): the avatar (56, ink with the initials when there is no
 * photo), the name (22, bold) and the primary account's line, on the ground. A tap opens a card in
 * its place: the photo (sent at once when a file is chosen) and the name (sent with Save).
 */
export interface WhoBlockProps {
  name: string;
  initials: string;
  avatar: string | null;
  line: string;
  open: boolean;
  draft: string;
  /** The name field's placeholder: the stand-in the heading shows while no name is saved. */
  placeholder?: string;
  busy: boolean;
  failed: boolean;
  photoBusy: boolean;
  photoError: string | null;
  onOpen(): void;
  onDraft(text: string): void;
  onSave(): void;
  onCancel(): void;
  onPhoto(file: File): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function WhoBlock(props: WhoBlockProps): React.JSX.Element {
  return props.open ? <WhoEditor {...props} /> : <WhoButton {...props} />;
}

/** The drawing's `.av`: 56, ink, white initials. Drawn, not read (the name follows it). */
function Face({ initials, avatar }: { initials: string; avatar: string | null }) {
  return (
    <AvatarRoot aria-hidden size="xl" className="h-14 w-14 border-0 bg-action">
      {avatar && <AvatarImage src={avatar} alt="" />}
      <AvatarFallback className="bg-action text-title font-[640] text-action-foreground">{initials}</AvatarFallback>
    </AvatarRoot>
  );
}

function WhoButton({ name, initials, avatar, line, onOpen, buttonRef }: WhoBlockProps) {
  return (
    // 10 above, 18 below to the first section (the drawing's `.who`): 10 inside, 8 outside, so the
    // hover tint keeps even edges.
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className="mb-2 flex w-full items-center gap-3.5 rounded-3xl px-1 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
    >
      <Face initials={initials} avatar={avatar} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{WHO_EDIT}</span>
        <span className={cn("block truncate text-heading font-bold", name ? "text-foreground" : "text-foreground-muted")}>{name || "Add"}</span>
        {/* The leading space keeps the button's name "… Nia Test @nia.tests", not "Nia Test@nia.tests". */}
        {line && <span className="block truncate text-ui text-foreground-secondary"> {line}</span>}
      </span>
    </button>
  );
}

function WhoEditor({ initials, avatar, draft, placeholder, busy, failed, photoBusy, photoError, onDraft, onSave, onCancel, onPhoto }: WhoBlockProps) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Opened: the focus in the name, the caret after it.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);
  const empty = draft.trim() === "";
  return (
    <Card className="mb-2 p-[18px]" onKeyDown={cancelOnEscape(busy, onCancel)}>
      <div className="flex items-center gap-3.5">
        <Face initials={initials} avatar={avatar} />
        <Button
          type="button"
          variant="secondary"
          aria-busy={photoBusy || undefined}
          aria-disabled={photoBusy || undefined}
          onClick={() => {
            if (!photoBusy) fileRef.current?.click();
          }}
          className={ROW_BUTTON}
        >
          {CHANGE_PHOTO}
        </Button>
        {/* The picker behind the button: out of the tab order and of the accessibility tree. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPhoto(file);
          }}
        />
      </div>
      {photoError && <ErrorLine>{photoError}</ErrorLine>}
      <label htmlFor={`${id}-name`} className="mt-4 block text-title font-[640] text-foreground">
        {NAME_LABEL}
      </label>
      <input
        id={`${id}-name`}
        ref={fieldRef}
        type="text"
        value={draft}
        placeholder={placeholder}
        maxLength={NAME_MAX}
        // Read-only while the save is out (as a fact's field): what is typed then would be dropped.
        readOnly={busy}
        autoComplete="name"
        aria-invalid={failed || undefined}
        aria-describedby={failed ? `${id}-error` : undefined}
        onChange={(e) => onDraft(e.target.value.slice(0, NAME_MAX))}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (!busy && !empty) onSave();
        }}
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
        className="mt-2 h-12 w-full rounded-lg bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-11 md:text-ui"
      />
      {failed && <ErrorLine id={`${id}-error`}>{SAVE_FAILED}</ErrorLine>}
      <EditorActions busy={busy} saveDisabled={empty} onCancel={onCancel} onSave={onSave} />
    </Card>
  );
}
