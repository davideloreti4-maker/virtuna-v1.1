'use client';

/**
 * ReplayController — drives the Panel·10 constellation segment-by-segment (P9 W1).
 *
 * Two motion modes, chosen by the SIGNAL SHAPE — never synthesized (D-06):
 *
 *   • TIMELINE (this wave, live): the video Test/Read surface carries a real
 *     `HeatmapPayload.personas[].attentions[]` per-segment timeline. "Replay reactions"
 *     advances a segment index; each tick feeds that segment's per-node attention into
 *     `PersonaGraph.attentionOverride`, so nodes light/dim as "the room watches."
 *
 *   • CASCADE (W3 seam, stubbed): flat skills (Ideas/Hooks/Script) have NO timeline.
 *     There the control is a "Play" that reveals nodes in `cascadeOrder` (sentiment →
 *     weight). This wave imports the type seam only; the cascade itself lands in W3.
 *     We do NOT fabricate a pseudo-timeline for flat data (D-06).
 *
 * ALL motion is gated on `reducedMotion`: when reduced we render the static cloud + an
 * sr-only aggregate mirror (UI-SPEC copy, verbatim) and expose no auto-advancing motion.
 * No nondeterministic randomness anywhere — replay reads real `attentions`; the seed
 * plumbing for any variance lives in `PersonaGraph`/`lens-derive`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeatmapPayload } from '@/lib/engine/types';
import { PersonaGraph, type PersonaNode } from '@/components/board/_kit/PersonaGraph';
// W3 cascade seam — imported now so the type contract is locked; the cascade UI is
// completed in W3 (thin-signal mounts). Referenced via `cascadeOrder` below.
import { cascadeOrder } from './lens-derive';

export interface ReplayControllerProps {
  /** The Panel·10 nodes (PersonaNode.id === heatmap persona id). */
  nodes: PersonaNode[];
  /** Carries the per-persona `attentions[]` timeline (the only real timeline, D-06). */
  heatmap: HeatmapPayload | null;
  reducedMotion?: boolean;
}

/** ms per replayed segment — calm, readable, not a real-time crowd. */
const SEGMENT_MS = 700;

export function ReplayController({ nodes, heatmap, reducedMotion = false }: ReplayControllerProps) {
  // Per-node attention timelines aligned to `nodes` order (by persona id). A node is
  // "timeline-backed" only if its heatmap persona carries a non-empty attentions[].
  const timelines = useMemo(() => {
    const byId = new Map<string, number[]>();
    for (const p of heatmap?.personas ?? []) byId.set(p.id, p.attentions ?? []);
    return nodes.map((n) => byId.get(n.id) ?? []);
  }, [nodes, heatmap]);

  const segmentCount = useMemo(
    () => timelines.reduce((max, t) => Math.max(max, t.length), 0),
    [timelines],
  );
  const hasTimeline = segmentCount > 0;

  // The cascade order is computed (W3 will drive the flat-skill reveal off it). Kept
  // wired so the seam compiles and the type contract is exercised this wave.
  const reveal = useMemo(() => cascadeOrder(nodes), [nodes]);
  void reveal;

  const [segment, setSegment] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance the segment index while playing. Reduced motion never auto-advances.
  useEffect(() => {
    if (!playing || reducedMotion || !hasTimeline) return;
    timer.current = setInterval(() => {
      setSegment((s) => {
        const next = (s ?? -1) + 1;
        if (next >= segmentCount) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, SEGMENT_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, reducedMotion, hasTimeline, segmentCount]);

  // The per-node attention vector for the currently-replayed segment. Undefined when
  // not replaying → PersonaGraph falls back to aggregate watch-through.
  const attentionOverride = useMemo(() => {
    if (segment === null) return undefined;
    return timelines.map((t) => t[segment] ?? 0);
  }, [segment, timelines]);

  function handleReplay() {
    if (reducedMotion || !hasTimeline) return;
    setSegment(0);
    setPlaying(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-surface">
        <PersonaGraph
          personas={nodes}
          height={220}
          reducedMotion={reducedMotion}
          attentionOverride={attentionOverride}
        />
      </div>

      {/* Replay control — only the timeline path is live this wave (D-06). Hidden when
          there is no real timeline (flat skills get the W3 cascade instead). */}
      {hasTimeline && !reducedMotion && (
        <button
          type="button"
          onClick={handleReplay}
          disabled={playing}
          className="self-start rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50"
        >
          {playing ? `Replaying… ${(segment ?? 0) + 1}/${segmentCount}` : 'Replay reactions'}
        </button>
      )}

      {/* Reduced-motion / a11y aggregate mirror (always present). */}
      <ReplayMirror nodes={nodes} />
    </div>
  );
}

/**
 * sr-only aggregate + archetype-breakdown mirror (UI-SPEC reduced-motion copy):
 * "Audience reaction summary: {n} of {total} viewers stopped; strongest in {segment},
 * weakest in {segment}." Mirrors PersonaGraph's sr-only list, computed from the same
 * real watch-through (≥ 50% = stopped) — no fabricated crowd.
 */
function ReplayMirror({ nodes }: { nodes: PersonaNode[] }) {
  const total = nodes.length;
  const stopped = nodes.filter((n) => n.watchThrough >= 0.5).length;
  const sorted = [...nodes].sort((a, b) => b.watchThrough - a.watchThrough);
  const strongest = sorted[0]?.segment ?? sorted[0]?.label ?? 'the strongest cluster';
  const weakest =
    sorted[sorted.length - 1]?.segment ?? sorted[sorted.length - 1]?.label ?? 'the weakest cluster';

  return (
    <p className="sr-only" role="status">
      Audience reaction summary: {stopped} of {total} viewers stopped; strongest in {strongest},
      weakest in {weakest}.
    </p>
  );
}
