"use client";

import * as React from "react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISCOVER_STRINGS, pullLine, pullTitle } from "@/lib/discover-next/discover-words";
import type { PullTarget } from "@/lib/discover-next/pull";
import { cn } from "@/lib/utils";

/**
 * The pull offer (spec 3.6; drawing frame 6): a row, never a start. "Pull @jay.makes's best videos",
 * "Ranked against their own average. 5 credits." and Pull; for words "Pull videos about “meal prep”",
 * "5 credits" and Pull. The price is said before the tap. Shown above the hub's grid for a search, and
 * on the pull page reached by its address. Presentational: Pull calls back, the container starts.
 *
 * - A link to another platform is its sentence alone, a status, with no button: nothing there can be
 *   pulled, so nothing is offered for a price.
 * - Pull is described by the row's two lines, so a screen reader hears what it pulls and what it costs.
 * - `aside` (the pull page's Follow, on a phone) sits at the right of the row's first line, above Pull.
 */
export interface PullOfferProps {
  target: PullTarget;
  onPull?(): void;
  /** The Pull button (the pull page hands it the focus when the offer comes back). */
  actionRef?: React.Ref<HTMLButtonElement>;
  /** At the right of the first line (the title's), above Pull. */
  aside?: React.ReactNode;
  className?: string;
}

const S = DISCOVER_STRINGS.pull;

export function PullOffer({ target, onPull, actionRef, aside, className }: PullOfferProps): React.JSX.Element {
  const id = useId();

  if (target.kind === "not-tiktok") {
    return (
      <Card data-part="pull-offer" role="status" className={cn("px-4 py-3.5", className)}>
        <p className="text-ui text-foreground-secondary">{S.notTikTok}</p>
      </Card>
    );
  }

  const title = (
    <p id={`${id}-title`} className="min-w-0 break-words text-ui font-[640] text-foreground">
      {pullTitle(target)}
    </p>
  );
  const line = (
    <p id={`${id}-line`} className="min-w-0 text-meta text-foreground-secondary">
      {pullLine(target)}
    </p>
  );
  const pull = (
    <Button
      ref={actionRef}
      type="button"
      variant="primary"
      size="sm"
      aria-describedby={`${id}-title ${id}-line`}
      onClick={onPull}
      className="shrink-0 justify-self-end px-4 next:rounded-full"
    >
      {S.button}
    </Button>
  );

  if (aside) {
    // Two rows of a grid: the title with the aside at its right, then the line with Pull at its right.
    return (
      <Card data-part="pull-offer" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3.5 pl-4 pr-3.5", className)}>
        <div data-part="first-line" className="contents">
          {title}
          <div className="justify-self-end">{aside}</div>
        </div>
        {line}
        {pull}
      </Card>
    );
  }

  return (
    <Card data-part="pull-offer" className={cn("flex items-center gap-3 py-3.5 pl-4 pr-3.5", className)}>
      <div className="min-w-0 flex-1">
        {title}
        <div className="mt-0.5">{line}</div>
      </div>
      {pull}
    </Card>
  );
}
