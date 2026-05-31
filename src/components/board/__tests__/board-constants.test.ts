import { describe, it, expect } from 'vitest';
import {
  GROUP_FRAMES,
  BOARD_BOUNDS,
  CAMERA_PRESET_TARGETS,
  AUTO_HEIGHT_FRAMES,
  resolveBoardLayout,
  computeBoardBounds,
  computePresetTargets,
} from '../board-constants';
import type { GroupFrameLayout, GroupId, Rect } from '../board-types';

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
  // Input + Engine share the left column (Input = engagement scorecard, Engine
  // = state line → findings). Both are auto-height (redesign 2026-05-30); the
  // static constants keep the standard 32px gutter between them.
  it('input → engine vertical gap is the 32px gutter', () => {
    const a = rectFor('input');
    const b = rectFor('engine');
    expect(b.y - bottom(a)).toBe(MIN_GAP);
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

  // Phase 3: content-analysis moved up-left into the lower-left+center void, so
  // it now sits BESIDE the (grown) Actions column rather than stacked beneath it.
  // The vertical gutter became a horizontal one.
  it('content-analysis → actions horizontal gap is ≥ 32px', () => {
    const a = rectFor('content-analysis');
    const b = rectFor('actions');
    expect(b.x - right(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('content-analysis and actions share the board bottom (right column matches left block)', () => {
    expect(bottom(rectFor('content-analysis'))).toBe(bottom(rectFor('actions')));
  });

  it('engine → content-analysis vertical gap is ≥ 32px', () => {
    const a = rectFor('engine');
    const b = rectFor('content-analysis');
    expect(b.y - bottom(a)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  // Redesign 2026-05-30: Engine no longer stretches to fill the left column —
  // it is content-sized (collapsed line / expandable findings). The left column
  // is therefore shorter than the Audience centerpiece, which now governs where
  // Content Analysis clears (audience bottom, not the left column).
  it('left column (input + engine) is shorter than the audience centerpiece', () => {
    expect(bottom(rectFor('engine'))).toBeLessThan(bottom(rectFor('audience')));
  });
});

describe('BOARD_BOUNDS derived from re-spaced GROUP_FRAMES', () => {
  it('encloses all frames', () => {
    for (const f of GROUP_FRAMES) {
      expect(containsRect(BOARD_BOUNDS, f.bounds)).toBe(true);
    }
  });

  it('matches expected dimensions {0,0,1224,1072}', () => {
    expect(BOARD_BOUNDS).toEqual({ x: 0, y: 0, width: 1224, height: 1072 });
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

describe('resolveBoardLayout (auto-height reflow)', () => {
  function boundsOf(frames: GroupFrameLayout[], id: GroupId): Rect {
    const f = frames.find((g) => g.id === id);
    if (!f) throw new Error(`frame ${id} not found`);
    return f.bounds;
  }

  it('with no measurements, reproduces GROUP_FRAMES exactly', () => {
    const resolved = resolveBoardLayout({});
    expect(resolved).toEqual(GROUP_FRAMES);
  });

  it('growing Audience pushes Content Analysis down by the same delta (gutter preserved)', () => {
    const grown = rectFor('audience').height + 200;
    const resolved = resolveBoardLayout({ audience: grown });
    const ca = boundsOf(resolved, 'content-analysis');
    // CA clears the (now taller) audience by exactly the 32px gutter.
    expect(ca.y - bottom(boundsOf(resolved, 'audience'))).toBe(MIN_GAP);
    expect(boundsOf(resolved, 'audience').height).toBe(grown);
  });

  it('growing Verdict pushes Actions down (right column reflows)', () => {
    const grown = rectFor('verdict').height + 120;
    const resolved = resolveBoardLayout({ verdict: grown });
    const actions = boundsOf(resolved, 'actions');
    expect(actions.y - bottom(boundsOf(resolved, 'verdict'))).toBe(MIN_GAP);
  });

  it('honours measured heights for input and engine (now auto-height)', () => {
    const resolved = resolveBoardLayout({ input: 360, engine: 300 });
    expect(boundsOf(resolved, 'input').height).toBe(360);
    expect(boundsOf(resolved, 'engine').height).toBe(300);
    // Engine reflows below the (grown) Input, gutter preserved.
    expect(boundsOf(resolved, 'engine').y - bottom(boundsOf(resolved, 'input'))).toBe(MIN_GAP);
    expect(AUTO_HEIGHT_FRAMES.has('input')).toBe(true);
    expect(AUTO_HEIGHT_FRAMES.has('engine')).toBe(true);
  });

  it('a shorter measured height than the constant is honoured (frame shrinks)', () => {
    const shorter = rectFor('actions').height - 200;
    const resolved = resolveBoardLayout({ actions: shorter });
    expect(boundsOf(resolved, 'actions').height).toBe(shorter);
  });
});

describe('computeBoardBounds + computePresetTargets track growth', () => {
  it('board bounds grow when the tallest column grows', () => {
    const grown = rectFor('actions').height + 300;
    const resolved = resolveBoardLayout({ actions: grown });
    const bounds = computeBoardBounds(resolved);
    expect(bounds.height).toBeGreaterThan(BOARD_BOUNDS.height);
  });

  it('overview preset equals the resolved board bounds', () => {
    const resolved = resolveBoardLayout({ audience: 1000 });
    const targets = computePresetTargets(resolved);
    expect(targets.overview).toEqual(computeBoardBounds(resolved));
  });

  it('verdict preset still encloses the grown audience + verdict', () => {
    const resolved = resolveBoardLayout({ audience: 1100, verdict: 360 });
    const targets = computePresetTargets(resolved);
    const aud = resolved.find((f) => f.id === 'audience')!.bounds;
    const ver = resolved.find((f) => f.id === 'verdict')!.bounds;
    expect(containsRect(targets.verdict!, aud)).toBe(true);
    expect(containsRect(targets.verdict!, ver)).toBe(true);
  });
});
