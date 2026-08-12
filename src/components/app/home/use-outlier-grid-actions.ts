'use client';

/**
 * useOutlierGridActions — the Explore grid's tile actions, lifted out of ExploreThreadView.
 *
 * Moved verbatim (handlers + their transient per-tile state) so the composer can provide them once
 * at the thread root via OutlierGridActionsContext. That is what lets a persisted `outlier-grid`
 * render through the unified stream with LIVE tiles — previously impossible, because MessageBlocks
 * passes only `block` to a renderer, so the grid had to be filtered out of the stream and drawn by
 * its own per-skill view.
 *
 *  - remix(tile)  the VERBATIM discover→remix chain handoff (D-04/D-05):
 *                 `handoffsFor("discover").find(h => h.to === "remix")` → POST { url, platform }.
 *                 On success it surfaces the persisted remix-card by reloading the open thread IN
 *                 PLACE (RESEARCH Q2 — Explore renders in /home, so reload, NOT router.push).
 *  - track(tile)  POST /api/tracked-accounts (EXPLORE-05 / D-08), marks the tile tracked.
 *
 * Honesty spine (D-02): NO fabricated reaction on the grid — the real persona reaction is lazy,
 * earned on tap via the reused remix-card's LensTrigger downstream.
 */

import { useCallback, useMemo, useState } from 'react';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import type { OutlierGridActions } from '@/lib/hook-test-context';
import type { OutlierTileData } from '@/components/discover/outlier-tile';

export function useOutlierGridActions(
  platform: string,
  onThreadReload?: () => void,
): OutlierGridActions {
  const [remixPendingId, setRemixPendingId] = useState<string | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => new Set());

  const onRemix = useCallback(
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

  const onTrack = useCallback(
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

  return useMemo(
    () => ({
      onRemix,
      onTrack,
      remixPendingId,
      trackPendingId,
      trackedIds,
    }),
    [onRemix, onTrack, remixPendingId, trackPendingId, trackedIds],
  );
}
