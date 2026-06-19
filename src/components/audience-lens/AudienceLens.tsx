'use client';

/**
 * AudienceLens — the reusable living-audience sheet (P9 W1).
 *
 * The single v1 entry across all 6 skills (D-04, degrade-by-feature). Opened from
 * the `PersonaCloud onOpen` seam (Pitfall 1 — that seam was a dead stub wired to no
 * consumer until this plan). Layout top-to-bottom (UI-SPEC §Interaction Contract):
 *
 *   1. HEADER  — the P8 multi-audience Read (interpret + lever), reused VERBATIM via
 *                `MultiAudienceReadBlockRenderer`. NO recolor / redesign (landmine 9).
 *                Omitted on surfaces that carry no Read block (the video Reading
 *                surface — it has a heatmap timeline, not a Read card).
 *   2. SCALE   — a "Panel · 10" ⇄ "Population · 1,000" toggle. Population is a reserved
 *                placeholder slot this wave (W4 fills it with the deterministic swarm).
 *                The choice is remembered per-Lens as a last-used default (D-07).
 *   3. PANEL10 — the constellation: `PersonaGraph` over the same `buildPersonaNodes`
 *                output `PersonaCloud` computes. When that returns [], the cloud is
 *                OMITTED entirely (matches `PersonaCloud`'s `return null` degrade rule)
 *                and the "No audience reaction yet." empty copy shows only where a
 *                reaction was expected.
 *
 * Color: flat-matte THEME-06 surfaces only (`--color-background` / `--color-surface`).
 * NO glass, NO backdrop-filter class (Pitfall 4 — Lightning CSS strips it; if a blur
 * is ever needed it goes through an inline `style`, never a class). Coral is reserved
 * for the worst cluster + the Rewrite CTA + the inherited Read lever ONLY.
 */

import { useMemo, useState } from 'react';
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  buildFlatPersonaNodes,
  clusterFlatNodes,
  type FlatPersonaReaction,
  type SegmentGroup,
  type SlotKey,
} from '@/components/board/audience/audience-derive';
import type { PersonaNode } from '@/components/board/_kit';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { ReplayController } from './ReplayController';
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

