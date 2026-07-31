'use client';

/**
 * useTestRunEvidence — the in-thread Test's live evidence: the post we fetched, then the real
 * keyframes cut from it.
 *
 * The Test is the longest wait in the product (~2 minutes of the full /api/analyze Max pipeline)
 * and, until now, the emptiest: in-thread it rendered three step names and nothing else, while the
 * FLAGSHIP page running the identical pipeline showed the creator their own footage landing frame
 * by frame (reading-skeleton.tsx). Same engine, same signals, two very different waits.
 *
 * This closes that gap by reusing the SAME source the flagship uses — the reconnect stream's
 * `source` / `filmstrip_plan` / `filmstrip_segment_ready` frames (useReadingReveal) — and shaping
 * them into the thread's one evidence idiom (RunEvidence → RunEvidenceRail).
 *
 * The progression mirrors the spine step for step, because both are driven by the same signals:
 *   "Fetching your video"        → the scrape receipt: cover + @handle + views
 *   "Watching it frame by frame" → the filmstrip, slots drawn up front, filling in order
 *   "Simulating your audience"   → the strip stays (the footage HAS been read; it is the receipt)
 *
 * HONEST BY OMISSION: a video_upload run is never scraped, so there is no source and none is shown;
 * a run whose extractor is unconfigured emits no plan and no frames, so the rail stays empty and
 * the spine carries the wait exactly as it did before. Nothing here invents a picture.
 */

import { useReadingReveal } from '@/components/reading/use-reading-reveal';
import { formatCount } from '@/lib/account-metrics/account-metrics';
import {
  MAX_EVIDENCE_ITEMS,
  evidenceMetric,
  isSafeEvidenceUrl,
  normalizeHandle,
  type EvidenceItem,
  type RunEvidence,
} from '@/lib/tools/evidence';

/**
 * @param analysisId the row this run is writing to (surfaced by useAnalysisStream's `started`
 *   frame, seconds in) — null until it lands, and the hook stays idle until then.
 * @param active subscribe only while the run is genuinely in flight. Passing false closes the
 *   EventSource, so a settled thread holds no open connection.
 */
export function useTestRunEvidence(
  analysisId: string | null,
  active: boolean,
): RunEvidence | null {
  const reveal = useReadingReveal(analysisId, active);

  // Frames win once any have landed: the creator's own footage is the strongest proof-of-work the
  // wait can show, and by then the spine has moved off "Fetching your video" anyway.
  if (reveal.frames.length > 0) {
    const items: EvidenceItem[] = [...reveal.frames]
      .filter((f) => isSafeEvidenceUrl(f.uri))
      .sort((a, b) => a.idx - b.idx)
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map((f) => ({ kind: 'frame' as const, image: f.uri, idx: f.idx }));
    if (items.length === 0) return null;
    return {
      headline: 'Reading your footage',
      items,
      // The extractor's own plan, so every slot the run will fill is drawn before it fills —
      // the strip reads as progress instead of growing. Falls back to what we hold if no plan came.
      slots: Math.max(reveal.frameTotal, items.length),
    };
  }

  // Before any frame: the post the scrape resolved. This lands within seconds, and it is the whole
  // reason the opening stretch of the wait no longer has to be blank.
  const source = reveal.source;
  if (source && (source.cover_url || source.handle)) {
    const label = normalizeHandle(source.handle);
    const image = isSafeEvidenceUrl(source.cover_url) ? source.cover_url : null;
    const href = isSafeEvidenceUrl(source.video_url) ? source.video_url : null;
    // Views only — nothing measured this post against a baseline, so no multiplier exists and
    // none is implied (the same restraint the remix source receipt shows).
    const metric = evidenceMetric({ views: source.views, formatCount });
    if (!image && !label) return null;
    return {
      headline: 'Testing this video',
      items: [
        {
          kind: 'video',
          ...(image ? { image } : {}),
          ...(label ? { label } : {}),
          ...(metric ? { metric } : {}),
          ...(href ? { href } : {}),
        },
      ],
    };
  }

  return null;
}
