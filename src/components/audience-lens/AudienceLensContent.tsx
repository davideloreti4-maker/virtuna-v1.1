'use client';

/**
 * AudienceLensContent — the reusable living-audience BODY (P9 W1, split out P13).
 *
 * This is the Lens minus its sheet chrome: the Read header, the Panel·10 ⇄ Population·1,000
 * scale, the constellation / swarm, the per-persona "Ask them why →" list, the sticky
 * Rewrite CTA, and the in-context persona-chat drawer. It mounts in TWO places, byte-identical:
 *   1. `<AudienceLens>` — wrapped in a bottom `<Sheet>` (the original per-card / reading door).
 *   2. The ambient `<AudiencePresence>` FULL detent — rendered DIRECTLY (no nested sheet), so
 *      the largest detent feels like the same object the creator keeps opening (P13 fork #5,
 *      "Layer 3 lives in the SAME panel"), not a modal that jumps in over the top.
 *
 * Splitting the content from the sheet is the ONE structural change vs P9: every view, the
 * honesty spine, and the colour rules are unchanged (the diff is purely "remove the outer
 * <Sheet>/<SheetContent>/<SheetTitle>"). The host supplies the scroll container + the title.
 *
 * Color: flat-matte THEME-06 surfaces only (`--color-background` / `--color-surface`).
 * NO glass, NO backdrop-filter class (Pitfall 4 — Lightning CSS strips it). Coral is reserved
 * for the worst cluster + the Rewrite CTA + the inherited Read lever ONLY.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  buildFlatPersonaNodes,
  clusterFlatNodes,
  archetypeToSlot,
  type FlatPersonaReaction,
  type SegmentGroup,
  type SlotKey,
} from '@/components/board/audience/audience-derive';
import type { PersonaNode } from '@/components/board/_kit';
import type { PopulationAggregate } from '@/lib/audience/population';
import { ARCHETYPES, type Archetype } from '@/lib/engine/wave3/persona-registry';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { ReplayController } from './ReplayController';
import { PopulationSwarm } from './PopulationSwarm';
import { ClusterView } from './ClusterView';
import { cascadeOrder } from './lens-derive';
import { useLensScale, type LensScale } from './use-lens-scale';
import { PersonaChatDrawer, type PersonaChatTarget } from './PersonaChatDrawer';

/**
 * The Rewrite-for-audience loop (LIVE-07, D-05). When provided, a sticky "Rewrite for
 * this audience →" CTA re-POSTs to the ORIGINATING skill's own runner with the Read's
 * lever injected as steering, producing a new card + Read in-thread; on success the Lens
 * surfaces the DELTA vs the prior Read. Omitted on non-regenerable surfaces (plain chat
 * turns — D-05): no concept object to regenerate → no CTA.
 */
export interface LensRewrite {
  /** The originating skill's own runner endpoint (from CHAIN_HANDOFFS self-handoff). */
  endpoint: string;
  /** The Read's lever line — injected as the steering anchor on the re-POST. */
  lever: string;
  /** Platform carried on the re-POST body (matches the runner contract). */
  platform: string;
  /** Prior-Read stop count for the delta readout (e.g. "6/10 → 8/10"). */
  priorStopCount: number;
  /** Prior-Read total persona count for the delta readout. */
  priorTotal: number;
  /**
   * Fires the re-POST. The host owns the actual fetch + in-thread streaming (it has the
   * thread context); the Lens supplies the lever-as-steering anchor + platform. Resolves
   * with the NEW Read's stop/total so the Lens can render the delta, or null on failure.
   */
  onRewrite: (anchor: string, platform: string) => Promise<{ stopCount: number; total: number } | null>;
}

