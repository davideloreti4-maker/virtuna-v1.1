import type { GroupFrameLayout, GroupId, Rect } from './board-types';

export const FRAME_PADDING = 16;
export const GUTTER = 32;
export const TITLE_BAR_HEIGHT = 36;
export const FRAME_CORNER_RADIUS = 12;
export const CAMERA_MIN_SCALE = 0.2;
export const CAMERA_MAX_SCALE = 4;
export const CAMERA_DEFAULT_SCALE = 1;

/**
 * D-06 spatial layout — deterministic, identical phone and desktop.
 * Layout reads left→right, top→bottom:
 *   Input (top-left, compact) + Engine (under Input, compact)
 *   Audience (large central centerpiece)
 *   Verdict (large hero, right column) + Actions (tall, fills right column)
 *   Content Analysis (lower-left+center block, under Input/Engine+Audience)
 *
 * Phase 3 re-space: Content Analysis moved UP from a full-width footer (y904)
 * into the lower-left+center void (x0..832, under the short Input/Engine column
 * and Audience), and Actions grown so the right column reaches the same bottom
 * (1072) — killing the ~328px lower-left dead space without a far-bottom strip.
 *
 * World-space gaps: 32px between every adjacent frame edge.
 */
export const GROUP_FRAMES: GroupFrameLayout[] = [
  // Input + Engine are auto-height (redesign 2026-05-30): the Input engagement
  // scorecard and the Engine state line size to their content. These constants
  // are the default-state floors (input = confident scorecard, engine = the
  // running/collapsed line); the frames grow past them on demand (Engine
  // findings expand). engine.y MUST equal input.height + GUTTER so
  // resolveBoardLayout({}) reproduces this array exactly.
  { id: 'input',            label: 'Input',            bounds: { x:    0, y:    0, width:  240, height: 312 } },
  { id: 'engine',           label: 'Engine',           bounds: { x:    0, y:  344, width:  240, height: 128 } },
  { id: 'audience',         label: 'Audience',         bounds: { x:  272, y:    0, width:  560, height: 800 } },
  { id: 'verdict',          label: 'Score',            bounds: { x:  864, y:    0, width:  360, height: 280 } },
  // Actions: tall hero column holding the inline reshoot script, "What to fix",
  // and "When to post" (all inline, no drawers). Grown to bottom 1072 so the
  // right column matches the Content Analysis block on the left (Phase 3).
  { id: 'actions',          label: 'Actions',          bounds: { x:  864, y:  312, width:  360, height: 760 } },
  // Lower-left+center block: top clears Audience (800) by the 32px gutter; right
  // edge (832) aligns with Audience; left edge fills under the short Input/Engine
  // column. Right edge clears the Actions column (x864) by 32px.
  { id: 'content-analysis', label: 'Content craft', bounds: { x:    0, y:  832, width:  832, height: 240 } },
  // D-08 hero: insight-hero sits below content-analysis (bottom 1072) + 32px gutter.
  // Same left+center span (x0..832) mirrors content-analysis. Auto-height so the
  // rich surface (rewrites + dimensions + band) sizes to content.
  { id: 'insight-hero',     label: 'Insight',       bounds: { x:    0, y: 1104, width:  832, height: 480 } },
];

export const BOARD_BOUNDS: Rect = (() => {
  const right = Math.max(...GROUP_FRAMES.map((f) => f.bounds.x + f.bounds.width));
  const bottom = Math.max(...GROUP_FRAMES.map((f) => f.bounds.y + f.bounds.height));
  return { x: 0, y: 0, width: right, height: bottom };
})();

/** Input node sits inside the Input frame body and holds the vertical
 *  TikTok-style result card (video + predicted engagement metrics overlaid).
 *  Frame is 240×440; node fills body minus 16px padding on each side.
 *  Result: 208×376 — close to a 9:16 aspect (208 × 16/9 ≈ 370). */
export const INPUT_NODE_BOUNDS = {
  x: 16,                          // FRAME_PADDING from group frame x=0
  y: 16 + TITLE_BAR_HEIGHT,       // below title bar, +FRAME_PADDING
  width: 208,                     // 240 - 2*16
  height: 376,                    // 440 - 32 (title) - 2*16
} as const;

