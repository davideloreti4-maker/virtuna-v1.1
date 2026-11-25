"use client";

import { useState } from "react";

import { creditCost } from "@/lib/pricing";
import { accountCardOf, type AccountCard } from "@/lib/thread-next/account-card";
import { landStyle } from "@/lib/thread-next/landing";
import type { AccountReadBlock } from "@/lib/tools/blocks";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, PROSE, keepHyphens } from "./answer-card";
import { VideoIcon } from "./answer-icons";
import { BulbIcon } from "./field-icons";

/**
 * The account read's card (thread depth, second part §3; drawn on the review page, "The account
 * read, as a card"): who was read, the two videos that carry the account, what to fix, one line of
 * habits, one button. Every word comes through `accountCardOf`; a part with nothing to show is left
 * out and takes no room.
 *
 * - Who: the avatar (a picture, else the initials; a picture that fails to load falls back to
 *   them), "@handle" and "12.4K followers · 86 videos" under it.
 * - "What works": the two most viewed videos, each its cover, its caption on one line and "854K
 *   views". Rows are not links. No videos: no group. A cover that is missing or does not load (a
 *   stored read's addresses expire) leaves its tile with the look's video mark in it, as a chat's
 *   tile on Home: an empty tile reads as a broken picture, and taking it away would move the titles.
 * - "To fix": one plain sentence pair per line the run sent. None: no group.
 * - The habits line. Neither half: no line.
 * - "Ideas from what works" · "1 credit", the card's one primary: `onIdeas(ask)`; without it the
 *   button is drawn and does nothing. No videos: no button.
 * - In a landing (thread feel §4.3, `[data-thread-landing] .land`): the groups come in one after
 *   another, then the button (`accountLands`). The card itself takes its height at once.
 *
 * Not shown, on purpose (§3): the strip of all covers, the short and long split as a chart,
 * `working` as text, `dropPoints`, the track record.
 *
 * Geometry as drawn (`.d-who`, `.d-g`, `.d-v`, `.d-hab`): who 12 above and under, the avatar 40
 * round, 11 to the words (15 / 21 at 640; 13 / 18 in the secondary ink); a group a hairline in the
 * look's line colour, 11 above and 12 under, its label 12 / 16 at 640 in the secondary ink with 6
 * under; a video row the cover 30 by 40 at radius 6 (drawn 7, the card scale's nearest), 11 to the
 * caption (15 / 21 at 520) over the views (13 / 18, tabular), 9 between the two rows; a fix 15 / 21,
 * 6 between; the habits 13 / 19 in the secondary ink, 11 above and 14 under its hairline.
 */

const IDEAS_PRICE = creditCost("ideas");

/** A group's frame: the hairline above it and its padding. */
const GROUP = "border-t border-border px-0.5 pb-3 pt-[11px]";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-label font-[640] leading-4 text-foreground-secondary">{children}</h3>;
}

/**
 * A card's places in a landing, one after another in its order: who, "What works", "To fix", the
 * habits, the button; a part the card does not have takes no place. `last` is the last part's place.
 */
export function accountLands(card: AccountCard) {
  let next = 0;
  const who = next++;
  const works = card.videos.length > 0 ? next++ : null;
  const fix = card.fixes.length > 0 ? next++ : null;
  const habits = card.habits ? next++ : null;
  const button = card.ask ? next++ : null;
  return { who, works, fix, habits, button, last: next - 1 };
}

/** The avatar: the picture, else the initials; a picture that fails to load falls back to them. */
function Avatar({ src, initials }: { src: string | null; initials: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    // The handle beside it names the account: the picture and the letters are decoration.
    <span
      aria-hidden
      data-part="account-avatar"
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-meta font-[560] text-foreground-secondary"
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- a scraped picture address (it can expire); next/image has nothing to optimise
        <img src={src} alt="" onError={() => setFailed(src)} className="block size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/** A video's cover, 30 by 40 on the sunken fill; none, or one that fails to load: the video mark (16) in it. */
function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <span data-part="account-cover" className="flex h-10 w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- a stored cover address (it can expire); next/image has nothing to optimise
        <img src={src} alt="" onError={() => setFailed(src)} className="block size-full object-cover" />
      ) : (
        <VideoIcon size={16} aria-hidden data-part="account-cover-mark" className="text-foreground-secondary" />
      )}
    </span>
  );
}

export function AccountAnswer({ block, onIdeas }: { block: AccountReadBlock; onIdeas?: (ask: string) => void }) {
  const card = accountCardOf(block.props);
  const land = accountLands(card);
  const { who, videos, fixes, habits, ask } = card;

  return (
    <AnswerCard>
      <div data-part="account-who" className="land flex items-center gap-[11px] px-0.5 py-3" style={landStyle(land.who)}>
        <Avatar src={who.avatar} initials={who.initials} />
        <div className="min-w-0">
          <p className="truncate text-ui font-[640] leading-[21px] text-foreground">@{who.handle}</p>
          {who.counts && <p className="text-meta leading-[18px] text-foreground-secondary">{who.counts}</p>}
        </div>
      </div>
      {land.works !== null && (
        <div data-part="account-works" className={cn("land", GROUP, PROSE)} style={landStyle(land.works)}>
          <GroupLabel>What works</GroupLabel>
          <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
            {videos.map((video, i) => (
              <li key={i} className="flex items-center gap-[11px]">
                <Cover src={video.cover} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-[520] leading-[21px] text-foreground">{video.title}</p>
                  <p className="text-meta leading-[18px] text-foreground-secondary tabular-nums">{video.views}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {land.fix !== null && (
        <div data-part="account-fix" className={cn("land", GROUP, PROSE)} style={landStyle(land.fix)}>
          <GroupLabel>To fix</GroupLabel>
          <div className="flex flex-col gap-1.5">
            {fixes.map((fix, i) => (
              <p key={i} className="text-pretty text-ui leading-[21px] text-foreground">
                {keepHyphens(fix)}
              </p>
            ))}
          </div>
        </div>
      )}
      {land.habits !== null && (
        <p
          data-part="account-habits"
          className="land border-t border-border px-0.5 pb-3.5 pt-[11px] text-pretty text-meta leading-[19px] text-foreground-secondary"
          style={landStyle(land.habits)}
        >
          {habits}
        </p>
      )}
      {land.button !== null && ask && (
        // A plain block: the footer's own top margin still sits between the habits and the button.
        <div className="land" style={landStyle(land.button)}>
          <AnswerFoot>
            <AnswerPrimary
              icon={<BulbIcon size={20} aria-hidden className="shrink-0" />}
              label="Ideas from what works"
              price={IDEAS_PRICE}
              onClick={onIdeas ? () => onIdeas(ask) : undefined}
            />
          </AnswerFoot>
        </div>
      )}
    </AnswerCard>
  );
}
