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
} from '@/components/board/audience/audience-derive';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { ReplayController } from './ReplayController';
import { useLensScale, type LensScale } from './use-lens-scale';
import { PersonaChatDrawer, type PersonaChatTarget } from './PersonaChatDrawer';

export interface AudienceLensProps {
  /** The opened Read's heatmap (carries the per-persona attention timeline). */
  heatmap: HeatmapPayload | null;
  /** Per-persona sim results when present (else attention means are used). */
  simResults: PersonaSimulationResult[] | undefined;
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
  readBlock,
  reducedMotion = false,
  conceptText,
  platform = 'tiktok',
  open,
  onOpenChange,
}: AudienceLensProps) {
  const [scale, setScale] = useLensScale();
  // The persona currently being asked "why" (null = drawer closed). One at a time (D-03).
  const [chatTarget, setChatTarget] = useState<PersonaChatTarget | null>(null);

  // The same nodes PersonaCloud derives — buildPersonaNodes returns [] when there
  // are no heatmap personas, which is the degraded-signal omit path.
  const nodes = useMemo(() => {
    const badKey = worstBadGroupKey(buildSegmentGroups(heatmap, simResults));
    return buildPersonaNodes(heatmap, simResults, badKey);
  }, [heatmap, simResults]);

  const hasReaction = nodes.length > 0;

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
                {/* Per-persona "Ask them why →" — opens the in-context chat drawer scoped to
                    this Read, one persona at a time (D-03). Only where we have a concept to
                    chat about + an archetype to ground on. */}
                {conceptText && (
                  <ul className="mt-4 flex flex-col gap-1">
                    {nodes
                      .filter((n) => Boolean(n.archetype))
                      .map((n) => (
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
