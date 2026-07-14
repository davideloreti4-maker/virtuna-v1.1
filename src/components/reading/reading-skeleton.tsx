'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import {
  useReadingReveal,
  type ReadingRevealState,
  type RevealFrame,
  type RevealPersona,
  type RevealSource,
} from './use-reading-reveal';
import {
  ProgressChecklist,
  type StageState,
} from '@/components/thread/progress-checklist';
import { formatCount } from '@/lib/account-metrics/account-metrics';
import { READING_LABEL } from './reading-section';

/**
 * The Read's pipeline, as the user experiences it. Three steps, each anchored on a real signal the
 * stream already delivers, so the spine advances when the WORK advances rather than on a timer:
 *
 *   Fetching your video      → done when the scrape receipt lands (`source`)
 *   Watching it frame by frame → done when every keyframe has been seen (the extractor only runs
 *                                AFTER the video model is finished, so frames landing IS the
 *                                signal that the footage has been read)
 *   Simulating your audience → runs until `complete`
 *
 * ...with an elapsed-time FLOOR under each step (STEP_FALLBACK_MS), because none of those signals
 * is guaranteed to arrive. Signals win when they come; time carries the spine when they don't.
 *
 * Scoring is deliberately NOT a step: it is a tail of a few hundred ms, and a step that flashes
 * is worse than no step (the same reason "Self-judge" was dropped from the skill spines).
 */
const READ_PLAN = [
  'Fetching your video',
  'Watching it frame by frame',
  'Simulating your audience',
] as const;

/**
 * How long a step may stay active with NO signal before the spine advances it anyway.
 *
 * The signals are real but they are not guaranteed. Every one of them can go missing on a run
 * that is otherwise working perfectly:
 *   - an upload is never scraped, so it emits no `source` at all;
 *   - `triggerFilmstripGeneration` returns silently when FILMSTRIP_EXTRACT_SECRET is unset
 *     (filmstrip/queue.ts) — no seed, no frames, no `filmstrip_plan`, on EVERY run;
 *   - a video whose frames all fail to extract emits a plan and then nothing.
 *
 * Anchored purely on signals, those runs park the spine on one step for two minutes and then snap
 * all three to done in a single frame — worse than the shimmer it replaced. So elapsed time is the
 * floor: a real signal always advances the spine EARLIER, and never lets it stall. The order of
 * the pipeline is fixed and known, so advancing on time is an estimate, not an invention — no
 * number, picture or reaction is ever fabricated by it.
 */
const STEP_FALLBACK_MS = [12_000, 75_000];

function deriveStages(reveal: ReadingRevealState, elapsedMs: number): StageState[] {
  const done = reveal.phase === 'complete';
  const hasFootage = reveal.frameTotal > 0;

  // Completion is measured in segments SEEN, not frames shown: a segment the extractor failed on
  // never produces a picture, so counting pictures would leave this step pending forever.
  const footageReadBySignal =
    hasFootage && reveal.keyframeCount >= reveal.frameTotal;

  // The scrape receipt is the signal — but an upload is never scraped, so frames landing also
  // proves we have the video. Without this the upload path would sit on step 1 for the whole run.
  const gotVideo =
    done ||
    Boolean(reveal.source) ||
    hasFootage ||
    elapsedMs > STEP_FALLBACK_MS[0]!;

  const footageRead =
    done || footageReadBySignal || elapsedMs > STEP_FALLBACK_MS[1]!;

  return [
    { name: READ_PLAN[0], status: gotVideo ? 'done' : 'active' },
    {
      name: READ_PLAN[1],
      status: footageRead ? 'done' : gotVideo ? 'active' : 'pending',
    },
    {
      name: READ_PLAN[2],
      status: done ? 'done' : footageRead ? 'active' : 'pending',
      // Override the shared skill copy, which hardcodes "your 10 reactors" (the General-10
      // default). This user's audience may not be ten — say the number they actually have.
      detail:
        reveal.roster.length > 0
          ? `Reacting with each of your ${reveal.roster.length} reactors`
          : undefined,
    },
  ];
}

/**
 * RosterRow — the people who are about to watch, shown while their reactions are being simulated.
 *
 * This is the user's own calibrated audience, so it is known before the run even starts; the
 * in-flight Reading simply had no way to see it, which is why the ~60s the audience sim takes was
 * the emptiest stretch of the entire wait. Their REACTIONS are what the Read is for and are never
 * guessed here — only the cast is shown, arriving one after another.
 */
