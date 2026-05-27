/**
 * use-retention-curve-canvas.ts
 *
 * DPR-aware RAF canvas hook: drives curve morph (baseline → weighted) +
 * marker fade-in in a SINGLE shared RAF loop. Reduced-motion path renders
 * final state immediately, never schedules a recurring RAF loop.
 *
 * Pattern mirrors src/components/hive-demo/hive-demo-canvas.tsx verbatim for
 * DPR setup and RAF lifecycle. Catmull-Rom α=0.5 is hand-rolled (≤25 LOC,
 * no d3-shape import per RESEARCH §4.4).
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { easeOutCubic, drawMarkers, findMarkerAtPoint } from './DropoffMarkers';
import {
  CURVE_MORPH_MS,
  MARKER_RING_COLOR,
} from './audience-constants';
import type { HeatmapPayload } from '@/lib/engine/types';
import type { MarkerOrCluster, TapPopoverPayload } from './audience-types';

// Suppress unused MARKER_RING_COLOR lint warning (used via drawMarkers indirectly)
void MARKER_RING_COLOR;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseRetentionCurveCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  weightedCurve: number[] | null;
  baselineCurve: number[] | null;
  segments: HeatmapPayload['segments'] | null;
  markers: MarkerOrCluster[];
  morphRequested: boolean;
  reducedMotion: boolean;
  antiViralityXRange?: [number, number] | null;
}

export interface UseRetentionCurveCanvasResult {
  onTap: (e: PointerEvent) => TapPopoverPayload | null;
}

// ---------------------------------------------------------------------------
// Catmull-Rom α=0.5 hand-roll (≤25 LOC) — RESEARCH §4.4
// ---------------------------------------------------------------------------

/**
 * Draw a Catmull-Rom spline (α=0.5) through an array of canvas points.
 * Uses bezierCurveTo for each interior segment. Guard: <2 points → moveTo only.
 * NaN coerced to 0 (T-04-13 guard).
 */
export function drawCatmullRomCurve(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
): void {
  if (pts.length < 2) {
    if (pts.length === 1) ctx.moveTo(pts[0]!.x, pts[0]!.y);
    return;
  }
  const safe = (v: number) => (isNaN(v) ? 0 : v);
  ctx.moveTo(safe(pts[0]!.x), safe(pts[0]!.y));
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!;
    // Catmull-Rom α=0.5 tangent scale = 1/6 for centripetal
    const cp1x = safe(p1.x + (p2.x - p0.x) / 6);
    const cp1y = safe(p1.y + (p2.y - p0.y) / 6);
    const cp2x = safe(p2.x - (p3.x - p1.x) / 6);
    const cp2y = safe(p2.y - (p3.y - p1.y) / 6);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, safe(p2.x), safe(p2.y));
  }
}

