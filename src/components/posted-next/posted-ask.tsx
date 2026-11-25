"use client";

import * as React from "react";

import { ChevronIcon } from "@/components/thread-next/field-icons";
import { Card } from "@/components/ui/card";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";

/**
 * The quiet row under a result's first block (spec 2026-11-24-after-posting §3.1; drawing frame 2):
 * "Posted it?" over "Add the link and see what it did.", and a chevron. The whole row is one button,
 * 64 tall, that opens the sheet. Shown only for a piece with a number and no posted link (the container
 * decides). Presentational.
 */
export interface PostedAskProps {
  onOpen(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function PostedAsk({ onOpen, buttonRef }: PostedAskProps): React.JSX.Element {
  return (
    <Card data-posted-ask="" className="p-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          // Safari does not focus a button on a tap: focused here, so the sheet has a place to hand
          // the focus back to.
          e.currentTarget.focus();
          onOpen();
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl px-[18px] py-3 text-left transition-colors duration-150 hover:bg-hover"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-[640] text-foreground">{POSTED_STRINGS.askTitle}</span>
          {/* The leading space keeps the button's name "Posted it? Add the link…", not "Posted it?Add…". */}
          <span className="block text-meta text-foreground-secondary"> {POSTED_STRINGS.askText}</span>
        </span>
        <ChevronIcon size={18} aria-hidden className="shrink-0 text-foreground-muted" />
      </button>
    </Card>
  );
}
