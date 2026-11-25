"use client";

import * as React from "react";
import { useId } from "react";

import { Face } from "@/components/audience-next/face";
import { ReadAgainIcon } from "@/components/audience-next/source-card";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import type { CreatorPage } from "@/lib/discover-next/creator";
import { DISCOVER_STRINGS, creatorLine } from "@/lib/discover-next/discover-words";
import { initialOf } from "@/lib/discover-next/watchlist";
import { cn } from "@/lib/utils";

/**
 * Who a followed creator is, at the top of their page (spec 3.2.2 and 3.3; drawing frame 2), drawn as the
 * Audience page's source card: the picture (or the initial on a sunken disc), the name, one line
 * ("@jay.makes · TikTok · read 13 Jul · 12 videos"), at the right Read again and what the screen hands in
 * after it (the phone's More), and under the row the bio. Presentational: the container reads.
 *
 *   (J)  Jay Makes                               (↻) (···)
 *        @jay.makes · TikTok · read 13 Jul · 12 videos
 *   Furniture from hand tools, one board at a time.
 *
 * - No name: the handle is the heading, and the line leaves it out. A part of the line that is not known
 *   goes with its dot.
 * - The name and the bio are a stranger's text of any length: the name is cut at two lines (a 320 phone
 *   leaves the words about 104 wide), the bio at three, and a word longer than its column breaks, so
 *   neither widens the card.
 * - Read again while a read is out: it turns (only where motion is allowed) and is busy, the line says
 *   "Reading…" where the date stood (a creator that could not be read: in place of "Couldn't be read"),
 *   and a press does nothing.
 * - Read today: dimmed, and described by the reason for a screen reader. It stays pressable: the
 *   container answers a press with that sentence, so the dimmed button is never a dead end.
 * - A creator whose read failed with nothing kept: the initial, the handle, "Couldn't be read"; no name,
 *   no picture, no bio.
 */

const S = DISCOVER_STRINGS.creator;

export interface CreatorCardProps {
  creator: CreatorPage;
  /** A read is out. */
  reading: boolean;
  onReadAgain(): void;
  /** After Read again: the phone's More (the screen hides it from 768, where the header has its own). */
  more: React.ReactNode;
}

export function CreatorCard({ creator, reading, onReadAgain, more }: CreatorCardProps): React.JSX.Element {
  const readTodayId = useId();
  const { handle, held, videos } = creator;
  const name = held ? null : creator.name || null;
  const bio = held ? null : creator.bio || null;
  const dimmed = !reading && !creator.canReadAgain;
  // A read out says so before anything else, held or not: pressing Read again must show it is reading.
  const line = held
    ? reading
      ? S.reading
      : S.held
    : creatorLine({ handle: name === null ? null : handle, read: reading ? S.reading : creator.read, videos: videos.length });

  return (
    <Card data-part="creator-card" className="flex flex-col rounded-[22px] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <Face face={{ initial: initialOf(handle), picture: held ? null : creator.avatarUrl }} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 break-words text-title font-[650] text-foreground">{name ?? `@${handle}`}</h2>
          {/* Polite: "Reading…" taking the date's place is said once, without taking the focus. */}
          <p aria-live="polite" className="break-words text-meta text-foreground-secondary tabular-nums">
            {line}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* `aria-disabled`, not `disabled`: the button keeps the focus through a read, and read today a
              press still reaches the container. */}
          <IconButton
            surface="card"
            aria-label={S.readAgain}
            aria-busy={reading || undefined}
            aria-disabled={reading || dimmed || undefined}
            aria-describedby={dimmed ? readTodayId : undefined}
            onClick={() => {
              if (!reading) onReadAgain();
            }}
            className={cn(dimmed && "opacity-40")}
          >
            <ReadAgainIcon aria-hidden className={cn(reading && "motion-safe:animate-spin")} />
          </IconButton>
          {dimmed && (
            <span id={readTodayId} className="sr-only">
              {S.readToday}
            </span>
          )}
          {more}
        </div>
      </div>
      {bio && (
        <p data-part="bio" className="mt-2.5 line-clamp-3 break-words text-ui text-foreground-secondary">
          {bio}
        </p>
      )}
    </Card>
  );
}
