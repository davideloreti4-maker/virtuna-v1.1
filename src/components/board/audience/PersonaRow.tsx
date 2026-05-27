'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
 *
 * Color-blind mode: adds `heatmap-pattern-cb` class to root; the diagonal
 * stripe overlay is defined in `globals.css`, not inline.
 */
export function PersonaRow({
  personaId,
  slotType,
  archetypeLabel,
  segments,
  attentions,
  swipePredictedAt,
  rowState,
  colorBlindMode,
  onCellTap,
  onRowLabelTap,
}: PersonaRowProps) {
  if (rowState === 'skeleton' || !segments) {
    return (
      <div role="row" className="flex h-[32px] w-full items-stretch">
        <Skeleton className="h-full w-full" />
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
      className={cn(
        'relative flex h-[32px] w-full items-stretch',
        colorBlindMode && 'heatmap-pattern-cb',
      )}
      data-row-state={rowState}
    >
      {/* Row label */}
      <button
        type="button"
        onClick={onRowLabelTap}
        className="flex w-[88px] flex-shrink-0 items-center px-2 text-xs"
        style={{
          opacity: rowState === 'streaming' ? 0.6 : 1,
          color: ringColor,
        }}
        aria-label={`Persona ${archetypeLabel}: full reasoning`}
      >
        {archetypeLabel}
      </button>

      {/* Cells */}
      {segments.map((seg, i) => {
        const att = attentions?.[i] ?? 0;
        const alpha = animateNow ? clamp(att, 0.05, 0.80) : 0.05;

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
