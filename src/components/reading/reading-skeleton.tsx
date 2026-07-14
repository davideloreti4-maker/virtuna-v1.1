'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import {
  useReadingReveal,
  type ReadingRevealState,
  type RevealFrame,
} from './use-reading-reveal';

export interface ReadingSkeletonProps {
  id: string | null;
  /**
   * Dev-gallery / test seam: pin the reveal state instead of subscribing to the live stream.
   * When set, the EventSource subscription is disabled entirely.
   */
  preview?: Partial<ReadingRevealState>;
}

/**
 * FrameStrip — the real keyframes of the user's own video, appearing as the engine reads them.
 *
 * This is the ONE thing on the in-flight screen that is not a placeholder: these are frames cut
 * from the video the user just handed us. A shimmer block says "something is happening"; a frame
 * from their own video PROVES it. That is why it leads.
 *
 * The strip draws every slot the run will fill (`total`, known before the first frame lands) and
 * fills them in order, so it reads as progress and never reflows as frames arrive. A frame that
 * fails to load removes its own image (no broken-image box) but keeps its slot — the segment was
 * still read, we just have nothing to show for it.
 */
function FrameStrip({ frames, total }: { frames: RevealFrame[]; total: number }) {
  const reduced = usePrefersReducedMotion();
  const slots = Math.max(total, frames.length);
  if (slots === 0) return null;

  return (
    <div className="flex gap-1.5" data-testid="reading-skeleton-frames-strip">
      {Array.from({ length: slots }, (_, i) => {
        const frame = frames.find((f) => f.idx === i);
        return frame ? (
          <FrameSlot key={i} frame={frame} reduced={reduced} />
        ) : (
          <div
            key={i}
            className="aspect-[9/16] min-w-0 flex-1 rounded-md border border-white/[0.06] bg-white/[0.02]"
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function FrameSlot({ frame, reduced }: { frame: RevealFrame; reduced: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={
        'aspect-[9/16] min-w-0 flex-1 overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.02]' +
        (reduced ? '' : ' reading-reveal')
      }
      data-testid="reading-skeleton-frame"
    >
      {/* Signed, dynamic keyframe URL — plain <img>, decorative alt (T-02-03: never logged). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!failed && (
        <img
          src={frame.uri}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/**
 * ReadingSkeleton (REVEAL-01) — the branded in-flight state that replaces the bare
 * "Reading your simulation…" spinner. It lays out the SAME vertical IA the settled
 * Reading uses (thumbnail → hero gauge+cloud → 3 driver rows → Fix First), in the
 * SAME 760px column with the SAME gap rhythm, so the swap to the real Reading on
 * completion does not thrash the layout (REVEAL-02 / SC-2).
 *
 * LIVENESS (real-signal reveal, the chosen Phase-4 fidelity): useReadingReveal
 * subscribes to the reconnect stream and surfaces the honest deltas that survive
 * navigation — the keyframes being cut from the video (shown, as pictures) and the
 * personas forming. It reflects real progress, never a fabricated stage label. When
 * the engine emits no mid-flight deltas it degrades to the calm default caption
 * until the Reading swaps in.
 *
 * CALM MOTION: the placeholder blocks breathe via the shared Skeleton shimmer,
 * which is `motion-reduce:animate-none` — reduced-motion users get static blocks.
 */
export function ReadingSkeleton({ id, preview }: ReadingSkeletonProps) {
  // Additive preview seam (dev gallery / tests) — mirrors <Reading overrideData>. The in-flight
  // states are the ones nobody can normally LOOK at: they exist only during a live 2-minute run,
  // so they drifted unseen. With `preview` the gallery renders the REAL component with a fixed
  // reveal state, and the live path is untouched (no preview → the hook runs exactly as before).
  const live = useReadingReveal(id, !preview);
  const reveal = preview ? { ...live, ...preview } : live;

  const caption = (() => {
    if (reveal.personaCount > 0) {
      return `Simulating your audience — ${reveal.personaCount} ${
        reveal.personaCount === 1 ? 'viewer' : 'viewers'
      } so far…`;
    }
    if (reveal.frameTotal > 0) {
      // Count the frames we can actually SHOW, so the number always matches the strip.
      return `Reading the footage — ${reveal.frames.length} of ${reveal.frameTotal} frames`;
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
      {/* The frames of THEIR video, as we read them — the proof, so it goes above the fold and
          above the placeholders. Absent (no video / pre-extraction) → nothing renders. */}
      <FrameStrip frames={reveal.frames} total={reveal.frameTotal} />

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
    </div>
  );
}

ReadingSkeleton.displayName = 'ReadingSkeleton';
