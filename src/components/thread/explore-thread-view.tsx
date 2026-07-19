'use client';

/**
 * ExploreThreadView — the Explore surface for the user's open thread
 * (Phase 11, Plan 06, Task 1 — EXPLORE-01/02/04/05).
 *
 * Clones the HooksThreadView column (the `max-w-[760px] mx-auto gap-6 px-4 py-6`
 * thread column, ProgressChecklist while streaming, the grid via the streaming +
 * persisted block bodies, the SkillRunError block + onRetry).
 *
 * ⚠️ This view NO LONGER owns an idle state. It used to render its own heading + three
 * quick-action cards in a bespoke card (icon ABOVE the text, no fill, p-5, 16/14px) — an
 * anatomy nothing else in the app used, and the worst offender in the four-empty-states
 * drift. Do NOT re-add an idle branch here.
 *
 * Where Explore's entry points went (2026-07-14): the starter grid is the SAME SIX cards
 * under every skill now, so the three presets did not survive as cards. They were not lost
 * — the richer entry is the params popover (`onRunExplore` / the magnifier beside the skill
 * chip), which already expresses niche · accounts · time-window · serendipity, i.e. every
 * preset and then some. A bare send with an empty field runs the un-niched pull.
 *
 * Two sources of content:
 *  1. STREAMING: ProgressChecklist + the loading lead line + the in-flight grid block.
 *  2. PERSISTED: the grid block(s) rehydrated from the open thread on reload.
 *
 * The grid is rendered via OutlierGridBlockRenderer DIRECTLY (not through
 * MessageBlocks) because MessageBlocks does not forward the onRemix / onTrack
 * handlers — and this view OWNS those handlers. The renderer maps the validated
 * OutlierGridBlock props onto the same DiscoverGrid / OutlierTile (fixed renderer,
 * THREAD-04 — no model-generated UI).
 *
 * Handlers this view owns:
 *  - handleRemix(tile): the VERBATIM discover→remix chain handoff (D-04/D-05) —
 *    `handoffsFor("discover").find(h => h.to === "remix")` → POST { url, platform }.
 *    On success it surfaces the persisted remix-card by reloading the open thread
 *    IN PLACE via onThreadReload (RESEARCH Q2 — Explore renders in /home, so reload,
 *    NOT router.push). The on-tap REAL persona reaction comes free from the reused
 *    remix-card's LensTrigger downstream — this view adds NO reaction UI to the grid (D-02).
 *  - handleTrack(tile): POST /api/tracked-accounts (EXPLORE-05 / D-08), marks the
 *    tile tracked.
 *
 * Honesty spine (D-02): NO fabricated reaction / persona quote on the grid (the real
 * reaction is lazy, earned on tap). The competitor-feed degrade ("Track an account
 * first") moved with the cards into the starter, and is still honest there.
 *
 * Column width + THEME-06 flat-warm, coral only on the tile CTA (per CLAUDE.md
 * Raycast rules + UI-SPEC §Color).
 */

