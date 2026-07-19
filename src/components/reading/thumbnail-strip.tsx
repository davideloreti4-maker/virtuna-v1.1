'use client';
import { useState } from 'react';
import type { HeatmapPayload } from '@/lib/engine/types';
import { resolveKeyframeUrl, type KeyframeSegmentLike } from '@/components/board/_kit';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';

/**
 * ThumbnailStrip — the static video poster at the top of the thread (READ-03,
 * D-03). One real keyframe rendered as a plain signed `<img>` (NOT `next/image`
 * — the URLs are signed + dynamic), gated on a real video: text / tiktok-url
 * modes carry no keyframe, so the strip renders NOTHING (no broken placeholder),
 * mirroring `resolveKeyframeUrl`'s real-video gate.
 *
 * On a load failure the poster removes itself (no broken-image box). The signed
 * URL is never logged (info-disclosure mitigation, T-02-03). Inline-playable is
 * deferred; this is a static poster only.
 */
export interface ThumbnailStripProps {
  heatmap: HeatmapPayload | null;
}

/** Bridge heatmap segments to the `KeyframeSegmentLike` shape resolveKeyframeUrl wants. */
function asKeyframeSegments(
  segments: HeatmapPayload['segments'] | undefined,
): KeyframeSegmentLike[] {
  return (segments ?? []).map((s, i) => ({
    idx: s.idx ?? i,
    t_start: s.t_start,
    t_end: s.t_end,
    keyframe_uri: s.keyframe_uri,
  }));
}

export function ThumbnailStrip({ heatmap }: ThumbnailStripProps) {
  const [failed, setFailed] = useState(false);

  // The persisted keyframe map for this permalink (same source RetentionPanel
  // uses). WITHOUT this the strip only saw heatmap.segments[].keyframe_uri, which
  // is always null on reload → the hero poster never rendered. {} when no id /
  // no frames, in which case the gate below omits the strip cleanly.
  const filmstrips = usePermalinkFilmstrips();

  // Earliest available real frame ('first' target). null in text / tiktok-url
  // modes with no keyframe → the gate below omits the strip.
  const src = resolveKeyframeUrl(filmstrips, asKeyframeSegments(heatmap?.segments), 'first');

  // Real-video gate + failed-load gate: no src (or a failed image) → render nothing.
  if (!src || failed) return null;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[--color-border]">
      {/* signed, dynamic keyframe URL — plain <img>, decorative alt (T-02-03). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="block h-auto w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
