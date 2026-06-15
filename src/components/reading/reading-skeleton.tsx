'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useReadingReveal } from './use-reading-reveal';

/**
 * ReadingSkeleton (REVEAL-01) — the branded in-flight state that replaces the bare
 * "Reading your simulation…" spinner. It lays out the SAME vertical IA the settled
 * Reading uses (thumbnail → hero gauge+cloud → 3 driver rows → Fix First), in the
 * SAME 760px column with the SAME gap rhythm, so the swap to the real Reading on
 * completion does not thrash the layout (REVEAL-02 / SC-2).
 *
 * LIVENESS (real-signal reveal, the chosen Phase-4 fidelity): useReadingReveal
 * subscribes to the reconnect stream and surfaces the two honest deltas that
 * survive navigation — personas streaming in (audience forming) and keyframes
 * extracting (the strip filling). The caption reflects real progress, never a
 * fabricated stage label. When the engine emits no mid-flight deltas the caption
 * stays the calm default until the Reading swaps in.
 *
 * CALM MOTION: the placeholder blocks breathe via the shared Skeleton shimmer,
 * which is `motion-reduce:animate-none` — reduced-motion users get static blocks.
 */
export function ReadingSkeleton({ id }: { id: string | null }) {
  const reduced = usePrefersReducedMotion();
  const reveal = useReadingReveal(id, true);

  const caption = (() => {
    if (reveal.personaCount > 0) {
      return `Simulating your audience — ${reveal.personaCount} ${
        reveal.personaCount === 1 ? 'viewer' : 'viewers'
      } so far…`;
    }
    if (reveal.keyframeCount > 0) {
      return 'Reading the footage frame by frame…';
    }
    return 'Reading your simulation…';
  })();

  return (
    <div
      data-testid="reading-skeleton"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      {/* liveness caption — real progress, no fake stage labels */}
      <p
        data-testid="reading-skeleton-caption"
        className="text-center text-sm text-foreground-muted"
      >
        {caption}
      </p>

      {/* hero: gauge disc + cloud, mirrors reading-hero's stack→row */}
      <section className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
        <Skeleton className="h-[140px] w-[140px] shrink-0 rounded-full" />
        <div className="flex w-full flex-1 flex-col items-center gap-3">
          <Skeleton className="h-24 w-full max-w-[280px] rounded-2xl" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
      </section>

      {/* 3 driver-row placeholders — audience dots animate in as personas land */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-[5px] flex-1 rounded-full" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        ))}
      </div>

      {/* Fix First placeholder */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      {/* keyframe progress — only shown once footage starts landing (real signal) */}
      {reveal.keyframeCount > 0 && (
        <p
          data-testid="reading-skeleton-frames"
          className={
            'text-center text-xs text-foreground-muted' +
            (reduced ? '' : ' animate-skeleton-breathe')
          }
        >
          {reveal.keyframeCount} {reveal.keyframeCount === 1 ? 'frame' : 'frames'} read
        </p>
      )}
    </div>
  );
}

ReadingSkeleton.displayName = 'ReadingSkeleton';