// ---------------------------------------------------------------------------
// lerp helper
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRetentionCurveCanvas(
  opts: UseRetentionCurveCanvasOptions,
): UseRetentionCurveCanvasResult {
  const {
    canvasRef,
    weightedCurve,
    baselineCurve,
    segments,
    markers,
    morphRequested,
    reducedMotion,
    antiViralityXRange,
  } = opts;

  // Morph state refs — avoids re-rendering on animation progress
  const animRef = useRef<number>(0);
  const morphStartTimeRef = useRef<number>(0);
  const isMorphingRef = useRef<boolean>(false);

  // Latest prop snapshot refs (for RAF closure access without stale closures)
  const weightedCurveRef = useRef<number[] | null>(weightedCurve);
  const baselineCurveRef = useRef<number[] | null>(baselineCurve);
  const segmentsRef = useRef<HeatmapPayload['segments'] | null>(segments);
  const markersRef = useRef<MarkerOrCluster[]>(markers);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const antiViralityXRangeRef = useRef<[number, number] | null | undefined>(antiViralityXRange);

  // Sync refs on every render
  weightedCurveRef.current = weightedCurve;
  baselineCurveRef.current = baselineCurve;
  segmentsRef.current = segments;
  markersRef.current = markers;
  reducedMotionRef.current = reducedMotion;
  antiViralityXRangeRef.current = antiViralityXRange;

  // ---------------------------------------------------------------------------
  // Core draw function — called from RAF or synchronously in reduced-motion mode
  // ---------------------------------------------------------------------------

  const drawFrame = useCallback(
    (timestamp: number, morphProgress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // DPR-aware setup (verbatim from hive-demo-canvas.tsx lines 52–62)
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const weighted = weightedCurveRef.current;
      const baseline = baselineCurveRef.current;
      const segs = segmentsRef.current;
      const totalDuration = segs ? segs[segs.length - 1]?.t_end ?? 30 : 30;

      // Compute current curve values (lerp baseline → weighted)
      const n = weighted?.length ?? 0;
      const current: number[] = [];
      for (let i = 0; i < n; i++) {
        const b = baseline?.[i] ?? 0;
        const tar = weighted?.[i] ?? b;
        current.push(reducedMotionRef.current ? tar : lerp(b, tar, morphProgress));
      }

      // ── 1. Hook zone warm band (0–3s x range) ──────────────────────────────
      const hookEndX = Math.min(3 / totalDuration, 1) * w;
      ctx.fillStyle = 'rgba(255,127,80,0.08)';
      ctx.fillRect(0, 0, hookEndX, h);

      // ── 2. Anti-virality orange band (if triggered) ─────────────────────────
      const avRange = antiViralityXRangeRef.current;
      if (avRange) {
        const x0 = (avRange[0] / totalDuration) * w;
        const x1 = (avRange[1] / totalDuration) * w;
        ctx.fillStyle = 'rgba(234,179,8,0.12)'; // warning band
        ctx.fillRect(x0, 0, x1 - x0, h);
      }

      // ── 3. Y gridlines ─────────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (const pct of [0.25, 0.5, 0.75, 1.0]) {
        const y = h * (1 - pct);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // ── 4. Y-axis labels (10px monospace) ──────────────────────────────────
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const [pct, label] of [[0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1.0, '100']] as const) {
        const y = h * (1 - pct);
        ctx.fillText(label, 4, y);
      }

      // ── 5. Gradient fill + curve stroke ────────────────────────────────────
      if (n >= 2) {
        const pts = current.map((att, i) => ({
          x: (i / (n - 1)) * w,
          y: h * (1 - att),
        }));

        // Gradient fill under curve
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,127,80,0.15)');
        grad.addColorStop(1, 'rgba(255,127,80,0)');
        ctx.beginPath();
        drawCatmullRomCurve(ctx, pts);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Curve stroke (2px coral)
        ctx.beginPath();
        drawCatmullRomCurve(ctx, pts);
        ctx.strokeStyle = '#FF7F50';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── 6. Dropoff markers ─────────────────────────────────────────────────
      drawMarkers(ctx, markersRef.current, morphProgress, reducedMotionRef.current);

      void timestamp; // suppress unused warning
    },
    [canvasRef],
  );

  // ---------------------------------------------------------------------------
  // Effect: set up RAF loop or single-shot draw for reduced-motion
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (reducedMotion) {
      // T-04-12: reduced-motion → single synchronous draw, no RAF loop
      // Draw immediately at morphProgress = 1 (final weighted state)
      drawFrame(0, 1);
      return; // no RAF scheduled
    }

    // Non-reduced-motion: single initial draw (morph loop handled in separate effect)
    drawFrame(0, 1);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    };
  }, [reducedMotion, drawFrame, canvasRef]);

  // ---------------------------------------------------------------------------
  // Effect: trigger morph when morphRequested changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!morphRequested || reducedMotion) return;

    isMorphingRef.current = true;
    morphStartTimeRef.current = 0;

    let startMorphTime = 0;

    function morphDraw(timestamp: number) {
      if (startMorphTime === 0) startMorphTime = timestamp;
      const elapsed = timestamp - startMorphTime;
      const raw = Math.min(elapsed / CURVE_MORPH_MS, 1);
      const morphProgress = easeOutCubic(raw);

      drawFrame(timestamp, morphProgress);

      if (raw < 1) {
        animRef.current = requestAnimationFrame(morphDraw);
      } else {
        isMorphingRef.current = false;
        animRef.current = 0;
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(morphDraw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    };
  }, [morphRequested, reducedMotion, drawFrame]);

  // ---------------------------------------------------------------------------
  // ResizeObserver — re-draw on container resize
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      if (!isMorphingRef.current) {
        drawFrame(0, 1);
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, drawFrame]);

  // ---------------------------------------------------------------------------
  // onTap handler
  // ---------------------------------------------------------------------------

  const onTap = useCallback(
    (e: PointerEvent): TapPopoverPayload | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check markers first
      const markerHit = findMarkerAtPoint(markersRef.current, x, y);
      if (markerHit) {
        if ('kind' in markerHit && markerHit.kind === 'cluster') {
          return { kind: 'cluster', markers: markerHit.markers };
        }
        const m = markerHit as import('./audience-types').AudienceMarker;
        return {
          kind: 'marker',
          personaId: m.personaId,
          t: x / rect.width * (segmentsRef.current?.[segmentsRef.current.length - 1]?.t_end ?? 30),
          attention: m.opacity,
        };
      }

      // Curve-point hit
      const segs = segmentsRef.current;
      const totalDuration = segs ? segs[segs.length - 1]?.t_end ?? 30 : 30;
      const t = (x / rect.width) * totalDuration;
      const weighted = weightedCurveRef.current;

      if (!weighted || weighted.length === 0) return null;

      // Find segment index for t
      let segIdx = weighted.length - 1;
      if (segs) {
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i]!;
          if (t >= seg.t_start && t < seg.t_end) {
            segIdx = i;
            break;
          }
        }
      } else {
        segIdx = Math.min(
          Math.floor((x / rect.width) * weighted.length),
          weighted.length - 1,
        );
      }

      const weightedAttention = weighted[segIdx] ?? 0;

      return {
        kind: 'curve-point',
        t,
        weightedAttention,
        contributingPersonas: [],
      };
    },
    [canvasRef],
  );

  return { onTap };
}
