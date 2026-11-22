'use client';

/**
 * ThreadShell — shared conversation container for home skill thread views (P0).
 *
 * Owns the 760px column rhythm (matches Reading) and turn framing:
 *  - User turn: right-aligned echo of the submitted composer draft (optimistic).
 *  - Assistant turn: quiet Maven label + children slot.
 *
 * Flat-warm + matte; zero accent in shell chrome (dosage LOCKED).
 */

import { cn } from '@/lib/utils';
import { NEW_LOOK_ENABLED } from '@/lib/flags/new-look';
import {
  NextUserTurn,
  NextUserTurnFromFile,
  type UserTurnVideo,
} from '@/components/thread-next/user-turn';
import { NextAssistantTurn } from '@/components/thread-next/assistant-label';

export interface ThreadShellProps {
  /** Optimistic echo of the user's submitted prompt (presentation-only). */
  userTurn?: string | null;
  /** Pre-turn content (idle states, empty copy, quick-action cards). */
  before?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /**
   * New look only: the video the echoed turn sends (the composer's staged file, on its live
   * Simulate turns). Shown as a tile above the bubble; ignored with the flag off.
   */
  userVideoFile?: File | null;
}

/**
 * New look: the thread column is the message field's column (reference `.f1-col`): its edges sit on
 * the field's, so 6 inside the composer's own 10 on the phone (16 from the screen edge) and none
 * from 640, where both are the composer column less 16 a side, 720 at most. 12 under the phone's
 * header, 22 under the desktop thread header (answer-system drawing, `.desk .thread` padding-top),
 * and 16 above the field at the thread's end.
 *
 * Its parts are 14 apart on a phone and 16 from md: with the bubble's own -2 (`NextUserTurn`), a
 * question ends 12 above the answer's label on a phone and 14 from md, as the answer-system drawing
 * spaces them (`.ax-msgs` gap 12, `.desk .thread` gap 14).
 */
const NEXT_COLUMN = 'w-full max-w-[720px] mx-auto flex flex-col gap-3.5 md:gap-4 px-1.5 sm:px-0 pt-3 md:pt-[22px] pb-4';

export function ThreadShell({ userTurn, before, children, className, userVideoFile }: ThreadShellProps) {
  const trimmed = userTurn?.trim();

  return (
    <div
      className={cn(
        NEW_LOOK_ENABLED ? NEXT_COLUMN : 'w-full max-w-[760px] mx-auto flex flex-col gap-5 px-4 py-6',
        className,
      )}
    >
      {before}
      {trimmed ? <ThreadUserTurn text={trimmed} videoFile={userVideoFile} /> : null}
      {children}
    </div>
  );
}

/**
 * F-14 — THE THREAD HAD ZERO HEADINGS (audit 2026-08-09, re-measured 0 on 2026-08-13 and again
 * on 2026-08-14 across a 4,364px mobile thread).
 *
 * A conversation is the one surface where heading navigation matters most: it is long, it is
 * append-only, and the thing you want is almost never at the top. With no `h1`–`h6` a screen
 * reader offers no jump list at all, so reaching the fourth answer means arrowing through the
 * three above it, cards and all.
 *
 * The tree this establishes: `h2` per TURN (both sides), `h3` per CARD inside a turn. Nothing
 * above `h2` is claimed here — the page owns `h1`, and a shell that renders inside someone
 * else's page must not mint a second one.
 *
 * The assistant's heading is the "Maven" label that was already on screen, promoted from a
 * `<span>` — same text, same classes, zero visual change. The user's is `sr-only`: the bubble
 * is the message, and a heading that repeats it would be read twice.
 */
export function ThreadUserTurn({
  text,
  video,
  videoFile,
  legacyLook = false,
}: {
  text: string;
  /** New look only: the turn's video (a reloaded turn's card), as a tile above the bubble. */
  video?: UserTurnVideo | null;
  /** New look only: the live turn's staged file, read in the browser for the same tile. */
  videoFile?: File | null;
  /** Keep the legacy bubble under the new look (the offer page's sample thread, spec §9). */
  legacyLook?: boolean;
}) {
  if (NEW_LOOK_ENABLED && !legacyLook) {
    return videoFile ? <NextUserTurnFromFile text={text} file={videoFile} /> : <NextUserTurn text={text} video={video} />;
  }
  return (
    <div className="flex justify-end">
      <h2 className="sr-only">You</h2>
      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white/[0.055] px-3.5 py-2 text-reading leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

export function ThreadAssistantTurn({
  children,
  legacyLook = false,
}: {
  children: React.ReactNode;
  /** Keep the legacy label under the new look (the offer page's sample thread, spec §9). */
  legacyLook?: boolean;
}) {
  if (NEW_LOOK_ENABLED && !legacyLook) return <NextAssistantTurn>{children}</NextAssistantTurn>;
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-caption font-medium uppercase tracking-[0.05em] text-foreground-muted">
        Maven
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