export const CAMERA_PRESET_TARGETS: Record<string, Rect> = {
  overview: BOARD_BOUNDS,
  // D-09: Wave 0/1 auto-pan target = Input + Engine column (Engine + Hook decomp area).
  // Internal-only preset — not user-facing in CameraOverlay. Height tracks the
  // grown Engine frame (bottom 800) so the preset still frames the full column.
  engine: { x: 0, y: 0, width: 240, height: 800 },
  // hero pair = Audience + Verdict union (D-07). Height tracks the taller
  // Audience frame so the preset still frames both.
  verdict: { x: 272, y: 0, width: 952, height: 800 },
  audience: GROUP_FRAMES.find((f) => f.id === 'audience')!.bounds,
  'content-analysis': GROUP_FRAMES.find((f) => f.id === 'content-analysis')!.bounds,
};

// ── Dynamic auto-height layout ───────────────────────────────────────────────
// Frames whose height tracks their measured content instead of a fixed constant.
// Every frame is now content-sized: Input (engagement scorecard) and Engine
// (state line → findings) join the data-heavy frames so nothing scrolls inside
// a frame and the Engine can collapse to one line / expand for findings.
// Includes 'decode' and 'adapt' — the remix-mode counterparts of verdict/actions.
export const AUTO_HEIGHT_FRAMES: ReadonlySet<GroupId> = new Set<GroupId>([
  'input',
  'engine',
  'audience',
  'verdict',
  'actions',
  'content-analysis',
  'decode',
  'adapt',
  'insight-hero',  // D-08: sizes to its rich content (rewrites + dimensions + band)
]);

/**
 * Resolve the live board layout from measured content heights (world units).
 *
 * x positions and widths stay fixed (the column composition); heights become the
 * measured natural content height for AUTO_HEIGHT_FRAMES, falling back to the
 * GROUP_FRAMES constant before first measure. Frames reflow vertically per
 * column so a growing frame pushes its neighbours down instead of
 * clipping/scrolling. When every measured height equals its constant this
 * reproduces GROUP_FRAMES exactly.
 *
 * `mode` selects the frame set returned (D-08 single source of truth):
 *   - 'score' (default): verdict + actions — the score board config.
 *   - 'remix': decode + adapt at the exact same bounds (1:1 positional swap D-07).
 *     All other frames (input, engine, audience, content-analysis) are identical.
 *
 * Callers that do not pass `mode` receive the score config unchanged (D-03 zero regression).
 *
 * Columns:
 *   Left   (x=0):   input → engine
 *   Center (x=272): audience
 *   Right  (x=864): verdict/decode → actions/adapt
 *   Bottom (x=0):   content-analysis, under the taller of (left col, center col)
 *                   insight-hero, below content-analysis (D-08 hero)
 */
