import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

import {
  computeMarkerPositions,
  clusterMarkers,
  findMarkerAtPoint,
  drawMarkers,
} from '../DropoffMarkers';

import type { AudienceMarker } from '../audience-types';
import { MARKER_DOT_RADIUS } from '../audience-constants';

// ---- helpers ----------------------------------------------------------------

function makeMarker(x: number, y = 50, overrides: Partial<AudienceMarker> = {}): AudienceMarker {
  return {
    personaId: overrides.personaId ?? `p_${x}`,
    slotType: overrides.slotType ?? 'fyp',
    archetype: overrides.archetype ?? 'high_engager',
    x,
    y,
    opacity: 1,
    ...overrides,
  };
}

// ---- clusterMarkers ---------------------------------------------------------

describe('clusterMarkers', () => {
  it('clusters 3+ markers within 12px into a single cluster', () => {
    // markers at x=10, 15, 20 — all within 12px window of each other
    const markers = [makeMarker(10), makeMarker(15), makeMarker(20)];
    const result = clusterMarkers(markers);
    expect(result).toHaveLength(1);
    const cluster = result[0];
    expect('kind' in cluster && cluster.kind).toBe('cluster');
    if ('kind' in cluster && cluster.kind === 'cluster') {
      expect(cluster.count).toBe(3);
    }
  });

  it('clusters 2 markers within 6px into a single cluster', () => {
    // markers at x=10, x=14 — within 6px
    const markers = [makeMarker(10), makeMarker(14)];
    const result = clusterMarkers(markers);
    expect(result).toHaveLength(1);
    const cluster = result[0];
    expect('kind' in cluster && cluster.kind).toBe('cluster');
    if ('kind' in cluster && cluster.kind === 'cluster') {
      expect(cluster.count).toBe(2);
    }
  });

  it('keeps 2 markers more than 6px apart as standalone markers (no cluster)', () => {
    // markers at x=10, x=20 — 10px apart, not within 6px small threshold, only 2 markers so not large-cluster either
    const markers = [makeMarker(10), makeMarker(20)];
    const result = clusterMarkers(markers);
    expect(result).toHaveLength(2);
    // Neither should be a cluster
    for (const m of result) {
      expect('kind' in m ? m.kind : 'marker').not.toBe('cluster');
    }
  });
});

// ---- findMarkerAtPoint -------------------------------------------------------

describe('findMarkerAtPoint', () => {
  it('hits a marker within 22px radius', () => {
    // marker at (50, 50), query at (60, 55) → distance ≈ 11.18px — within 22px
    const markers = [makeMarker(50, 50, { personaId: 'target' })];
    const hit = findMarkerAtPoint(markers, 60, 55);
    expect(hit).not.toBeNull();
    if (hit && !('kind' in hit)) {
      expect(hit.personaId).toBe('target');
    }
  });

  it('misses a marker outside 22px radius', () => {
    // marker at (50, 50), query at (80, 50) → distance = 30px — outside 22px
    const markers = [makeMarker(50, 50)];
    const hit = findMarkerAtPoint(markers, 80, 50);
    expect(hit).toBeNull();
  });
});

// ---- computeMarkerPositions -------------------------------------------------

describe('computeMarkerPositions', () => {
  it('skips personas with swipe_predicted_at === null', () => {
    const fixture = buildHeatmapFixture();
    // 10 personas, all have swipe_predicted_at: null in fixture
    const result = computeMarkerPositions(
      fixture.personas,
      fixture.segments,
      400,
      180,
      30,
    );
    // All personas have null swipe_predicted_at → 0 markers
    expect(result).toHaveLength(0);
  });

  it('returns markers only for personas with swipe_predicted_at set', () => {
    const fixture = buildHeatmapFixture();
    const personas = fixture.personas.map((p, i) =>
      i < 2 ? { ...p, swipe_predicted_at: 5 } : p,
    );
    const result = computeMarkerPositions(personas, fixture.segments, 400, 180, 30);
    expect(result).toHaveLength(2);
  });

  it('scales marker x by t/totalDuration * canvasWidth', () => {
    const fixture = buildHeatmapFixture();
    // Set persona 0 swipe_predicted_at = 5, totalDuration = 10, canvasWidth = 200
    const personas = [{ ...fixture.personas[0]!, swipe_predicted_at: 5 }];
    const result = computeMarkerPositions(personas, fixture.segments, 200, 180, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.x).toBeCloseTo(100, 0);
  });
});

// ---- drawMarkers ------------------------------------------------------------

describe('drawMarkers', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;
  });

  it('calls ctx.arc with MARKER_DOT_RADIUS and sets fillStyle to #FF7F50', () => {
    const markers = [makeMarker(50, 50)];
    drawMarkers(ctx, markers, 1, false);
    expect(ctx.arc).toHaveBeenCalledWith(
      50, 50, MARKER_DOT_RADIUS, 0, Math.PI * 2,
    );
    expect(ctx.fillStyle).toBe('#FF7F50');
  });

  it('sets globalAlpha to 1 when reducedMotion=true and morphProgress=0', () => {
    const markers = [makeMarker(50, 50)];
    drawMarkers(ctx, markers, 0, true);
    // After the call, globalAlpha should have been set to 1 (reducedMotion path)
    expect(ctx.globalAlpha).toBe(1);
  });
});
