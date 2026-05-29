'use client';

import { useEffect, useRef } from 'react';
import { useRetentionCurveCanvas } from './use-retention-curve-canvas';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePerfStore } from '@/lib/perf-tier';
import type { HeatmapPayload } from '@/lib/engine/types';
import type { TapPopoverPayload } from './audience-types';

export interface RetentionCurveProps {
  weightedCurve: number[] | null;
  baselineCurve: number[] | null;
  heatmap: HeatmapPayload | null;
  totalDurationSec: number;
  morphRequested: boolean;
  antiViralityXRange?: [number, number] | null;
  onTap: (payload: TapPopoverPayload) => void;
  weightedCompletionPct?: number;
}

export function RetentionCurve(props: RetentionCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReduced = usePrefersReducedMotion();
  const tier = usePerfStore((s) => s.tier);
  const reducedMotion = prefersReduced || tier === 'low';

  const { onTap } = useRetentionCurveCanvas({
    canvasRef,
    weightedCurve: props.weightedCurve,
    baselineCurve: props.baselineCurve,
    segments: props.heatmap?.segments ?? null,
    // Markers are computed inside the hook from the live canvas size (see hook
    // comment) — pass personas, not pre-computed markers, so they never stale.
    personas: props.heatmap?.personas ?? null,
    morphRequested: props.morphRequested,
    reducedMotion,
    antiViralityXRange: props.antiViralityXRange ?? null,
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const handler = (e: PointerEvent) => {
      const hit = onTap(e);
      if (hit) props.onTap(hit);
    };
    c.addEventListener('pointerdown', handler);
    return () => c.removeEventListener('pointerdown', handler);
  }, [onTap, props]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Audience retention curve. Weighted average: ${props.weightedCompletionPct ?? 0}% watch time`}
      className="block h-[150px] w-full"
    />
  );
}
