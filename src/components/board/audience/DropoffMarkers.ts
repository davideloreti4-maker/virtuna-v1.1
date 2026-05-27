/**
 * DropoffMarkers.ts — Pure-function geometry module for audience retention curve markers.
 *
 * No React, no hooks, no DOM access beyond CanvasRenderingContext2D parameter.
 * All functions are deterministic and side-effect-free (canvas draw excepted).
 */
import type { HeatmapPayload } from '@/lib/engine/types';
import type { AudienceMarker, MarkerCluster, MarkerOrCluster } from './audience-types';
import {
  MARKER_CLUSTER_PX_LARGE,
  MARKER_CLUSTER_PX_SMALL,
  MARKER_HIT_RADIUS,
  MARKER_DOT_RADIUS,
  MARKER_RING_COLOR,
} from './audience-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cubic ease-out — smooth deceleration into final state. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Given a time value `t` (seconds), find the segment index that contains it.
 * Returns the last segment index if t > all segment end times.
 */
function segIdxContaining(
  t: number,
  segments: HeatmapPayload['segments'],
): number {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (t >= seg.t_start && t < seg.t_end) return i;
  }
  return Math.max(0, segments.length - 1);
}

// ---------------------------------------------------------------------------
// computeMarkerPositions
// ---------------------------------------------------------------------------

/**
 * For each persona with `swipe_predicted_at != null`, compute its canvas
 * pixel position on the retention curve.
 *
 * x = (t / totalDuration) * canvasWidth
 * y = canvasHeight * (1 - attentionAtT)   where attentionAtT ∈ [0, 1]
 */
export function computeMarkerPositions(
  personas: HeatmapPayload['personas'],
  segments: HeatmapPayload['segments'],
  canvasWidth: number,
  canvasHeight: number,
  totalDuration: number,
): AudienceMarker[] {
  const markers: AudienceMarker[] = [];

  for (const persona of personas) {
    if (persona.swipe_predicted_at == null) continue;

    const t = persona.swipe_predicted_at;
    const segIdx = segIdxContaining(t, segments);
    const rawAttention = persona.attentions[segIdx] ?? 0;
    const attention = clamp(rawAttention, 0, 1);

    // Coerce NaN → 0 (T-04-13 guard)
    const x = isNaN(t) ? 0 : (t / totalDuration) * canvasWidth;
    const y = canvasHeight * (1 - attention);

    // Derive slot_type from persona if available (fixture includes slot_type)
    const slotType =
      (persona as { slot_type?: string }).slot_type === 'niche' ||
      (persona as { slot_type?: string }).slot_type === 'loyalist' ||
      (persona as { slot_type?: string }).slot_type === 'cross_niche'
        ? ((persona as { slot_type: string }).slot_type as 'niche' | 'loyalist' | 'cross_niche')
        : 'fyp';

    markers.push({
      personaId: persona.id,
      slotType,
      archetype: (persona as { archetype?: string }).archetype ?? 'unknown',
      x,
      y,
      opacity: 0, // controlled by RAF
    });
  }

  return markers;
}

// ---------------------------------------------------------------------------
// clusterMarkers
// ---------------------------------------------------------------------------

/**
 * Single-pass sweep. Sort by x. Merge adjacent markers into clusters per D-12:
 *   - ≥3 within thresholdLarge (12px) → cluster
 *   - ≥2 within thresholdSmall (6px)  → cluster
 * Otherwise emit as standalone AudienceMarker.
 */