import { useCallback, useState } from 'react';
import { OutlierGridBlockRenderer } from '@/components/thread/outlier-grid-block';
import { ThreadShell, ThreadAssistantTurn } from '@/components/thread/thread-shell';
import { SkillResultCard } from '@/components/thread/skill-result-card';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import { SkillRunError } from '@/components/thread/run-notices';
import type { StageState } from '@/components/thread/progress-checklist';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import type { OutlierGridBlock } from '@/lib/tools/blocks';
import type { OutlierTileData } from '@/components/discover/outlier-tile';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ExploreThreadViewProps {
  /** Validated outlier-grid blocks from the persisted open thread (rehydration). */
  persistedBlocks: OutlierGridBlock[];
  /** In-flight grid block(s) from useExploreStream().toBlocks() (pass [] when idle). */
  streamingBlocks: OutlierGridBlock[];
  /** Pipeline stage states from SSE stage events (ProgressChecklist while streaming). */
  stages: StageState[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = pull failed → render SkillRunError). */
  error: string | null;
  /** Current platform selection (the remix handoff + track write carry this). */
  platform: string;
  /**
   * Retry callback — re-invokes the last pull (SkillRunError tap-to-retry).
   * Called ONLY on explicit tap. Never fires on render.
   */
  onRetry?: () => void;
  /**
   * Reload the open thread in place to surface the persisted remix-card after a tap
   * (RESEARCH Q2 — Explore renders in /home, so the composer re-fetches the thread
   * rather than navigating). Called by handleRemix on a successful remix launch.
   */
  onThreadReload?: () => void;
  userTurn?: string | null;
  skillLabel?: string;
  audienceLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExploreThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  isStreaming,
  error,
  platform,
  onRetry,
  onThreadReload,
  userTurn,
  skillLabel = 'Explore',
  audienceLabel = 'General',
}: ExploreThreadViewProps) {
  // Per-tile transient state (mirrors DiscoverClient — local to this view).
  const [remixPendingId, setRemixPendingId] = useState<string | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => new Set());

  const hasStreamingContent = streamingBlocks.length > 0;
  const hasPersistedContent = persistedBlocks.length > 0;

  // Framing hero (§0.5.2) — how many measured outliers this pull surfaced, so the grid reads
  // finding-first instead of as an unlabelled wall of tiles under a bland caption. Counts every
  // tile across streaming + persisted blocks; the frame only renders when there IS content.
  const outlierCount = [...streamingBlocks, ...persistedBlocks].reduce(
    (n, b) => n + b.props.tiles.length,
    0,
  );
  const resultHero =
    outlierCount > 0
      ? `${outlierCount} ${outlierCount === 1 ? 'outlier' : 'outliers'}, scored for your audience`
      : undefined;

  // ── handleRemix (D-04/D-05, RESEARCH Q2) ──────────────────────────────────────
  // VERBATIM discover→remix chain launch (the DiscoverClient pattern), EXCEPT it
  // reloads the open thread in place (onThreadReload) instead of router.push("/home")
  // — Explore already renders in /home, so the persisted remix-card surfaces via a
  // thread re-fetch (the on-tap real reaction rides the reused remix-card's LensTrigger).
  const handleRemix = useCallback(
    async (tile: OutlierTileData) => {
      const handoff = handoffsFor('discover').find((h) => h.to === 'remix');
      if (!handoff?.endpoint) return;

      setRemixPendingId(tile.platformVideoId);
      try {
        // The tile's videoUrl IS the rehost anchor (anchorFrom: "card").
        const res = await fetch(handoff.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: tile.videoUrl, platform }),
        });
        // Surface the persisted remix-card by reloading the open thread in place
        // (RESEARCH Q2 — NOT router.push; Explore is an in-thread skill in /home).
        if (res.ok) onThreadReload?.();
      } catch {
        // Network error — leave the grid for retry (the finally re-enables the tile).
      } finally {
        // WR-01: ALWAYS clear the pending id — incl. the success path — so the tile's
        // "Remix → Read" button re-enables instead of sticking on "Remixing…" forever.
        setRemixPendingId(null);
      }
    },
    [platform, onThreadReload],
  );

  // ── handleTrack (EXPLORE-05 / D-08) ───────────────────────────────────────────
  // Writes the watchlist row for the tile's account; marks the tile tracked.
  // Renders the real persona reaction NOWHERE here — Track is an additive write only.
  const handleTrack = useCallback(
    async (tile: OutlierTileData) => {
      if (!tile.trackable || !tile.trackHandle) return;

      const handle = tile.trackHandle;
      setTrackPendingId(tile.platformVideoId);
      try {
        const res = await fetch('/api/tracked-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            handle,
            source_video_id: tile.platformVideoId,
          }),
        });
        if (res.ok) {
          setTrackedIds((prev) => {
            const next = new Set(prev);
            next.add(handle);
            return next;
          });
        }
      } catch {
        // Network error — leave the tile untracked so the creator can retry.
      } finally {
        setTrackPendingId(null);
      }
    },
    [platform],
  );

  return (
    // Idle is NOT this view's business any more. Explore owned the worst of the drift —
    // its own QuickActionCard (icon ABOVE the text, no fill, p-5, 16/14px) sitting under a
    // left-aligned prose lede, a card that looked nothing like the home grid it was meant
    // to echo. The three starting points now live in the ONE starter (home-starter.tsx —
    // THE STARTER CONTRACT) with their copy intact and their tap-only guarantee intact.
    <ThreadShell userTurn={userTurn}>
      {/* Premium spine (parity with the generative skills): full pipeline seeded up front while
          streaming, collapsing to a receipt line on completion. */}
      <SkillProgress
        stages={stages}
        plan={STAGE_PLANS.explore}
        isStreaming={isStreaming}
        summaryLabel="Scored for your audience"
      />

      {error && !isStreaming && <SkillRunError onRetry={onRetry} retryLabel="Retry the Explore pull" headline="Couldn’t reach that source." body="Check the handle or niche and try again — nothing was charged." />}

      {(hasStreamingContent || hasPersistedContent) && (
        <ThreadAssistantTurn>
          <SkillResultCard skillLabel={skillLabel} audienceLabel={audienceLabel} hero={resultHero}>
            {hasStreamingContent && (
              <div className="flex flex-col gap-4">
                {streamingBlocks.map((block, index) => (
                  <OutlierGridBlockRenderer
                    key={`stream-${index}`}
                    block={block}
                    onRemix={handleRemix}
                    onTrack={handleTrack}
                    remixPendingId={remixPendingId}
                    trackPendingId={trackPendingId}
                    trackedIds={trackedIds}
                  />
                ))}
              </div>
            )}

            {hasPersistedContent && (
              <div className="flex flex-col gap-4">
                {hasStreamingContent && (
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="text-xs text-foreground-muted/50 uppercase tracking-wide mb-4">
                      Earlier
                    </p>
                  </div>
                )}
                {persistedBlocks.map((block, index) => (
                  <OutlierGridBlockRenderer
                    key={`persisted-${index}`}
                    block={block}
                    onRemix={handleRemix}
                    onTrack={handleTrack}
                    remixPendingId={remixPendingId}
                    trackPendingId={trackPendingId}
                    trackedIds={trackedIds}
                  />
                ))}
              </div>
            )}
          </SkillResultCard>
        </ThreadAssistantTurn>
      )}
    </ThreadShell>
  );
}