export interface AudienceLensContentProps {
  /** The opened Read's heatmap (carries the per-persona attention timeline). */
  heatmap: HeatmapPayload | null;
  /** Per-persona sim results when present (else attention means are used). */
  simResults: PersonaSimulationResult[] | undefined;
  /**
   * Flat Shape-B reactions — the text-skill / text-Read persona shape (no timeline,
   * D-06). When supplied (and `heatmap` is absent), the Lens degrades to cascade mode:
   * cloud + drill + cluster + Population + chat + Rewrite all work; only segment-by-
   * segment replay is unavailable (there is no real timeline to replay).
   */
  flatPersonas?: FlatPersonaReaction[];
  /** The P8 multi-audience Read block — present on skill surfaces, absent on Reading. */
  readBlock?: MultiAudienceReadBlock | null;
  /** Honors the user's OS motion preference (gates all replay/cascade motion). */
  reducedMotion?: boolean;
  /**
   * The concept text this Read reacted to — grounds the "Ask them why →" persona chat (D-03).
   * Optional/additive: when absent the drawer is omitted (no concept to chat about).
   */
  conceptText?: string;
  /** Platform for the persona chat grounding (defaults tiktok). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /**
   * The Rewrite-for-audience loop (LIVE-07). Omitted ⇒ no sticky CTA (e.g. plain chat
   * turns — there is no regenerable concept object; D-05).
   */
  rewrite?: LensRewrite;
  /**
   * Archetype→creator-label overrides (The Room, Task A). The host (the presence) builds this
   * from the active audience's `personas[].label` so a creator-renamed person wins; every other
   * archetype falls back to its stable default name. Absent/`{}` ⇒ default names for all — still
   * real, still recurring. Memoize in the host so the node build stays stable across renders.
   */
  personaNameOverrides?: Record<string, string>;
  /**
   * Audience Sim v2 (Stage 2): the REAL N-individual population projection for this concept.
   * When present it drives the Population·1,000 view's counters + honesty label + per-segment
   * breakdown (the genuine distribution the type-to-room path already shows). Absent ⇒ the
   * honest-lean rollup of the 10 (byte-identical to the pre-v2 Sheet).
   */
  population?: PopulationAggregate;
}

const SCALE_OPTIONS: ReadonlyArray<{ value: LensScale; label: string }> = [
  { value: 'panel', label: 'Panel · 10' },
  { value: 'population', label: 'Population · 1,000' },
] as const;

const EMPTY_HEADING = 'No audience reaction yet.';
const EMPTY_BODY = 'Run this concept against your audience to see how the room reacts.';

/** Population cascade: fraction of dots revealed per tick, and the calm tick period (ms). */
const CASCADE_STEP = 0.06;
const CASCADE_TICK_MS = 40;