export interface AudienceLensProps {
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
   * Optional/additive: when absent the drawer is omitted (no concept to chat about), so existing
   * call sites stay byte-identical.
   */
  conceptText?: string;
  /** Platform for the persona chat grounding (defaults tiktok). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /**
   * The Rewrite-for-audience loop (LIVE-07). Omitted ⇒ no sticky CTA (e.g. plain chat
   * turns — there is no regenerable concept object; D-05).
   */
  rewrite?: LensRewrite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCALE_OPTIONS: ReadonlyArray<{ value: LensScale; label: string }> = [
  { value: 'panel', label: 'Panel · 10' },
  { value: 'population', label: 'Population · 1,000' },
] as const;

/** Population honesty label — always visible under the swarm (UI-SPEC copy, verbatim). */
const POPULATION_HONESTY = '1,000 viewers instantiated from your 10 calibrated archetypes.';
const EMPTY_HEADING = 'No audience reaction yet.';
const EMPTY_BODY = 'Run this concept against your audience to see how the room reacts.';

export function AudienceLens({
  heatmap,
  simResults,
  flatPersonas,
  readBlock,
  reducedMotion = false,
  conceptText,
  platform = 'tiktok',
  rewrite,
  open,
  onOpenChange,
}: AudienceLensProps) {
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
      const flatNodes = buildFlatPersonaNodes(flatPersonas!);
      const { groups: g, worstKey: w } = clusterFlatNodes(flatNodes);
      // Paint the worst cluster's nodes coral in the cloud (mirror the table — the one
      // coral cluster). clusterFlatNodes folds nodes by slot identically, so a node is
      // in the worst cluster iff its single-node fold lands on the worst slot key.
      const toned = flatNodes.map((n) => {
        const slotKey = clusterFlatNodes([n]).groups.find((gr) => gr.count > 0)?.key ?? null;
        return w != null && slotKey === w ? { ...n, tone: 'accent' as const } : n;
      });
      return { nodes: toned, groups: g, worstKey: w };
    }
    const g = buildSegmentGroups(heatmap, simResults);
    const w = worstBadGroupKey(g);
    return { nodes: buildPersonaNodes(heatmap, simResults, w), groups: g, worstKey: w };
  }, [useFlat, flatPersonas, heatmap, simResults]);

  const hasReaction = nodes.length > 0;

  // The "Ask them why →" list — ordered by the SAME deterministic cascade order the
  // room reveals in (stops first, heaviest first; cascadeOrder, D-06) so the chat list
  // reads in lockstep with the staggered reveal rather than raw input order.
  const chatList = useMemo(() => {
    const grounded = nodes.filter((n) => Boolean(n.archetype));
    const rank = new Map(cascadeOrder(grounded).map((id, i) => [id, i]));
    return grounded
      .slice()
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [nodes]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-t-[20px] border-t border-[var(--color-border)] bg-background p-0"
      >
        <SheetTitle className="px-5 pt-5 text-[15px]">Audience</SheetTitle>

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
                    this Read, one persona at a time (D-03). Only where we have a concept to
                    chat about + an archetype to ground on. */}
                {conceptText && (
                  <ul className="mt-4 flex flex-col gap-1">
                    {chatList.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setChatTarget({
                                archetype: n.archetype!,
                                reactionToConcept: {
                                  verdict: n.watchThrough >= 0.5 ? 'stop' : 'scroll',
                                  quote: n.quote ?? '',
                                },
                              })
                            }
                            className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-[var(--color-hover)]"
                          >
                            <span>{n.label}</span>
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
          ) : (
            <PopulationSlot honesty={POPULATION_HONESTY} />
          )}
        </div>

        {/* 4 ── STICKY Rewrite-for-audience CTA (LIVE-07, D-05). Hidden where there is no
            regenerable concept object (plain chat turns) — `rewrite` is then undefined.
            Coral + --shadow-button (the one primary action; coral is reserved). */}
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
      </SheetContent>

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
    </Sheet>
  );
}

/**
 * Sticky "Rewrite for this audience →" CTA (LIVE-07, D-05). The one primary action —
 * coral + `--shadow-button` flat-matte (mirrors the shipped chain CTAs). On success the
 * Lens shows the DELTA vs the prior Read (prior stop-count → new stop-count). Sticks to
 * the bottom of the sheet so it stays reachable as the room scrolls.
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
      {/* Delta readout — prior → new stop-count (shown after a successful rewrite). The
          honest signal: did steering on the lever actually move the room? */}
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
        className="w-full rounded-[8px] px-4 py-2.5 text-[14px] font-medium text-[var(--color-accent-foreground)] transition-opacity disabled:opacity-60"
        style={{
          backgroundColor: 'var(--color-accent)',
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
 *  coral (UI-SPEC §Color: coral is reserved for the worst cluster + Rewrite CTA). */
function ScaleToggle({
  value,
  onChange,
}: {
  value: LensScale;
  onChange: (v: LensScale) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Audience scale"
      className="inline-flex rounded-[8px] border border-[var(--color-border)] bg-surface p-0.5"
    >
      {SCALE_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
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

/** Reserved Population·1,000 slot — W4 fills this with the deterministic swarm
 *  (consumes `instantiatePopulation` + `weightedRollup` from lens-derive). The
 *  honesty label is already wired so it ships the moment the swarm lands. */
function PopulationSlot({ honesty }: { honesty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="population-slot"
        className="flex h-[200px] items-center justify-center rounded-[8px] border border-dashed border-[var(--color-border)] bg-surface/40 text-[13px] text-foreground-muted"
      >
        Population swarm
      </div>
      <p className="text-[11px] text-[var(--color-cream-muted)]">{honesty}</p>
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
