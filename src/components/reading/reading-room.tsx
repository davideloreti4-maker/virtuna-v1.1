'use client';

import { READING_LABEL } from './reading-section';
import type { PredictionResult } from '@/lib/engine/types';
import type { PersonaNode } from '@/components/board/_kit/PersonaGraph';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { AmbientRoom } from '@/components/audience-lens/AmbientRoom';
import { ReplayController } from '@/components/audience-lens/ReplayController';
import { readingConceptText } from './reading-panels';

// ─────────────────────────────────────────────────────────────────────────────
// ReadingRoom — the v6 Room, embedded inline as the video Read's Audience section
// (The Room, Phase 3 · Option A). It replaces the old AudienceLens personas drill:
// the same named-voices Room the Make skills use, now speaking on a REAL video.
//
//   • AmbientRoom (embedded) — named voices + `ask →` + The people ⇄ Population·1,000
//     + the weak-spot. Fed the video's RICH persona nodes directly (real quotes/names/
//     archetypes), so nothing is binarised away vs the flat text path.
//   • The timeline Replay the text Room can't have — a real video carries a per-second
//     `HeatmapPayload.personas[].attentions[]` trace, so the ReplayController's TIMELINE
//     mode lights the constellation up "as the video plays" (D-06). Rendered ONLY when a
//     real timeline exists; a video with no per-segment trace falls back to the People
//     view's own reveal (no fabricated pseudo-timeline).
//
// Honesty spine: `fraction` + the voices are the REAL sim output; `conceptText` is the
// verbatim the room reacted to (grounds the persona chat). The Rewrite lever is gated OFF
// (canRewrite defaults false) — a fixed video has no text-lever to reseed.
// ─────────────────────────────────────────────────────────────────────────────

/** True when the heatmap carries at least one non-empty per-persona attention trace —
 *  the only real timeline (D-06). Drives whether the video-only Replay renders. */
function hasAttentionTimeline(data: PredictionResult): boolean {
  return (data.heatmap?.personas ?? []).some((p) => (p.attentions?.length ?? 0) > 0);
}

export function ReadingRoom({
  data,
  nodes,
  platform,
}: {
  data: PredictionResult;
  /** The video's rich persona nodes (reading.tsx `buildAudienceNodes(data)`). */
  nodes: PersonaNode[];
  /** Platform for the persona-chat grounding (defaults tiktok — the v1 surface). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
}) {
  const reducedMotion = usePrefersReducedMotion();

  // The honest "N of T would stop" aggregate — the SAME ≥50% watch-through threshold
  // AmbientRoom's verdictOf uses, so the (hidden) header + the People/Population split agree.
  const stopCount = nodes.filter((n) => n.watchThrough >= 0.5).length;
  const fraction = `${stopCount}/${nodes.length} stop`;
  // The verbatim the room reacted to grounds the persona chat; a video always has a concept
  // even when no hook verbatim persisted, so fall back to an honest generic (never fabricated).
  const conceptText = readingConceptText(data) ?? 'your video';

  return (
    <div data-testid="reading-room">
      <AmbientRoom
        embedded
        personaNodes={nodes}
        conceptText={conceptText}
        fraction={fraction}
        platform={platform}
        reducedMotion={reducedMotion}
      />

      {/* The video-only timeline Replay — voices light up as the video plays (D-06). */}
      {hasAttentionTimeline(data) && (
        <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-4">
          <p className={`mb-3 ${READING_LABEL}`}>
            Replay in timeline — the room reacts as the video plays
          </p>
          <ReplayController nodes={nodes} heatmap={data.heatmap ?? null} reducedMotion={reducedMotion} />
        </div>
      )}
    </div>
  );
}

ReadingRoom.displayName = 'ReadingRoom';