function RosterRow({ roster, active }: { roster: RevealPersona[]; active: boolean }) {
  const reduced = usePrefersReducedMotion();
  if (roster.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="reading-skeleton-roster">
      <p className={READING_LABEL}>{active ? 'Your audience is watching' : 'Your audience'}</p>
      <div className="flex flex-wrap gap-1.5">
        {roster.map((p, i) => (
          <span
            key={`${p.archetype}-${i}`}
            data-testid="reading-skeleton-reactor"
            className={
              'rounded-md border border-white/[0.06] px-2 py-1 text-[12.5px] text-foreground-muted' +
              (reduced ? '' : ' reading-reveal')
            }
            // Staggered arrival — they turn up one after another rather than all at once.
            style={reduced ? undefined : { animationDelay: `${i * 0.08}s` }}
          >
            {p.label ?? p.archetype}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface ReadingSkeletonProps {
  id: string | null;
  /**
   * Dev-gallery / test seam: pin the reveal state instead of subscribing to the live stream.
   * When set, the EventSource subscription is disabled entirely.
   */
  preview?: Partial<ReadingRevealState>;
}

/**
 * SourceCard — the post we are reading, shown as soon as the scrape resolves it.
 *
 * This is the FIRST evidence a Read can offer. The scrape lands within seconds and already
 * holds the cover, the author and the view count; the pipeline used to keep the mp4 URL and drop
 * all three, so the opening ~30s of a two-minute wait (before any keyframe is cut) had nothing
 * in it at all. Now the wait opens by showing the user the video it went and fetched.
 *
 * Honest by construction: rendered only when the scrape actually returned something. In
 * video_upload mode nothing is scraped, so there is no receipt and none is shown — we never
 * dress up an absence as a source.
 */
function SourceCard({ source }: { source: RevealSource }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = source.cover_url && !coverFailed;

  return (
    <div
      data-testid="reading-skeleton-source"
      className="reading-reveal flex items-center gap-3 rounded-lg border border-white/[0.06] p-3"
    >
      {showCover && (
        <div className="h-[64px] w-[36px] shrink-0 overflow-hidden rounded-md border border-white/[0.06]">
          {/* Ephemeral TikTok-CDN cover — plain <img>, decorative alt. Removes itself on error. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source.cover_url!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={READING_LABEL}>Reading</p>
        <p className="mt-1 truncate text-[15px] font-medium text-foreground">
          {source.handle ? `@${source.handle}` : 'Your video'}
        </p>
        {typeof source.views === 'number' && (
          <p className="mt-0.5 text-[13px] text-foreground-muted">
            {formatCount(source.views)} views
          </p>
        )}
      </div>
    </div>
  );
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

  // Elapsed-since-mount, the floor under the spine (see STEP_FALLBACK_MS). Ticks every 2s — it
  // only ever gates two thresholds, so a fast timer would just re-render for nothing. A preview
  // is a fixed state, not a run: it must not advance on its own, or the gallery would drift off
  // the state it is meant to be showing.
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (preview) return;
    const startedAt = Date.now();
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt), 2_000);
    return () => clearInterval(t);
  }, [preview]);

  const stages = deriveStages(reveal, elapsedMs);
  const simulating = stages[2]?.status === 'active';

  // The one-sentence version of the spine, for screen readers — so it can never say a different
  // thing from the steps on screen (it did: it stayed on "Reading the footage" while the spine
  // had moved on to the audience).
  const caption = (() => {
    const active = stages.find((s) => s.status === 'active');
    if (!active) return 'Reading your simulation…';
    if (active.name === READ_PLAN[1] && reveal.frameTotal > 0) {
      return `${active.name} — ${reveal.frames.length} of ${reveal.frameTotal} frames`;
    }
    if (active.name === READ_PLAN[2] && reveal.roster.length > 0) {
      return `${active.name} — ${reveal.roster.length} reactors`;
    }
    return active.name;
  })();

  return (
    <div
      data-testid="reading-skeleton"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      {/* The evidence, in the order the engine actually produces it: first the post we fetched
          (seconds in), then the frames we cut from it (as they are read). Both absent → nothing
          renders and the wait degrades to the calm placeholder IA, exactly as before. */}
      {reveal.source && <SourceCard source={reveal.source} />}
      <FrameStrip frames={reveal.frames} total={reveal.frameTotal} />

      {/* The spine (#207's premium loading system — the flagship never got it until now) + the
          audience arriving underneath it. Every step advances on a real signal. */}
      <div className="flex flex-col gap-6">
        <ProgressChecklist stages={stages} plan={[...READ_PLAN]} />
        <RosterRow roster={reveal.roster} active={simulating} />
      </div>

      {/* Screen-reader / fallback line: the one-sentence version of the spine above. */}
      <p
        data-testid="reading-skeleton-caption"
        className="sr-only"
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
