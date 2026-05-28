'use client';

import { useMemo } from 'react';
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';
import type { HeatmapPayload } from './audience-types';

// ─── Prop interface ────────────────────────────────────────────────────────

export interface AntiViralityOverlayProps {
  result: { confidence: number; heatmap: HeatmapPayload | null } | null;
  onFixChipTap: (segmentIdx: number, fixText: string) => void;
  fixTextBySegment: Record<number, string>;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AntiViralityOverlay({ result, onFixChipTap, fixTextBySegment }: AntiViralityOverlayProps) {
  const state = useMemo(() => {
    if (!result) return { gated: false, reason: null, dropoff_segment_indices: [] as number[] };
    return isAntiViralityGatedFull(result.confidence, result.heatmap);
  }, [result]);

  if (!state.gated) return null;

  const showChips = state.reason === 'timeline_pattern' || state.reason === 'both';
  const showBorder = state.reason === 'confidence' || state.reason === 'both';

  return (
    <div
      className="anti-virality-overlay"
      role="status"
      aria-live="polite"
      aria-label={`Anti-virality triggered: ${state.reason}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        border: showBorder ? '1px solid var(--color-warning)' : 'none',
        borderRadius: 'inherit',
        transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {showBorder && (
        <span
          className="absolute right-2 top-2 text-xs"
          style={{ color: 'var(--color-warning)' }}
          aria-label="Low confidence warning"
        >
          ⚠
        </span>
      )}
      {showChips && (
        <div
          className="absolute left-0 right-0 flex flex-wrap gap-1 px-2"
          style={{ top: 'var(--filmstrip-bottom, 100px)', pointerEvents: 'auto' }}
        >
          {state.dropoff_segment_indices.map((segIdx) => {
            const fixText = fixTextBySegment[segIdx] ?? 'rework segment';
            return (
              <button
                key={segIdx}
                type="button"
                onClick={() => onFixChipTap(segIdx, fixText)}
                className="rounded-[4px] border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: 'var(--color-warning)',
                  background: 'var(--color-surface-elevated)',
                }}
                aria-label={`Fix suggestion for segment ${segIdx}: ${fixText}`}
              >
                seg {segIdx}: {fixText}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
