'use client';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapPayload } from '@/lib/engine/types';
import {
  type BiggestDrop,
  formatTime,
  normalizeCurve,
  nicheGhostCurve,
  smoothPath,
} from './audience-derive';
import { VB_W, VB_H, PAD_TOP, FLOOR_Y, yForValue, xForIndex } from './retention-geometry';
import { EMPTY_FRAME_BG } from '@/components/board/_kit/keyframe';

export interface RetentionChartProps {
  /** Survival curve, raw (0-1 or 0-100) — normalized internally. */
  curve: number[] | null;
  /** Heatmap (segments + personas) for time-mapping + niche ghost + filmstrip. */
  heatmap: HeatmapPayload | null;
  /** Biggest-drop descriptor (index into the curve / segments). Null = no drop. */
  drop: BiggestDrop | null;
  /** Total video duration in seconds (for x-axis mapping). */
  totalDurationSec: number;
  /** Merged keyframe URLs: segment_idx → signed URL. */
  filmstrips: Record<number, string>;
  /** Fallback flat niche completion (0-1) when no niche-slot personas exist. */
  nicheCompletionPct: number | null;
  /** Loading → render skeletons. */
  isLoading: boolean;
}

/**
 * BLOCK B — the time-locked chart unit:
 *  - SVG survival curve (smooth), dashed niche ghost line, coral drop dot,
 *    vertical coral lock line, floor line, "−NN%" drop label, "niche" tag.
 *  - darkened keyframe filmstrip directly beneath (time-aligned by segment width).
 *  - time axis (0:00 · drop time in coral · total).
 *
 * Matches audience-sketch-v7 `.unit` / `.chart` / `.kfrow` / `.axis`.
 */
