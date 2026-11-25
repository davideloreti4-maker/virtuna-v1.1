"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DISCOVER_STRINGS, followFailed, followNotSaved, readingHandle } from "@/lib/discover-next/discover-words";
import { followInput } from "@/lib/discover-next/watchlist";

import { SheetShell } from "./sheet-shell";

/**
 * "Follow a creator" (spec 3.5): one field for a TikTok @handle or profile link, and Follow. Following
 * is free, so no price is said. Presentational: the container follows and hands back what is happening.
 *
 * - The field takes the focus on open; each opening starts empty (the form mounts with the open sheet).
 * - A text that is not a TikTok @handle or link Maven can read is refused under the field (the field
 *   marked and described by it, the focus kept there); nothing is sent.
 * - While Maven reads the account (`status` reading): "Reading @handle", the field read-only, Follow
 *   waiting, and the sheet holds against Escape, the scrim and the handle (the answer needs a sheet to
 *   land in). A second submit sends nothing.
 * - A failure is said in the sheet; the field can be changed and sent again. When the account could not
 *   be read the sentence asks to check the handle; when it was read and the follow itself was refused,
 *   the handle was fine, so it only asks to try again.
 */
export type FollowStatus =
  | { kind: "reading"; handle: string }
  /** `step`: where it failed, reading the account (the default) or following it once read. */
  | { kind: "failed"; handle: string; step?: "read" | "follow" }
  | null;

export interface FollowSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  status: FollowStatus;
  /** A handle Maven can read, without its "@". */
  onFollow(handle: string): void;
  /** Where the focus goes on close when what opened the sheet has left the page. */
  returnFocus?: () => HTMLElement | null;
}

const S = DISCOVER_STRINGS.follow;

function FollowForm({ status, onFollow, fieldRef }: { status: FollowStatus; onFollow(handle: string): void; fieldRef: React.RefObject<HTMLInputElement | null> }) {
  const [text, setText] = useState("");
  const [refused, setRefused] = useState(false);
  const messageId = useId();
  const reading = status?.kind === "reading";
  const message = refused
    ? S.badInput
    : status?.kind === "failed"
      ? (status.step === "follow" ? followNotSaved : followFailed)(status.handle)
      : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (reading) return;
    const handle = followInput(text);
    if (!handle) {
      setRefused(true);
      fieldRef.current?.focus();
      return;
    }
    setRefused(false);
    onFollow(handle);
  };

  return (
    <form noValidate onSubmit={submit} className="mt-4">
      <input
        ref={fieldRef}
        type="text"
        aria-label={S.fieldName}
        placeholder={S.placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setRefused(false);
        }}
        readOnly={reading}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
        className="block h-12 w-full rounded-2xl bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted read-only:text-foreground-secondary md:text-ui"
      />
      {message && (
        <p id={messageId} role="alert" className="mt-2 px-1 text-meta text-error">
          {message}
        </p>
      )}
      {/* On the page from the start, so the reading is announced when it begins. */}
      <p role="status" className={reading ? "mt-2 px-1 text-meta text-foreground-secondary" : "sr-only"}>
        {reading ? readingHandle(status.handle) : ""}
      </p>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        aria-disabled={reading || undefined}
        aria-busy={reading || undefined}
        className="mt-3 w-full next:rounded-full aria-disabled:opacity-60"
      >
        {S.button}
      </Button>
    </form>
  );
}

export function FollowSheet({ open, onOpenChange, status, onFollow, returnFocus }: FollowSheetProps): React.JSX.Element {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={S.title}
      busy={status?.kind === "reading"}
      returnFocus={returnFocus}
      initialFocus={() => fieldRef.current}
    >
      <FollowForm status={status} onFollow={onFollow} fieldRef={fieldRef} />
    </SheetShell>
  );
}