export function AudienceLensContent({
  heatmap,
  simResults,
  flatPersonas,
  readBlock,
  reducedMotion = false,
  conceptText,
  platform = 'tiktok',
  rewrite,
  personaNameOverrides,
  population,
}: AudienceLensContentProps) {
  const [scale, setScale] = useLensScale();
  // The persona currently being asked "why" (null = drawer closed). One at a time (D-03).
  const [chatTarget, setChatTarget] = useState<PersonaChatTarget | null>(null);
  // Rewrite-for-audience loop state (LIVE-07): in-flight + the delta vs the prior Read.
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [delta, setDelta] = useState<{ stopCount: number; total: number } | null>(null);

  async function handleRewrite() {
    if (!rewrite || rewriting) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      // Inject the Read's lever as the steering anchor (lever-as-steering, D-05). The host
      // owns the actual re-POST + in-thread streaming; the Lens supplies the steering.
      const result = await rewrite.onRewrite(rewrite.lever, rewrite.platform);
      if (result) {
        setDelta(result);
      } else {
        setRewriteError("Couldn't rewrite right now. Your concept is saved — try again in a moment.");
      }
    } catch {
      setRewriteError("Couldn't rewrite right now. Your concept is saved — try again in a moment.");
    } finally {
      setRewriting(false);
    }
  }

  // Signal shape: a real heatmap (rich, timeline) takes precedence; otherwise the flat
  // Shape-B reactions drive a degraded cascade-mode Lens (D-06). Both resolve to the
  // SAME PersonaNode[] + SegmentGroup[] shape so every view below is shared (D-04).
  const useFlat = !heatmap && Array.isArray(flatPersonas) && flatPersonas.length > 0;

  const { nodes, groups, worstKey } = useMemo((): {
    nodes: PersonaNode[];
    groups: SegmentGroup[];
    worstKey: SlotKey | null;
  } => {
    if (useFlat) {
      const flatNodes = buildFlatPersonaNodes(flatPersonas!, personaNameOverrides);
      const { groups: g, worstKey: w } = clusterFlatNodes(flatNodes);
      // Paint the worst cluster's nodes coral in the cloud (mirror the table — the one
      // coral cluster). WR-02: membership is decided by SLOT IDENTITY — a node is in the
      // worst cluster iff its archetype maps to the worst slot key.
      const toned = flatNodes.map((n) => {
        const slotKey = n.archetype ? archetypeToSlot(n.archetype) : 'fyp';
        return w != null && slotKey === w ? { ...n, tone: 'accent' as const } : n;
      });
      return { nodes: toned, groups: g, worstKey: w };
    }
    const g = buildSegmentGroups(heatmap, simResults);
    const w = worstBadGroupKey(g);
    return { nodes: buildPersonaNodes(heatmap, simResults, w, personaNameOverrides), groups: g, worstKey: w };
  }, [useFlat, flatPersonas, heatmap, simResults, personaNameOverrides]);

  const hasReaction = nodes.length > 0;

  // The "Ask them why →" list — ordered by the SAME deterministic cascade order the
  // room reveals in (stops first, heaviest first; cascadeOrder, D-06).
  //
  // CRITICAL (CR-01): only personas whose `archetype` is a REAL persona-registry enum are
  // chat-groundable. The chat route validates personaGrounding.archetype against ARCHETYPES
  // and rejects anything else, so we gate the affordance off for non-enum personas.
  const chatList = useMemo(() => {
    const grounded = nodes.filter(
      (n) => n.archetype != null && ARCHETYPES.includes(n.archetype as Archetype),
    );
    const rank = new Map(cascadeOrder(grounded).map((id, i) => [id, i]));
    return grounded
      .slice()
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [nodes]);

  return (
    <>
      {/* 1 ── HEADER: the P8 Read, reused verbatim (no recolor — landmine 9). */}
      {readBlock && (
        <div className="px-5 pt-3">
          <MultiAudienceReadBlockRenderer block={readBlock} />
        </div>
      )}

      {/* 2 ── SCALE toggle: Panel · 10 ⇄ Population · 1,000 (Population = W4 slot). */}
      <div className="px-5 pt-4">
        <ScaleToggle value={scale} onChange={setScale} />
      </div>

      {/* 3 ── PANEL·10 region (or the reserved Population slot). */}
      <div className="px-5 pb-6 pt-4">
        {scale === 'panel' ? (
          hasReaction ? (
            <>
              <ReplayController
                nodes={nodes}
                heatmap={heatmap}
                reducedMotion={reducedMotion}
              />
              {/* Cluster-by-segment lens (D-04): which Temp×Disposition segment loved /
                  hated the concept; the single worst cluster reads coral (≤2 marks). */}
              <div className="mt-4">
                <ClusterView groups={groups} worstKey={worstKey} />
              </div>
              {/* Per-persona "Ask them why →" — opens the in-context chat drawer scoped to
                  this Read, one persona at a time (D-03). Gated on a real registry-enum
                  archetype (CR-01). */}
              {conceptText && chatList.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1">
                  {chatList.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setChatTarget({
                            archetype: n.archetype!,
                            name: n.name ?? n.label,
                            segment: n.segment,
                            reactionToConcept: {
                              verdict: n.watchThrough >= 0.5 ? 'stop' : 'scroll',
                              quote: n.quote ?? '',
                            },
                          })
                        }
                        className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <span>{n.name ?? n.label}</span>
                        <span className="text-foreground-muted">Ask them why →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <EmptyReaction />
          )
        ) : hasReaction ? (
          <PopulationRegion nodes={nodes} population={population} reducedMotion={reducedMotion} />
        ) : (
          <EmptyReaction />
        )}
      </div>

      {/* 4 ── STICKY Rewrite-for-audience CTA (LIVE-07, D-05). Coral + --shadow-button. */}
      {rewrite && hasReaction && (
        <RewriteCta
          rewriting={rewriting}
          error={rewriteError}
          delta={delta}
          priorStopCount={rewrite.priorStopCount}
          priorTotal={rewrite.priorTotal}
          onRewrite={() => void handleRewrite()}
        />
      )}

      {/* The in-context chat-with-persona drawer (P9 / LIVE-03, D-03). Mounted only when a
          concept is available to ground the in-voice answer; one persona at a time. */}
      {conceptText && (
        <PersonaChatDrawer
          target={chatTarget}
          conceptText={conceptText}
          platform={platform}
          onClose={() => setChatTarget(null)}
        />
      )}
    </>
  );
}

/**
 * Sticky "Rewrite for this audience →" CTA (LIVE-07, D-05). The one primary action —
 * coral + `--shadow-button` flat-matte. On success the Lens shows the DELTA vs the prior
 * Read. Sticks to the bottom of the host scroll container so it stays reachable.
 */
function RewriteCta({
  rewriting,
  error,
  delta,
  priorStopCount,
  priorTotal,
  onRewrite,
}: {
  rewriting: boolean;
  error: string | null;
  delta: { stopCount: number; total: number } | null;
  priorStopCount: number;
  priorTotal: number;
  onRewrite: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--color-border)] bg-background px-5 py-4">
      {/* Delta readout — prior → new stop-count (shown after a successful rewrite). */}
      {delta && (
        <p className="text-[13px] text-foreground" role="status" aria-live="polite">
          <span className="text-[var(--color-cream-muted)]">
            {priorStopCount}/{priorTotal} stop
          </span>
          <span className="mx-1.5 text-[var(--color-cream-muted)]">→</span>
          <span className="font-medium">
            {delta.stopCount}/{delta.total} stop
          </span>
          <span className="ml-2 text-[var(--color-cream-muted)]">
            {delta.stopCount > priorStopCount
              ? 'the lever moved the room.'
              : delta.stopCount < priorStopCount
                ? 'the lever cost you stops.'
                : 'no change from the lever.'}
          </span>
        </p>
      )}
      {error && (
        <p className="text-[13px] text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onRewrite}
        disabled={rewriting}
        className="w-full rounded-[8px] bg-action px-4 py-2.5 text-[14px] font-medium text-action-foreground transition-opacity hover:bg-action/90 disabled:opacity-60"
        style={{
          boxShadow: 'var(--shadow-button)',
        }}
        aria-label="Rewrite this concept steered by the audience's lever"
      >
        {rewriting ? 'Rewriting…' : 'Rewrite for this audience →'}
      </button>
    </div>
  );
}

/** Flat-matte segmented control. Selected side uses white-alpha hover/active — NEVER
 *  coral (UI-SPEC §Color). WR-06: a `role="group"` + `aria-pressed` inline toggle, NOT
 *  an ARIA tabs widget (the regions below are not tabpanels). */
function ScaleToggle({
  value,
  onChange,
}: {
  value: LensScale;
  onChange: (v: LensScale) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Audience scale"
      className="inline-flex rounded-[8px] border border-[var(--color-border)] bg-surface p-0.5"
    >
      {SCALE_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              'rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ' +
              (active
                ? 'bg-[var(--color-active)] text-foreground'
                : 'text-foreground-muted hover:bg-[var(--color-hover)]')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Population·1,000 region — fills the scale toggle's Population side with the
 * deterministic `PopulationSwarm` fed the SAME `nodes` Panel uses (one source — D-02
 * honesty). Switching Panel⇄Population is pure presentation: no refetch, no re-score.
 */
function PopulationRegion({
  nodes,
  population,
  reducedMotion,
}: {
  nodes: PersonaNode[];
  population?: PopulationAggregate;
  reducedMotion: boolean;
}) {
  // null = static (all dots present, pre-Play). A number 0..1 = cascade in progress.
  const [progress, setProgress] = useState<number | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascading = progress !== null;

  // Advance the single batched cascade timeline. Reduced motion never auto-advances.
  // WR-04: depend on the `cascading` BOOLEAN (not the advancing `progress`).
  useEffect(() => {
    if (!cascading || reducedMotion) return;
    cascadeTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p === null) return null;
        const next = p + CASCADE_STEP;
        return next >= 1 ? null : next;
      });
    }, CASCADE_TICK_MS);
    return () => {
      if (cascadeTimer.current) clearInterval(cascadeTimer.current);
    };
  }, [cascading, reducedMotion]);

  return (
    <div className="flex flex-col gap-3">
      <PopulationSwarm
        nodes={nodes}
        population={population}
        reducedMotion={reducedMotion}
        cascadeProgress={progress ?? undefined}
      />
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setProgress(0)}
          disabled={cascading}
          className="self-start rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50"
        >
          {cascading ? 'Reading the room…' : 'Play'}
        </button>
      )}
    </div>
  );
}

/** Empty-reaction copy — shown only where a reaction was expected but is absent. */
function EmptyReaction() {
  return (
    <div className="flex flex-col gap-1 py-8 text-center">
      <p className="text-[15px] font-semibold text-foreground">{EMPTY_HEADING}</p>
      <p className="text-[13px] text-foreground-muted">{EMPTY_BODY}</p>
    </div>
  );
}
