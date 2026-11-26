"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";

import { PlusIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { Platform } from "@/lib/connected-accounts/connected-accounts-repo";
import { cn } from "@/lib/utils";

import { ErrorLine, ROW_BUTTON, cancelOnEscape } from "./row-parts";
import { HANDLE_LABELS, HANDLE_PLACEHOLDERS, PLATFORMS, PLATFORM_NAMES } from "./you-words";

/** The longest handle `POST /api/connected-accounts/connect` takes (an "@" in front is dropped first). */
export const HANDLE_MAX = 50;

/**
 * The Accounts card's last row (spec §3.1 point 5): "Connect an account"; open, the three platforms,
 * the @handle field and Connect, as the existing dialog asks for them (`connect-account-dialog.tsx`),
 * with the route's own messages (rulings 6). A connect reads a public profile (free, no credits).
 */
export interface ConnectRowProps {
  open: boolean;
  platform: Platform;
  handle: string;
  busy: boolean;
  error: string | null;
  onOpen(): void;
  onPlatform(platform: Platform): void;
  onHandle(text: string): void;
  onConnect(): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function ConnectRow(props: ConnectRowProps): React.JSX.Element {
  if (props.open) return <ConnectEditor {...props} />;
  return <ConnectButton onOpen={props.onOpen} buttonRef={props.buttonRef} />;
}

/** The drawing's last Accounts row: the name at 16, a quiet "+" where the others have a chevron. */
function ConnectButton({ onOpen, buttonRef }: Pick<ConnectRowProps, "onOpen" | "buttonRef">) {
  return (
    <button ref={buttonRef} type="button" onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 py-3.5 text-left">
      <span className="flex-1 text-title font-[640] text-foreground">Connect an account</span>
      <PlusIcon size={18} aria-hidden className="shrink-0 text-foreground-muted" />
    </button>
  );
}

function ConnectEditor({ platform, handle, busy, error, onPlatform, onHandle, onConnect, onCancel }: ConnectRowProps) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  // Opened: the focus in the handle.
  useLayoutEffect(() => {
    fieldRef.current?.focus();
  }, []);
  const clean = handle.replace(/^@/, "").trim();
  const holds = busy || clean === "";
  return (
    <div className="pb-4 pt-3.5" onKeyDown={cancelOnEscape(busy, onCancel)}>
      <p className="text-title font-[640] text-foreground">Connect an account</p>
      <div role="group" aria-label="Platform" className="mt-2.5 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <Chip
            key={p}
            selected={platform === p}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onPlatform(p);
            }}
          >
            {PLATFORM_NAMES[p]}
          </Chip>
        ))}
      </div>
      <label htmlFor={`${id}-handle`} className="mt-3 block text-meta text-foreground-secondary">
        {HANDLE_LABELS[platform]}
      </label>
      <input
        id={`${id}-handle`}
        ref={fieldRef}
        type="text"
        value={handle}
        // One more than the route takes: room for the "@" it drops.
        maxLength={HANDLE_MAX + 1}
        placeholder={HANDLE_PLACEHOLDERS[platform]}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
        readOnly={busy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onHandle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (!holds) onConnect();
        }}
        // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
        className="mt-1.5 h-12 w-full rounded-lg bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-11 md:text-ui"
      />
      {error && <ErrorLine id={`${id}-error`}>{error}</ErrorLine>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="quiet"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onCancel();
          }}
          className={ROW_BUTTON}
        >
          Cancel
        </Button>
        {/* `aria-disabled`, never `disabled`: a disabled button would drop the focus while it reads. */}
        <Button
          type="button"
          variant="primary"
          aria-disabled={holds || undefined}
          aria-busy={busy || undefined}
          onClick={() => {
            if (!holds) onConnect();
          }}
          className={cn(ROW_BUTTON, "aria-disabled:opacity-40")}
        >
          {busy ? `Reading @${clean}…` : "Connect"}
        </Button>
      </div>
    </div>
  );
}
