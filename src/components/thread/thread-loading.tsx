'use client';

/**
 * The two loading states that are NOT a skill run.
 *
 *   ThreadLoadingSkeleton — opening/switching a thread, before its history has landed.
 *   ChatTypingIndicator   — a plain conversational answer being written, no skill, no spine.
 *
 * Both were the last places in the thread still speaking a different visual language from the run
 * spine (progress-checklist.tsx), and it showed:
 *
 *  - The rehydrate skeleton was a CENTERED constellation over centered placeholder lines, dropped
 *    into a column whose real content is left-aligned prose under a "Maven" label with a
 *    right-aligned user bubble. Nothing it drew was where the thing it stood in for would be, so
 *    the settle read as a layout jump rather than as content arriving. It now mirrors the real turn
 *    geometry (ThreadShell / ThreadUserTurn / ThreadAssistantTurn) — a user bubble on the right, a
 *    labelled assistant block on the left — so history lands INTO its own outline.
 *  - The typing indicator was three `animate-pulse` dots, Tailwind's default, used nowhere else in
 *    the app. It now speaks the spine's idiom: one breathing accent dot + a shimmering label, the
 *    same two cues the active stage row uses, so every wait in the thread reads as one system.
 *
 * MOTION is class-based on purpose. `.text-shimmer`, `.animate-stage-breathe` and
 * `.skeleton-shimmer` each carry their own `prefers-reduced-motion` guard in globals.css, and a
 * CSS guard cannot be beaten by an inline style the way a JS branch can be forgotten.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ThreadLoadingSkeletonProps {
  /** 'chat' = a full turn outline (user bubble + assistant block); 'skill' = a card-shaped hint. */
  variant?: 'chat' | 'skill';
  /** Optional muted caption (status message / stage name). */
  caption?: string;
}

export function ThreadLoadingSkeleton({
  variant = 'skill',
  caption,
}: ThreadLoadingSkeletonProps) {
  return (
    <div
      className="flex w-full flex-col gap-5 py-2"
      aria-busy="true"
      aria-live="polite"
      data-testid="thread-loading-skeleton"
    >
      {variant === 'chat' ? (
        <>
          {/* The user's turn: right-aligned, pill-shaped, the same 2xl radius ThreadUserTurn uses. */}
          <div className="flex justify-end">
            <Skeleton className="h-9 w-[52%] max-w-[80%] rounded-2xl" />
          </div>

          {/* The assistant's: the real "Maven" eyebrow (it is a constant, so there is nothing to
              guess) over prose lines in descending widths — the shape a written answer has. */}
          <div className="flex flex-col gap-2">
            <span className="text-caption font-medium uppercase tracking-[0.05em] text-foreground-muted/70">
              Maven
            </span>
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-[88%] rounded-md" />
            <Skeleton className="h-3.5 w-[62%] rounded-md" />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium uppercase tracking-[0.05em] text-foreground-muted/70">
            Maven
          </span>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {caption && (
        <p className="text-label text-foreground-muted" data-testid="thread-loading-caption">
          {caption}
        </p>
      )}
    </div>
  );
}

/**
 * ChatTypingIndicator — the honest wait for a plain conversational answer (no skill, so no spine).
 *
 * One breathing accent dot + a shimmering label: exactly the two cues the spine's ACTIVE stage row
 * uses, which is the point — a creator should not have to learn a second vocabulary for "the engine
 * is working" depending on whether their question happened to route to a skill.
 *
 * `label` lets a caller say what it is doing ("Writing hooks…"); absent, it says "Thinking…", which
 * is the truth and is also what the screen reader announced before it was ever drawn.
 */
export function ChatTypingIndicator({ label }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 py-0.5"
      role="status"
      aria-live="polite"
      data-testid="chat-typing-indicator"
    >
      <span
        className="animate-stage-breathe h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: 'var(--color-accent)' }}
        aria-hidden="true"
      />
      {/* `.text-shimmer` paints the text via background-clip and falls back to a solid
          cream-secondary fill under reduced motion, so the label is always legible. */}
      <span className={cn('text-body font-medium', 'text-shimmer')}>{label ?? 'Thinking…'}</span>
    </div>
  );
}
