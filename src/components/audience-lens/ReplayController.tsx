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
 *   • CASCADE (W3, live): flat skills (Ideas/Hooks/Script/Remix) + the text Read have
 *     NO timeline. There the control is a "Play" that REVEALS nodes one-by-one in
 *     `cascadeOrder` (stops first, heaviest first) — a staggered reveal animation, NOT a
 *     fabricated pseudo-timeline (D-06). Before "Play" all nodes are present (static
 *     cloud); "Play" dims un-revealed nodes and lights them in cascade order.
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
/** ms per cascade-revealed node — slightly snappier than a segment tick. */
const CASCADE_MS = 320;

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

  // Deterministic cascade reveal order (stops first, heaviest first) — drives the
  // flat-signal "Play" staggered reveal (D-06). Pure; no Math.random.
  const reveal = useMemo(() => cascadeOrder(nodes), [nodes]);

  // ── TIMELINE replay (video Test surface) ──────────────────────────────────────
  const [segment, setSegment] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── CASCADE reveal (flat surfaces) ────────────────────────────────────────────
  // How many nodes (in `reveal` order) are currently revealed. null = all present
  // (static, pre-Play). A number = the staggered reveal is in progress.
  const [revealed, setRevealed] = useState<number | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascading = revealed !== null;

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

  // Advance the cascade reveal one node at a time. Reduced motion never auto-advances
  // (the static cloud + sr-only mirror cover that path). The tick itself terminates by
  // setting `revealed` back to null once every node has been lit (all nodes present).
  //
  // WR-04: depend on the `cascading` BOOLEAN (not the advancing `revealed` counter), so the
  // interval is created ONCE when the cascade starts and cleared once when it ends —
  // previously listing `revealed` recreated a fresh setInterval on every tick (timing jitter
  // + defeats setInterval). The terminal bound is read off a ref so the running tick always
  // sees the current node count without re-subscribing the effect each frame.
  const revealLenRef = useRef(reveal.length);
  revealLenRef.current = reveal.length;
  useEffect(() => {
    if (!cascading || reducedMotion) return;
    cascadeTimer.current = setInterval(() => {
      setRevealed((r) => {
        if (r === null) return null;
        const next = r + 1;
        return next > revealLenRef.current ? null : next;
      });
    }, CASCADE_MS);
    return () => {
      if (cascadeTimer.current) clearInterval(cascadeTimer.current);
    };
  }, [cascading, reducedMotion]);

  // The per-node attention vector for the currently-replayed segment. Undefined when
  // not replaying → PersonaGraph falls back to aggregate watch-through.
  const timelineOverride = useMemo(() => {
    if (segment === null) return undefined;
    return timelines.map((t) => t[segment] ?? 0);
  }, [segment, timelines]);

  // During a cascade, dim un-revealed nodes to ~0 and light revealed ones to their
  // real watch-through. Ordered by `reveal` (cascadeOrder), aligned back to `nodes`.
  const cascadeOverride = useMemo(() => {
    if (revealed === null) return undefined;
    const rank = new Map<string, number>();
    reveal.forEach((id, idx) => rank.set(id, idx));
    return nodes.map((n) => {
      const idx = rank.get(n.id) ?? Number.POSITIVE_INFINITY;
      return idx < revealed ? n.watchThrough : 0;
    });
  }, [revealed, reveal, nodes]);

  const attentionOverride = timelineOverride ?? cascadeOverride;

  function handleReplay() {
    if (reducedMotion || !hasTimeline) return;
    setSegment(0);
    setPlaying(true);
  }

  function handlePlayCascade() {
    if (reducedMotion || hasTimeline || nodes.length === 0) return;
    setRevealed(0);
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

      {/* Replay control — segment-by-segment ONLY where a real timeline exists (D-06). */}
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

      {/* "Play" — staggered cascade reveal on flat surfaces (no timeline → no replay).
          A reveal animation ordered by verdict/weight, NOT a fabricated timeline. */}
      {!hasTimeline && !reducedMotion && nodes.length > 0 && (
        <button
          type="button"
          onClick={handlePlayCascade}
          disabled={cascading}
          className="self-start rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50"
        >
          {cascading
            ? `Reading… ${Math.min(revealed ?? 0, reveal.length)}/${reveal.length}`
            : 'Play'}
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
