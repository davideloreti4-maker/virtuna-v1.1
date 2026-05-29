import { describe, it, expect } from 'vitest';
import {
  GROUP_FRAMES,
  BOARD_BOUNDS,
  CAMERA_PRESET_TARGETS,
} from '../board-constants';
import type { GroupId, Rect } from '../board-types';

function rectFor(id: GroupId): Rect {
  const f = GROUP_FRAMES.find((g) => g.id === id);
  if (!f) throw new Error(`frame ${id} not found`);
  return f.bounds;
}

function right(r: Rect) { return r.x + r.width; }
function bottom(r: Rect) { return r.y + r.height; }

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    right(outer) >= right(inner) &&
    bottom(outer) >= bottom(inner)
  );
}

const MIN_GAP = 32;

describe('GROUP_FRAMES world-space gaps (UAT gap 1 regression — 2026-05-26)', () => {
  // Input + Engine are intentionally paired in a single left column (Input
  // hosts the TikTok-style result card, Engine is a compact pipeline footer).
  // The 32px inter-group gutter doesn't apply to this pair; we just enforce
  // they don't overlap.
  it('input → engine vertical gap is non-overlapping', () => {
    const a = rectFor('input');
    const b = rectFor('engine');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(0);
  });

  it('input → audience horizontal gap is ≥ 32px', () => {
    const a = rectFor('input');
    const b = rectFor('audience');
    expect(b.x - right(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('engine → audience horizontal gap is ≥ 32px', () => {
    const a = rectFor('engine');
    const b = rectFor('audience');
    expect(b.x - right(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('audience → verdict horizontal gap is ≥ 32px', () => {
    const a = rectFor('audience');
    const b = rectFor('verdict');
    expect(b.x - right(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('verdict → actions vertical gap is ≥ 32px', () => {
    const a = rectFor('verdict');
    const b = rectFor('actions');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('audience → content-analysis vertical gap is ≥ 32px', () => {
    const a = rectFor('audience');
    const b = rectFor('content-analysis');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('actions → content-analysis vertical gap is ≥ 32px', () => {
    const a = rectFor('actions');
    const b = rectFor('content-analysis');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('engine → content-analysis vertical gap is ≥ 32px', () => {
    const a = rectFor('engine');
    const b = rectFor('content-analysis');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });
});

describe('BOARD_BOUNDS derived from re-spaced GROUP_FRAMES', () => {
  it('encloses all frames', () => {
    for (const f of GROUP_FRAMES) {
      expect(containsRect(BOARD_BOUNDS, f.bounds)).toBe(true);
    }
  });

  it('matches expected dimensions {0,0,1224,1104}', () => {
    expect(BOARD_BOUNDS).toEqual({ x: 0, y: 0, width: 1224, height: 1104 });
  });
});

describe('CAMERA_PRESET_TARGETS still resolve correctly', () => {
  it('overview = BOARD_BOUNDS', () => {
    expect(CAMERA_PRESET_TARGETS.overview).toEqual(BOARD_BOUNDS);
  });

  it('engine preset contains both input and engine frames (D-09)', () => {
    const preset = CAMERA_PRESET_TARGETS.engine!;
    expect(containsRect(preset, rectFor('input'))).toBe(true);
    expect(containsRect(preset, rectFor('engine'))).toBe(true);
  });

  it('verdict preset (D-07 Audience+Verdict union) contains both audience and verdict', () => {
    const preset = CAMERA_PRESET_TARGETS.verdict!;
    expect(containsRect(preset, rectFor('audience'))).toBe(true);
    expect(containsRect(preset, rectFor('verdict'))).toBe(true);
  });

  it('audience preset = audience frame bounds', () => {
    expect(CAMERA_PRESET_TARGETS.audience).toEqual(rectFor('audience'));
  });

  it('content-analysis preset = content-analysis frame bounds', () => {
    expect(CAMERA_PRESET_TARGETS['content-analysis']).toEqual(rectFor('content-analysis'));
  });
});
