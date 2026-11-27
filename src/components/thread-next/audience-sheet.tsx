"use client";

import * as React from "react";
import { PlatformLogo, platformIdOf } from "@/components/brand/platform-logo";
import { useId } from "react";

import { PlusIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Audience } from "@/lib/audience/audience-types";
import { audienceChoices, type AudienceChoice } from "@/lib/thread-next/audience-choices";

import { CheckIcon } from "./answer-icons";
import { CloseIcon } from "./field-icons";
import { LensControl, type Lens } from "./more-sheet";
import { useReturnFocus } from "./use-return-focus";

/**
 * The audience sheet (spec 2026-11-23 §4): who the next run is for, and the platform it is read
 * for. It replaces the old picker under the new look, opened from the field's audience control on
 * Home and from the "Audience" row of the thread's More sheet.
 *
 * On the phone it is a bottom sheet. From 768 up, when the caller hands it an element to stand on
 * (`anchorRef`), it is a popover on that element: above it in a thread, below it on Home
 * (`side`), where the field sits near the top of the page. Both are Radix layers: Escape and a tap
 * outside close them. It opens from plain buttons, so it hands focus back itself
 * (`useReturnFocus`); when what opened it has left the page (More's row), focus goes to the
 * field's text.
 */

export interface AudienceSheetProps {
  open: boolean; onOpenChange(open: boolean): void;
  audiences: Audience[]; selectedId: string | null;
  onSelect(audience: Audience): void;          // the caller closes the sheet
  onNewAudience(): void;
  lens: Lens; onLensChange(lens: Lens): void;
  note?: string | null;                        // the quiet line under the platform control
  anchorRef?: React.RefObject<HTMLElement | null>;   // from 768: the popover stands on this element
  side?: "top" | "bottom";                     // default "top" (a thread); Home passes "bottom"
}

function ChoiceRow({ choice, onSelect }: { choice: AudienceChoice; onSelect(audience: Audience): void }) {
  // Named for the audience alone, so "tap @nia" finds it; what it is modeled on is the description.
  const id = useId();
  return (
    <button
      type="button"
      aria-pressed={choice.selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-line`}
      onClick={() => onSelect(choice.audience)}
      className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className="block truncate text-ui font-[560] text-foreground">{choice.audience.name}</span>
        <span id={`${id}-line`} className="flex items-center gap-1.5 text-meta text-foreground-secondary">
          {choice.audience.source_account_id && platformIdOf(choice.audience.platform) && (
            <PlatformLogo platform={platformIdOf(choice.audience.platform)!} size={13} />
          )}
          <span className="min-w-0 truncate">{choice.line}</span>
        </span>
      </span>
      {choice.selected && <CheckIcon size={18} aria-hidden className="shrink-0 text-foreground" />}
    </button>
  );
}

/** Its text lines up with the audiences above it; the "+" sits in the column the check uses (a
 *  leading disc pushed this one row's text 48 px in from the others). */
function NewAudienceRow({ onClick }: { onClick: () => void }) {
  const id = useId();
  return (
    <button
      type="button"
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-line`}
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className="block text-ui font-[560] text-foreground">New audience</span>
        <span id={`${id}-line`} className="block text-meta text-foreground-secondary">Connect an account or describe one</span>
      </span>
      <PlusIcon size={18} strokeWidth={2} aria-hidden className="shrink-0 text-foreground-secondary" />
    </button>
  );
}

function AudienceBody({
  title,
  audiences,
  selectedId,
  onSelect,
  onNewAudience,
  lens,
  onLensChange,
  note,
  onOpenChange,
}: AudienceSheetProps & { title: React.ReactNode }) {
  const choices = audienceChoices(audiences, selectedId);
  return (
    <>
      <div className="mt-1 flex h-11 items-center justify-between px-1">
        {title}
        <IconButton surface="card" aria-label="Close" onClick={() => onOpenChange(false)} className="h-8 w-8 [&_svg]:size-[15px]">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>

      <div className="divide-y divide-border">
        {choices.map((choice) => (
          <ChoiceRow key={choice.audience.id} choice={choice} onSelect={onSelect} />
        ))}
        <NewAudienceRow onClick={onNewAudience} />
      </div>

      {/* A heading one level under the sheet's title (the sheet's and the popover's are h2). Not
          "Platform": every row above already names one (where it was modelled), so that read as
          a filter on the list. This is the platform the next run is simulated for. */}
      <h3 className="mx-1 mb-1 mt-3.5 text-meta font-[560] text-foreground-secondary">Simulating for</h3>
      <LensControl lens={lens} onLensChange={onLensChange} />
      {note && <p className="mx-1 mt-2 text-meta text-foreground-secondary">{note}</p>}
    </>
  );
}

export function AudienceSheet(props: AudienceSheetProps): React.JSX.Element {
  const { open, onOpenChange, anchorRef, side } = props;
  const wide = useMediaQuery("(min-width: 768px)");
  const titleId = useId();
  const focus = useReturnFocus(() => anchorRef?.current?.querySelector("textarea") ?? null);

  if (wide && anchorRef) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
        <PopoverContent
          side={side ?? "top"}
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-labelledby={titleId}
          {...focus.popoverFocus}
          className="z-[var(--z-modal)] max-h-[var(--radix-popover-content-available-height)] w-[360px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-4xl border-0 bg-surface p-0 px-4 pb-4 pt-1 text-foreground shadow-[var(--shadow-float)]"
        >
          <AudienceBody
            {...props}
            title={
              <h2 id={titleId} className="text-title font-[640] text-foreground">
                Audience
              </h2>
            }
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        {...focus.sheetFocus}
        // More's sheet, plus its own scroll: a creator with many audiences can outgrow the screen.
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))]"
      >
        <AudienceBody {...props} title={<SheetTitle className="text-title font-[640]">Audience</SheetTitle>} />
      </SheetContent>
    </Sheet>
  );
}
