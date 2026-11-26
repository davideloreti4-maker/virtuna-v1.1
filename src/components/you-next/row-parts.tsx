"use client";

import Link from "next/link";
import * as React from "react";

import { EARN } from "@/components/shell/nav-config";
import { ChevronIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The parts every row of You shares (plan 2026-11-24-you; drawing `.row`, `.open`, `.btns`): a
 * closed row is one button (its name at 16, what is saved in two lines at most or a quiet "Add",
 * a chevron), at least 64 tall; an open row ends in Cancel and Save, 44 tall, the count at the left.
 */
export function RowButton({ label, value, onOpen, buttonRef }: { label: string; value: string | null; onOpen(): void; buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={buttonRef} type="button" onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 py-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-title font-[640] text-foreground">{label}</span>
        {/* The leading space keeps the button's name "About you Add", not "About youAdd". */}
        <span className={cn("mt-0.5 line-clamp-2 text-ui", value ? "text-foreground-secondary" : "text-foreground-muted")}> {value ?? "Add"}</span>
      </span>
      <ChevronIcon size={18} aria-hidden className="shrink-0 text-foreground-muted" />
    </button>
  );
}

/** A row of the last card: its name and a chevron, to a page; at least 64 tall. */
function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 py-3.5">
      <span className="flex-1 text-title font-[640] text-foreground">{label}</span>
      <ChevronIcon size={18} aria-hidden className="shrink-0 text-foreground-muted" />
    </Link>
  );
}

/**
 * The page's last card: "Settings", to Settings (appearance, log out), and with `earn` the row "Earn" above
 * it (plan 2026-11-24-earn; its name alone, nothing at the right). The You page and the anonymous
 * visitor's card page both end with it, so on the phone Settings is a row there as well as in the menu.
 * The visitor's card holds Settings alone: without an account there is no link to earn with.
 */
export function SettingsRow({ earn = false }: { earn?: boolean }) {
  return (
    <Card className="mt-[18px] px-[18px] py-1">
      {earn ? (
        <ul className="divide-y divide-border">
          <li>
            <LinkRow href={EARN.href} label={EARN.label} />
          </li>
          <li>
            <LinkRow href="/settings" label="Settings" />
          </li>
        </ul>
      ) : (
        <LinkRow href="/settings" label="Settings" />
      )}
    </Card>
  );
}

/** A failed save or a refused photo or connect: in ink (no colour), announced. */
export function ErrorLine({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 px-0.5 text-meta font-[560] text-foreground">
      {children}
    </p>
  );
}

/** The drawing's `.btn`: 44 tall, 20 at the sides, 15 (its corners are the button's own, radius 10). */
export const ROW_BUTTON = "px-5 text-ui";

/**
 * Cancel and Save. `aria-disabled`, never `disabled`, while a save is out or there is nothing to
 * save: a disabled button would drop the focus, and it stays in the tab order saying why it waits.
 */
export function EditorActions({ count, countId, busy, saveDisabled = false, onCancel, onSave }: {
  count?: string;
  countId?: string;
  busy: boolean;
  saveDisabled?: boolean;
  onCancel(): void;
  onSave(): void;
}) {
  const holds = busy || saveDisabled;
  return (
    <div className="mt-3 flex items-center gap-2">
      <span id={countId} className="mr-auto text-meta tabular-nums text-foreground-secondary">
        {count}
      </span>
      <Button type="button" variant="quiet" aria-disabled={busy || undefined} onClick={() => { if (!busy) onCancel(); }} className={ROW_BUTTON}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        aria-disabled={holds || undefined}
        aria-busy={busy || undefined}
        onClick={() => { if (!holds) onSave(); }}
        className={cn(ROW_BUTTON, "aria-disabled:opacity-40")}
      >
        Save
      </Button>
    </div>
  );
}

/** Cancel alone, for the rows a tap saves (Niche, Goal). */
export function CancelButton({ busy, onCancel }: { busy: boolean; onCancel(): void }) {
  return (
    <div className="mt-2 flex justify-end">
      <Button type="button" variant="quiet" aria-disabled={busy || undefined} onClick={() => { if (!busy) onCancel(); }} className={ROW_BUTTON}>
        Cancel
      </Button>
    </div>
  );
}

/** Escape anywhere inside an open row cancels it, unless a save is out. */
export function cancelOnEscape(busy: boolean, onCancel: () => void) {
  return (e: React.KeyboardEvent) => {
    // Escape that dismisses a composition candidate (an IME) belongs to the field, not to the row.
    if (e.key !== "Escape" || busy || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onCancel();
  };
}