export function resolveBoardLayout(
  measured: Partial<Record<GroupId, number>>,
  mode: 'score' | 'remix' = 'score',
): GroupFrameLayout[] {
  const base = Object.fromEntries(
    GROUP_FRAMES.map((f) => [f.id, f]),
  ) as Record<GroupId, GroupFrameLayout>;

  const h = (id: GroupId): number => {
    const m = measured[id];
    return AUTO_HEIGHT_FRAMES.has(id) && m != null && m > 0
      ? m
      : base[id]?.bounds.height ?? 0;
  };
  const x = (id: GroupId) => base[id]?.bounds.x ?? 0;
  const w = (id: GroupId) => base[id]?.bounds.width ?? 0;

  // Left column
  const inputH = h('input');
  const engineY = inputH + GUTTER;
  const engineH = h('engine');
  // Center column
  const audienceH = h('audience');
  // Right column. Bounds (x/width + height fallback) come from the score ids
  // verdict/actions — the only right-column ids in GROUP_FRAMES (Pitfall 2). But in
  // remix mode the RENDERED frames are decode/adapt, so onMeasure stores their
  // measured heights under THOSE ids. Reading measured['verdict'] in remix mode
  // misses → falls back to the short constant → adapt stacks under a short height
  // and overlaps the (tall) decode content. Read the measured height by the mode's
  // actual rendered id; keep the bounds fallback keyed on the score id.
  const rightTopMeasuredId: GroupId = mode === 'remix' ? 'decode' : 'verdict';
  const rightBotMeasuredId: GroupId = mode === 'remix' ? 'adapt' : 'actions';
  const measuredOrBase = (measuredId: GroupId, baseId: GroupId): number => {
    const m = measured[measuredId];
    return AUTO_HEIGHT_FRAMES.has(measuredId) && m != null && m > 0
      ? m
      : base[baseId]?.bounds.height ?? 0;
  };
  const verdictH = measuredOrBase(rightTopMeasuredId, 'verdict');
  const actionsY = verdictH + GUTTER;
  const actionsH = measuredOrBase(rightBotMeasuredId, 'actions');
  // Bottom block clears the taller of the left + center columns.
  const leftBottom = engineY + engineH;
  const centerBottom = audienceH; // audience y = 0
  const caY = Math.max(leftBottom, centerBottom) + GUTTER;
  const caH = h('content-analysis');
  // Insight-hero: D-08 hero, below content-analysis + 32px gutter.
  const ihY = caY + caH + GUTTER;
  const ihH = h('insight-hero');

  const scoreFrames: GroupFrameLayout[] = [
    { id: 'input',            label: 'Input',          bounds: { x: x('input'),            y: 0,        width: w('input'),            height: inputH } },
    { id: 'engine',           label: 'Engine',         bounds: { x: x('engine'),           y: engineY,  width: w('engine'),           height: engineH } },
    { id: 'audience',         label: 'Audience',       bounds: { x: x('audience'),         y: 0,        width: w('audience'),         height: audienceH } },
    { id: 'verdict',          label: 'Score',          bounds: { x: x('verdict'),          y: 0,        width: w('verdict'),          height: verdictH } },
    { id: 'actions',          label: 'Actions',        bounds: { x: x('actions'),          y: actionsY, width: w('actions'),          height: actionsH } },
    { id: 'content-analysis', label: 'Content craft',  bounds: { x: x('content-analysis'), y: caY,      width: w('content-analysis'), height: caH } },
    { id: 'insight-hero',     label: 'Insight',        bounds: { x: x('insight-hero'),     y: ihY,      width: w('insight-hero'),     height: ihH } },
  ];

  if (mode !== 'remix') return scoreFrames;

  // Pattern 2(a): rewrite {id, label} on verdict/actions entries — bounds verbatim (D-07).
  // Do NOT look up base by the new ids (decode/adapt are not in GROUP_FRAMES — Pitfall 2).
  return scoreFrames.map((entry) => {
    if (entry.id === 'verdict') return { ...entry, id: 'decode' as GroupId, label: 'Decode' };
    if (entry.id === 'actions') return { ...entry, id: 'adapt' as GroupId, label: 'Adapt' };
    return entry;
  });
}

/** Bounding box of a resolved layout (overview camera target + board extent). */
export function computeBoardBounds(frames: GroupFrameLayout[]): Rect {
  const right = Math.max(...frames.map((f) => f.bounds.x + f.bounds.width));
  const bottom = Math.max(...frames.map((f) => f.bounds.y + f.bounds.height));
  return { x: 0, y: 0, width: right, height: bottom };
}

/** Camera preset targets recomputed from a (possibly grown) resolved layout. */
export function computePresetTargets(
  frames: GroupFrameLayout[],
): Record<string, Rect> {
  const byId = Object.fromEntries(
    frames.map((f) => [f.id, f.bounds]),
  ) as Partial<Record<GroupId, Rect>>;
  const inp = byId.input!;
  const eng = byId.engine!;
  const aud = byId.audience!;
  // In remix mode `verdict` is replaced by `decode` (same bounds, D-07).
  // Fall back to byId.decode so the preset never crashes on a remix layout (Pitfall 3).
  const ver = byId.verdict ?? byId.decode!;

  // engine preset = left column union (Input + Engine)
  const leftTop = Math.min(inp.y, eng.y);
  const leftBottom = Math.max(inp.y + inp.height, eng.y + eng.height);
  // verdict preset = Audience + Verdict/Decode union (D-07 hero pair)
  const heroLeft = aud.x;
  const heroRight = Math.max(aud.x + aud.width, ver.x + ver.width);
  const heroTop = Math.min(aud.y, ver.y);
  const heroBottom = Math.max(aud.y + aud.height, ver.y + ver.height);

  return {
    overview: computeBoardBounds(frames),
    engine: { x: inp.x, y: leftTop, width: Math.max(inp.width, eng.width), height: leftBottom - leftTop },
    verdict: { x: heroLeft, y: heroTop, width: heroRight - heroLeft, height: heroBottom - heroTop },
    audience: aud,
    'content-analysis': byId['content-analysis']!,
  };
}
