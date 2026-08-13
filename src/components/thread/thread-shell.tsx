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

export interface ThreadShellProps {
  /** Optimistic echo of the user's submitted prompt (presentation-only). */
  userTurn?: string | null;
  /** Pre-turn content (idle states, empty copy, quick-action cards). */
  before?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function ThreadShell({ userTurn, before, children, className }: ThreadShellProps) {
  const trimmed = userTurn?.trim();

  return (
    <div
      className={cn(
        'w-full max-w-[760px] mx-auto flex flex-col gap-5 px-4 py-6',
        className,
      )}
    >
      {before}
      {trimmed ? <ThreadUserTurn text={trimmed} /> : null}
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
export function ThreadUserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <h2 className="sr-only">You</h2>
      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white/[0.055] px-3.5 py-2 text-reading leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

export function ThreadAssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-caption font-medium uppercase tracking-[0.05em] text-foreground-muted">
        Maven
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
