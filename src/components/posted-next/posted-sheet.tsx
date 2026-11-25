"use client";

import * as React from "react";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { useReturnFocus } from "@/components/thread-next/use-return-focus";
import { ErrorLine } from "@/components/you-next/row-parts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAddPosted, type PostedPiece } from "@/hooks/queries/use-posted";
import { parsePostLink } from "@/lib/posted/posted";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { cn } from "@/lib/utils";

/**
 * "Posted it?" (spec 2026-11-24-after-posting §3.1; drawing frame 2): one field, "TikTok link", and
 * "Add link". The shell is the app's own, as the answer sheet's (`thread-next/answer-sheet.tsx`): on a
 * phone the `Sheet` part as a bottom sheet, from 768 a centred Radix dialog. Opened from the result
 * page's ask row, and from a Library row's menu.
 *
 * - The field takes the focus on open. Enter or Add link sends it. An empty link, or one that is not a
 *   TikTok link (`parsePostLink`), says "That's not a TikTok link." under the field (tied to it) and sends
 *   nothing. The server's refusals have their own words (`useAddPosted`).
 * - While the request runs the button waits (`aria-disabled`, never `disabled`: the focus stays), the
 *   field is read-only, a second submit sends nothing, and Escape, the scrim and the handle do not close
 *   it (an answer must have a sheet to land in).
 * - Added: it closes, and the focus returns to what opened it; if that has left (the ask row turned into
 *   the card), to `returnFocus`. The piece then says "Reading the post".
 */
export interface PostedSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  piece: PostedPiece;
  /** Where the focus goes on close when what opened the sheet has left the page. */
  returnFocus?: () => HTMLElement | null;
}

/**
 * The width is read from the store `matchMedia` keeps, so a sheet that mounts open on a desk is the
 * dialog from its first commit (the shared `useMediaQuery` answers false until after mount). False on
 * the server.
 */
const WIDE = "(min-width: 768px)";
function subscribeWide(onChange: () => void) {
  const list = window.matchMedia(WIDE);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
const wideNow = () => window.matchMedia(WIDE).matches;
const wideOnServer = () => false;

const TITLE = "text-subhead font-[640] tracking-[-0.018em] text-foreground";
const LINE = "mt-1.5 text-ui text-foreground-secondary";

/**
 * "Close", for a screen reader on a touch screen (the handle is hidden from it, the scrim is not a
 * control, there is no Escape key): out of sight until the keyboard reaches it (the answer sheet's).
 */
const CLOSE =
  "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-4 focus-visible:top-4 focus-visible:z-[1] focus-visible:rounded-full focus-visible:bg-surface-sunken focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-meta focus-visible:font-[560] focus-visible:text-foreground";

/** Sends the link; `refused` gets the words to show when the server says no. */
type Send = (url: string, refused: (words: string) => void) => void;

/** The field and the button. Mounted with the open sheet, so each opening starts empty. */
function PostedForm({ fieldRef, busy, onSend }: { fieldRef: React.RefObject<HTMLInputElement | null>; busy: boolean; onSend: Send }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const errorId = `${id}-error`;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const url = parsePostLink(text);
    if (url === null) {
      setError(POSTED_STRINGS.notTiktok);
      fieldRef.current?.focus();
      return;
    }
    setError(null);
    onSend(url, setError);
  };

  return (
    <form noValidate onSubmit={submit} className="mt-4">
      <label htmlFor={`${id}-link`} className="sr-only">
        {POSTED_STRINGS.field}
      </label>
      <input
        id={`${id}-link`}
        ref={fieldRef}
        // Text with the URL keyboard: a `url` input rewrites its own value (it strips spaces and line
        // breaks), so what the field holds would not be what the creator sees or what is checked.
        type="text"
        inputMode="url"
        value={text}
        placeholder={POSTED_STRINGS.placeholder}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        readOnly={busy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
        className="h-12 w-full rounded-full bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-11 md:text-ui"
      />
      {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        className="mt-3 w-full next:rounded-full aria-disabled:opacity-40"
      >
        {POSTED_STRINGS.submit}
      </Button>
    </form>
  );
}

export function PostedSheet({ open, onOpenChange, piece, returnFocus }: PostedSheetProps): React.JSX.Element {
  const wide = useSyncExternalStore(subscribeWide, wideNow, wideOnServer);
  const add = useAddPosted();
  // Out as of the last submit, not the last render: two submits can land before a render. `busy` is
  // what the render shows, set in the same tap (the mutation's own state reaches the render a tick later).
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  // Opened from a plain button, not a Radix trigger: the focus is handed back by hand.
  const { sheetFocus } = useReturnFocus(returnFocus);

  const change = (next: boolean) => {
    if (!next && sending.current) return;
    onOpenChange(next);
  };
  const focus = {
    onOpenAutoFocus: (event: Event) => {
      sheetFocus.onOpenAutoFocus();
      event.preventDefault();
      fieldRef.current?.focus();
    },
    onCloseAutoFocus: sheetFocus.onCloseAutoFocus,
  };
  const send: Send = (url, refused) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    add.mutate(
      { piece, url },
      {
        onSuccess: () => {
          sending.current = false;
          setBusy(false);
          onOpenChange(false);
        },
        onError: (error) => {
          sending.current = false;
          setBusy(false);
          refused(error.message);
        },
      },
    );
  };

  const form = <PostedForm fieldRef={fieldRef} busy={busy} onSend={send} />;

  if (wide) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={change}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-posted-sheet="scrim"
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            data-posted-sheet="dialog"
            {...focus}
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] max-h-[calc(100dvh-48px)] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-4xl bg-surface p-6 text-foreground shadow-[var(--shadow-float)] motion-safe:duration-200 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className={TITLE}>{POSTED_STRINGS.sheetTitle}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={LINE}>{POSTED_STRINGS.sheetText}</DialogPrimitive.Description>
            {form}
            <DialogPrimitive.Close className={CLOSE}>Close</DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent
        side="bottom"
        data-posted-sheet="sheet"
        showCloseButton={false}
        {...focus}
        onHandleDismiss={() => change(false)}
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-0"
      >
        <SheetTitle className={cn(TITLE, "mt-1")}>{POSTED_STRINGS.sheetTitle}</SheetTitle>
        <SheetDescription className={LINE}>{POSTED_STRINGS.sheetText}</SheetDescription>
        {form}
        <SheetClose className={CLOSE}>Close</SheetClose>
      </SheetContent>
    </Sheet>
  );
}
