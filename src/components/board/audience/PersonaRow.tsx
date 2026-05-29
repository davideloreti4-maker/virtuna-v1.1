'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { CELL_FILL_WAVE_MS, CELL_FILL_STAGGER_MS, MARKER_RING_COLOR } from './audience-constants';
import type { PersonaRowProps } from './audience-types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Returns the index of the segment that contains time `t`.
 * Returns -1 if no segment contains `t`.
 */
function segIdxContainingT(
  segments: NonNullable<PersonaRowProps['segments']>,
  t: number,
): number {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (t >= seg.t_start && t < seg.t_end) return i;
  }
  // Handle edge case: t equals the very end of the last segment
  const last = segments[segments.length - 1];
  if (last && t === last.t_end) return segments.length - 1;
  return -1;
}

/**
 * PersonaRow — single heatmap row.
 *
 * Renders:
 * - skeleton state: full-width Skeleton shimmer (no cells)
 * - streaming state: row label fades in (opacity 0.6), cells at base coral
 * - filling state: cells animate L→R via CSS transition-delay stagger
 * - complete state: cells at full saturation
 */
export function PersonaRow({
  // personaId is part of the prop contract for external consumers (e.g. AudienceNode)
  // but PersonaRow itself doesn't need to render it — the parent routes events by id.
  personaId: _personaId,
  slotType,
  archetypeLabel,
  segments,
  attentions,
  swipePredictedAt,
  rowState,
  rowIndex,
  onCellTap,
  onRowLabelTap,
}: PersonaRowProps) {
  if (rowState === 'skeleton' || !segments) {
    return (
      <div
        role="row"
        aria-rowindex={rowIndex}
        className="flex h-[32px] w-full items-stretch"
      >
        <div role="gridcell" aria-label="loading persona row" className="h-full w-full">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  const animateNow = rowState === 'filling' || rowState === 'complete';
  const swipeSegIdx =
    swipePredictedAt != null ? segIdxContainingT(segments, swipePredictedAt) : -1;
  const ringColor = MARKER_RING_COLOR[slotType];

  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      className="relative flex h-[32px] w-full items-stretch"
      data-row-state={rowState}
    >
      {/* Row label — rowheader cell wraps the interactive button */}
      <div role="rowheader" className="flex w-[88px] flex-shrink-0">
        <button
          type="button"
          onClick={onRowLabelTap}
          className="flex h-full w-full flex-col justify-center px-2"
          style={{
            opacity: rowState === 'streaming' ? 0.6 : 1,
            color: ringColor,
          }}
          aria-label={`Persona ${archetypeLabel}: full reasoning`}
        >
          <span className="text-[11px] font-medium leading-tight truncate">{archetypeLabel}</span>
          {swipePredictedAt != null && (
            <span className="text-[9px] leading-tight tabular-nums" style={{ opacity: 0.4 }}>
              drops {swipePredictedAt.toFixed(0)}s
            </span>
          )}
        </button>
      </div>

      {/* Cells */}
      {segments.map((seg, i) => {
        const att = attentions?.[i] ?? 0;
        // Map attention 0–1 linearly into a calm alpha band. The previous
        // clamp(att, 0.04, 0.42) floored EVERY attention ≥0.42 to the same
        // ceiling, so real-world values (mostly 0.4–1.0) rendered as a uniform
        // orange block with zero per-segment variation — personas looked
        // identical. Linear keeps the calm ceiling (~0.44) while restoring the
        // gradient that reads as distinct persona behaviour.
        const alpha = animateNow ? 0.04 + clamp(att, 0, 1) * 0.4 : 0.04;

        return (
          <button
            type="button"
            key={seg.idx}
            role="gridcell"
            aria-colindex={i + 1}
            aria-label={`${Math.round(att * 100)}% attention at segment ${seg.idx}, ${seg.t_start.toFixed(1)}s to ${seg.t_end.toFixed(1)}s`}
            onClick={() => onCellTap(seg.idx)}
            className="heatmap-cell relative flex-1 border-r border-white/[0.06]"
            style={{
              background: `rgba(255,127,80, ${alpha})`,
              transition: `background-color ${CELL_FILL_WAVE_MS}ms linear`,
              transitionDelay: `${i * CELL_FILL_STAGGER_MS}ms`,
            }}
          >
            {swipeSegIdx === i && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 w-px"
                style={{ background: 'rgba(255,255,255,1)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
