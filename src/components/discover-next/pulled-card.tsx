"use client";

import * as React from "react";
import { useId } from "react";

import { cardName } from "@/lib/discover-next/card";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { cn } from "@/lib/utils";

import { CARD_BOX, VideoCardFace, cardDescribedBy, type CardFoot } from "./video-card";

/**
 * A pulled video as a card: the library card's face, as a button (it has no page; a press opens its
 * sheet). One for the pull page and a creator's page, whose cards say their views alone (`foot`).
 */
export function PulledCard({
  video,
  onOpen,
  foot,
}: {
  video: PulledVideo;
  onOpen(video: PulledVideo, from: HTMLElement): void;
  foot?: CardFoot;
}): React.JSX.Element {
  const id = useId();
  return (
    <button
      type="button"
      aria-label={cardName(video)}
      aria-describedby={cardDescribedBy(id, video, foot)}
      aria-haspopup="dialog"
      onClick={(e) => {
        // Safari does not focus a button on a tap: focused here, so the sheet has it to hand back.
        e.currentTarget.focus();
        onOpen(video, e.currentTarget);
      }}
      className={cn(CARD_BOX, "w-full text-left")}
    >
      <VideoCardFace video={video} id={id} foot={foot} />
    </button>
  );
}
