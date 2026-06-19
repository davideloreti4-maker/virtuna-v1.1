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
import { ARCHETYPES, type Archetype } from '@/lib/engine/wave3/persona-registry';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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

const EMPTY_HEADING = 'No audience reaction yet.';
const EMPTY_BODY = 'Run this concept against your audience to see how the room reacts.';

/** Population cascade: fraction of dots revealed per tick, and the calm tick period (ms). */
const CASCADE_STEP = 0.06;
const CASCADE_TICK_MS = 40;

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
      // coral cluster). WR-02: membership is decided by SLOT IDENTITY — a node is in the
      // worst cluster iff its archetype maps to the worst slot key. The previous approach
      // re-ran the <40%-stop rule on a single-node fold, which (for a single node) yields
      // 100% or 0% and so never tripped the <40% threshold — so a stop-verdict node in the
      // worst cluster was left un-toned while ClusterView painted the whole cluster coral.
      const toned = flatNodes.map((n) => {
        const slotKey = n.archetype ? archetypeToSlot(n.archetype) : 'fyp';
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
  //
  // CRITICAL (CR-01): only personas whose `archetype` is a REAL persona-registry enum are
  // chat-groundable. The chat route validates personaGrounding.archetype against ARCHETYPES
  // and rejects anything else (a display label or a positional `viewer_N` placeholder),
  // silently degrading to generic open chat + 400-ing rehydration. So we gate the affordance
  // off for non-enum personas rather than promising an in-voice answer we cannot deliver.
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
                    chat about AND at least one persona with a real registry-enum archetype to
                    ground on (CR-01) — flat card surfaces with only `viewer_N` placeholders
                    render no row rather than a chat that cannot ground. */}
                {conceptText && chatList.length > 0 && (
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
          ) : hasReaction ? (
            <PopulationRegion nodes={nodes} reducedMotion={reducedMotion} />
          ) : (
            <EmptyReaction />
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

/**
 * Population·1,000 region — fills the scale toggle's Population side with the
 * deterministic `PopulationSwarm` fed the SAME `nodes` Panel uses (one source — D-02
 * honesty). Switching Panel⇄Population is pure presentation: no refetch, no re-score
 * (Population never touches the scoring path).
 *
 * Cascade-on-play: ONE batched motion timeline (Pitfall 2) — a single `progress`
 * fraction advances 0→1 on a calm tick; `PopulationSwarm` dims dots whose rank exceeds
 * it via a single batched opacity decision (NOT 1,000 SMIL elements). Gated on
 * `reducedMotion`: when reduced we render the static swarm + its always-present sr-only
 * mirror and expose no auto-advancing motion.
 */
function PopulationRegion({
  nodes,
  reducedMotion,
}: {
  nodes: PersonaNode[];
  reducedMotion: boolean;
}) {
  // null = static (all dots present, pre-Play). A number 0..1 = cascade in progress.
  const [progress, setProgress] = useState<number | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascading = progress !== null;

  // Advance the single batched cascade timeline. Reduced motion never auto-advances
  // (the static swarm + sr-only mirror cover that path). The tick terminates by
  // settling to null (all dots present) once progress passes 1.
  //
  // WR-04: depend on the `cascading` BOOLEAN (not the advancing `progress`), so the
  // interval is created ONCE when the cascade starts and cleared once when it ends —
  // previously listing `progress` recreated a fresh setInterval on every tick (timing
  // jitter + defeats the purpose of setInterval). All state moves via the functional
  // updater, so the effect never needs to read `progress` directly.
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
