"use client";

import * as React from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { REMIX_BRIEF_MAX } from "@/lib/discover-next/remix";

import { SheetShell } from "./sheet-shell";

/**
 * "What do you want to make from this?" (spec 3.3, the main button): one optional field of three
 * lines and Remix, asked before a remix of a library video starts. Presentational: the container
 * starts the run with what it is handed.
 *
 * - Remix closes the sheet and hands on the brief trimmed, or null when it is blank. Never "": the
 *   remix route reads an empty brief as a target, which would replace the creator's niche with nothing.
 * - The field is named by the question and takes no more than the route does (`REMIX_BRIEF_MAX`).
 * - Each opening starts empty (the form mounts with the open sheet).
 */
export interface RemixSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onRemix(brief: string | null): void;
  /** Where the focus goes on close when the main button has left the page. */
  returnFocus?: () => HTMLElement | null;
}

const S = DISCOVER_STRINGS.remixSheet;

function RemixForm({ onRemix }: { onRemix(brief: string | null): void }) {
  const [text, setText] = useState("");
  // One remix per opening: a second tap can land before the sheet has gone.
  const sent = useRef(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sent.current) return;
    sent.current = true;
    const brief = text.trim();
    onRemix(brief === "" ? null : brief);
  };

  return (
    <form noValidate onSubmit={submit} className="mt-4">
      <textarea
        rows={3}
        maxLength={REMIX_BRIEF_MAX}
        aria-label={S.title}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
        className="block w-full resize-none rounded-2xl bg-surface-sunken px-4 py-3 text-title leading-[1.4] text-foreground placeholder:text-foreground-muted md:text-ui"
      />
      <Button type="submit" variant="primary" size="lg" className="mt-3 w-full next:rounded-full">
        {S.button}
      </Button>
    </form>
  );
}

export function RemixSheet({ open, onOpenChange, onRemix, returnFocus }: RemixSheetProps): React.JSX.Element {
  return (
    <SheetShell open={open} onOpenChange={onOpenChange} title={S.title} returnFocus={returnFocus}>
      <RemixForm
        onRemix={(brief) => {
          onOpenChange(false);
          onRemix(brief);
        }}
      />
    </SheetShell>
  );
}