export function RetentionChart({
  curve,
  heatmap,
  drop,
  totalDurationSec,
  filmstrips,
  nicheCompletionPct,
  isLoading,
}: RetentionChartProps) {
  const segments = useMemo(() => heatmap?.segments ?? [], [heatmap?.segments]);

  const normalized = useMemo(() => (curve ? normalizeCurve(curve) : []), [curve]);
  const pointCount = normalized.length;
  const total = totalDurationSec > 0 ? totalDurationSec : 1;

  const { survivalPath, areaPath } = useMemo(() => {
    if (normalized.length === 0) return { survivalPath: '', areaPath: '' };
    const pts = normalized.map((v, i) => ({ x: xForIndex(segments, i, pointCount, total), y: yForValue(v) }));
    const line = smoothPath(pts);
    // Close the line down to the floor and back to fill the survival area below
    // it (TikTok watch-time style gradient fill).
    const x0 = pts[0]!.x;
    const xN = pts[pts.length - 1]!.x;
    return { survivalPath: line, areaPath: `${line} L${xN},${FLOOR_Y} L${x0},${FLOOR_Y} Z` };
  }, [normalized, segments, pointCount, total]);

  // Niche ghost line: mean of niche personas, else flat line at nicheCompletionPct.
  const ghostPath = useMemo(() => {
    const ghost = nicheGhostCurve(heatmap);
    if (ghost && ghost.length > 0) {
      const pts = ghost.map((v, i) => ({ x: xForIndex(segments, i, pointCount, total), y: yForValue(v) }));
      return smoothPath(pts);
    }
    if (nicheCompletionPct != null && pointCount > 0) {
      const y = yForValue(Math.min(1, Math.max(0, nicheCompletionPct)));
      return `M0,${y} L${VB_W},${y}`;
    }
    return '';
  }, [heatmap, nicheCompletionPct, pointCount, segments, total]);

  // Drop geometry (dot + lock line + label position).
  const dropGeo = useMemo(() => {
    if (!drop || normalized.length === 0) return null;
    const seg = segments[drop.index];
    const dropTime = seg?.t_start ?? 0;
    const xPct = total > 0 ? dropTime / total : 0;
    const x = xPct * VB_W;
    const v = normalized[drop.index] ?? 0;
    const y = yForValue(v);
    return { x, y, xPct, dropTime, deltaPct: Math.round(drop.delta * 100) };
  }, [drop, normalized, segments, total]);

  // Filmstrip cells (max ~8 to stay legible at frame width; mirror sketch's 5-up feel).
  const cells = useMemo(() => {
    if (segments.length === 0) return [];
    const dropTime = dropGeo?.dropTime ?? null;
    return segments.map((seg, i) => {
      // Key the filmstrip map by POSITION (seg.idx is often absent on permalink
      // heatmaps; the streamed/permalink filmstrips are keyed 0,1,2…). Mirrors
      // ContentAnalysisFrame so both strips resolve the same frames. Without this
      // the cells fell through to a null keyframe_uri and rendered blank.
      const segIdx = seg.idx ?? i;
      const url = filmstrips[segIdx] ?? seg.keyframe_uri ?? null;
      const isDrop =
        dropTime != null && dropTime >= seg.t_start && dropTime < seg.t_end;
      const widthPct = total > 0 ? ((seg.t_end - seg.t_start) / total) * 100 : 100 / segments.length;
      return { idx: segIdx, url, isDrop, widthPct };
    });
  }, [segments, filmstrips, dropGeo, total]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[9px]" data-testid="retention-chart">
        <Skeleton className="h-[138px] w-full rounded-[8px]" />
        <Skeleton className="h-[44px] w-full rounded-[6px]" />
      </div>
    );
  }

  return (
    <div data-testid="retention-chart">
      {/* chart */}
      <div className="relative" style={{ height: VB_H }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="block h-full w-full"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label={`Audience retention curve over ${formatTime(totalDurationSec)}`}
        >
          <defs>
            <linearGradient id="retentionFill" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_TOP} x2="0" y2={FLOOR_Y}>
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {/* y guides — 100% (hook baseline) + 50%, dashed; floor = 0% */}
          <line x1="0" y1={PAD_TOP} x2={VB_W} y2={PAD_TOP} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="0" y1={yForValue(0.5)} x2={VB_W} y2={yForValue(0.5)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="0" y1={FLOOR_Y} x2={VB_W} y2={FLOOR_Y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {/* survival area fill beneath the curve */}
          {areaPath && <path d={areaPath} fill="url(#retentionFill)" stroke="none" />}
          {/* niche comparison (dashed ghost) */}
          {ghostPath && (
            <path
              d={ghostPath}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1.5"
              strokeDasharray="3 4"
            />
          )}
          {/* vertical lock line at the drop */}
          {dropGeo && (
            <line
              x1={dropGeo.x}
              y1={PAD_TOP}
              x2={dropGeo.x}
              y2={FLOOR_Y}
              stroke="rgba(255,127,80,0.22)"
              strokeWidth="1"
            />
          )}
          {/* survival curve (neutral white) */}
          {survivalPath && (
            <path
              d={survivalPath}
              fill="none"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
          {/* single coral mark at the drop */}
          {dropGeo && <circle cx={dropGeo.x} cy={dropGeo.y} r="3.5" fill="var(--color-accent)" />}
        </svg>

        {/* drop delta label (coral), positioned above the dot */}
        {dropGeo && dropGeo.deltaPct > 0 && (
          <div
            className="absolute tabular-nums"
            style={{
              fontSize: 11,
              color: 'var(--color-accent)',
              fontWeight: 600,
              left: `${dropGeo.xPct * 100}%`,
              transform: 'translateX(-50%)',
              top: '20%',
            }}
          >
            −{dropGeo.deltaPct}%
          </div>
        )}

        {/* niche tag */}
        {ghostPath && (
          <div
            className="absolute"
            style={{ right: 0, top: '64%', fontSize: 11, color: 'rgba(255,255,255,0.34)', fontWeight: 500 }}
          >
            niche
          </div>
        )}

        {/* y-axis labels aligned to the 100% / 50% guides (TikTok-style) */}
        <div
          className="pointer-events-none absolute right-0 tabular-nums"
          style={{ top: `${(PAD_TOP / VB_H) * 100}%`, transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.34)', fontWeight: 500 }}
        >
          100%
        </div>
        <div
          className="pointer-events-none absolute right-0 tabular-nums"
          style={{ top: `${(yForValue(0.5) / VB_H) * 100}%`, transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.34)', fontWeight: 500 }}
        >
          50%
        </div>
      </div>

      {/* filmstrip — darkened keyframes, time-aligned; drop cell gets coral outline.
          Only render when at least one cell resolved a real keyframe; otherwise the
          row degraded to empty grey boxes (heatmap segments exist even with no
          footage). Mirrors AudienceNode's hasVideo gate for the drop strip. */}
      {cells.some((c) => c.url != null) && (
        <div className="mt-[9px] flex gap-[5px]" aria-label="Video keyframe filmstrip">
          {cells.map((cell) => (
            <div
              key={cell.idx}
              role="img"
              aria-label={`Segment ${cell.idx}${cell.isDrop ? ' (drop)' : ''}`}
              className="rounded-[6px] border bg-cover bg-center"
              style={{
                width: `${cell.widthPct}%`,
                aspectRatio: '16 / 9',
                backgroundImage: cell.url ? `url('${cell.url}')` : undefined,
                backgroundColor: cell.url ? undefined : EMPTY_FRAME_BG,
                borderColor: cell.isDrop ? 'rgba(255,127,80,0.55)' : 'rgba(255,255,255,0.06)',
                filter: cell.isDrop
                  ? 'brightness(.78) saturate(.8) contrast(1.04)'
                  : 'brightness(.5) saturate(.7) contrast(1.04)',
                boxShadow: cell.isDrop ? 'rgba(255,127,80,0.14) 0 0 0 1px' : undefined,
                transition: 'filter .2s',
              }}
            />
          ))}
        </div>
      )}

      {/* time axis */}
      <div
        className="relative tabular-nums"
        style={{ height: 16, marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.34)' }}
        aria-hidden="true"
      >
        <span className="absolute left-0">0:00</span>
        {dropGeo && (
          <span
            className="absolute"
            style={{
              left: `${dropGeo.xPct * 100}%`,
              transform: 'translateX(-50%)',
              color: 'var(--color-accent)',
              fontWeight: 600,
            }}
          >
            {formatTime(dropGeo.dropTime)}
          </span>
        )}
        <span className="absolute right-0">{formatTime(totalDurationSec)}</span>
      </div>
    </div>
  );
}