export function clusterMarkers(
  markers: AudienceMarker[],
  thresholdLarge = MARKER_CLUSTER_PX_LARGE,
  thresholdSmall = MARKER_CLUSTER_PX_SMALL,
): MarkerOrCluster[] {
  if (markers.length === 0) return [];

  // Sort a copy by x ascending
  const sorted = [...markers].sort((a, b) => a.x - b.x);
  const result: MarkerOrCluster[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (consumed.has(i)) continue;

    const anchor = sorted[i]!;
    const group: AudienceMarker[] = [anchor];

    // Collect all markers within 12px of anchor (forward only, sorted)
    for (let j = i + 1; j < sorted.length; j++) {
      if (consumed.has(j)) continue;
      const candidate = sorted[j]!;
      const dist = Math.abs(candidate.x - anchor.x);
      if (dist <= thresholdLarge) {
        group.push(candidate);
      }
    }

    // Check if group qualifies as cluster
    const largeCluster = group.length >= 3;

    // For small threshold: 2+ within thresholdSmall
    const smallGroup = group.filter(
      (m) => Math.abs(m.x - anchor.x) <= thresholdSmall,
    );
    const smallCluster = smallGroup.length >= 2;

    if (largeCluster || smallCluster) {
      const activeGroup = largeCluster ? group : smallGroup;
      const cx = activeGroup.reduce((s, m) => s + m.x, 0) / activeGroup.length;
      const cy = activeGroup.reduce((s, m) => s + m.y, 0) / activeGroup.length;

      // Mark all in active group as consumed
      for (let j = i + 1; j < sorted.length; j++) {
        if (activeGroup.includes(sorted[j]!)) consumed.add(j);
      }

      result.push({
        kind: 'cluster',
        x: cx,
        y: cy,
        count: activeGroup.length,
        markers: activeGroup,
      } satisfies MarkerCluster);
    } else {
      result.push(anchor);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// findMarkerAtPoint
// ---------------------------------------------------------------------------

/**
 * Linear scan. Returns first marker/cluster within hitRadius of (x, y).
 * Clusters checked first (they have a larger effective touch area).
 */
export function findMarkerAtPoint(
  markers: MarkerOrCluster[],
  x: number,
  y: number,
  hitRadius = MARKER_HIT_RADIUS,
): MarkerOrCluster | null {
  const r2 = hitRadius * hitRadius;

  // Check clusters first
  for (const m of markers) {
    if ('kind' in m && m.kind === 'cluster') {
      const dx = m.x - x;
      const dy = m.y - y;
      if (dx * dx + dy * dy < r2) return m;
    }
  }

  // Then standalone markers
  for (const m of markers) {
    if (!('kind' in m)) {
      const dx = m.x - x;
      const dy = m.y - y;
      if (dx * dx + dy * dy < r2) return m;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// drawMarkers
// ---------------------------------------------------------------------------

/**
 * Render all markers onto the canvas context.
 *
 * For each MarkerOrCluster:
 *   - Arc dot at (x, y) radius MARKER_DOT_RADIUS, fill #FF7F50
 *   - Arc ring stroke at MARKER_DOT_RADIUS + 2, color from MARKER_RING_COLOR[slotType]
 *   - Clusters: additionally draw superscript count at (x+6, y-6)
 *
 * Opacity = reducedMotion ? 1 : clamp(easeOutCubic(morphProgress * 1.2), 0, 1)
 */
export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: MarkerOrCluster[],
  morphProgress: number,
  reducedMotion: boolean,
): void {
  const opacity = reducedMotion
    ? 1
    : clamp(easeOutCubic(morphProgress * 1.2), 0, 1);

  ctx.save();
  ctx.globalAlpha = opacity;

  for (const m of markers) {
    if ('kind' in m && m.kind === 'cluster') {
      // Draw cluster dot (slightly larger — 10px diameter per UI-SPEC)
      const clusterRadius = MARKER_DOT_RADIUS + 1; // → 5px radius = 10px diameter
      ctx.beginPath();
      ctx.arc(m.x, m.y, clusterRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#FF7F50';
      ctx.fill();

      // Draw ring
      ctx.beginPath();
      ctx.arc(m.x, m.y, clusterRadius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Superscript count
      ctx.font = '8px monospace';
      ctx.fillStyle = '#FF7F50';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(m.count), m.x + 6, m.y - 6);
    } else {
      // Standalone AudienceMarker
      const marker = m as AudienceMarker;
      const ringColor = MARKER_RING_COLOR[marker.slotType] ?? '#FF7F50';

      // Dot
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, MARKER_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#FF7F50';
      ctx.fill();

      // Ring
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, MARKER_DOT_RADIUS + 2, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}
