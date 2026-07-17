'use client';

/**
 * ThreadLoadingSkeleton — branded in-flight state for home skill thread views (P0).
 *
 * Constellation motif + shape-hint skeleton blocks. Replaces bare "Thinking…" text.
 */

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Constellation, buildLoadingDots } from '@/components/brand/constellation';

export interface ThreadLoadingSkeletonProps {
  /** 'chat' = prose-line hints; 'skill' = card-outline hint. */
  variant?: 'chat' | 'skill';
  /** Optional muted caption (status message / stage name). */
  caption?: string;
}

const VB_W = 120;
const VB_H = 32;

export function ThreadLoadingSkeleton({
  variant = 'skill',
  caption,
}: ThreadLoadingSkeletonProps) {
  const reducedMotion = usePrefersReducedMotion();
  const dots = useMemo(() => buildLoadingDots(VB_W, VB_H, 8), []);

  return (
    <div
      className="flex flex-col items-center gap-4 py-2"
      aria-busy="true"
      aria-live="polite"
      data-testid="thread-loading-skeleton"
    >
      <Constellation
        dots={dots}
        reducedMotion={reducedMotion}
        width={VB_W}
        height={VB_H}
        vbW={VB_W}
        vbH={VB_H}
        ariaLabel="Simulating your audience"
      />

      {variant === 'chat' ? (
        <div className="flex w-full max-w-md flex-col gap-2 px-2">
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-[85%] rounded-md" />
          <Skeleton className="h-3 w-[65%] rounded-md" />
        </div>
      ) : (
        <Skeleton className="h-24 w-full max-w-md rounded-xl" />
      )}

      {caption ? (
        <p className="text-center text-sm text-foreground-muted">{caption}</p>
      ) : (
        <p className="text-center text-sm text-foreground-muted">
          {variant === 'chat' ? 'Thinking with your audience…' : 'Running your skill…'}
        </p>
      )}
    </div>
  );
}

/**
 * ChatTypingIndicator — premium inline "assistant is thinking" state for a chat turn.
 *
 * Three softly-pulsing dots, left-aligned under the assistant label (Claude/Perplexity-native),
 * instead of the heavy centered constellation skeleton. Reduced-motion → a single steady dot row.
 * `label` lets a skill dispatch say what it's doing (e.g. "Writing hooks…") while it runs.
 */
export function ChatTypingIndicator({ label }: { label?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite">
      <span className="sr-only">{label ?? 'Thinking…'}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={
              'h-1.5 w-1.5 rounded-full bg-foreground-muted' +
              (reducedMotion ? ' opacity-60' : ' animate-pulse')
            }
            style={reducedMotion ? undefined : { animationDelay: `${i * 180}ms`, animationDuration: '1s' }}
          />
        ))}
      </span>
      {label ? <span className="text-sm text-foreground-muted">{label}</span> : null}
    </div>
  );
}
