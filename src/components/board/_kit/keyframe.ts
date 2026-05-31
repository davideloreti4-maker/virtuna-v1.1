/**
 * Resolve a keyframe (signed URL) for a moment in the analysed video.
 *
 * Data shapes (from the engine):
 * - `filmstrips`: segment index → signed keyframe URL (the live + permalink source)
 * - `segments`: ordered slices carrying a time range in **seconds** (`t_start`/`t_end`)
 *   and an optional `keyframe_uri` fallback
 *
 * `target`:
 * - `'first'` → the earliest available keyframe (used for the Input video poster)
 * - a `number` → **milliseconds** into the video (used to anchor a fix / drop to its frame)
 */
export interface KeyframeSegmentLike {
  idx: number;
  /** seconds */
  t_start: number;
  /** seconds */
  t_end: number;
  keyframe_uri?: string | null;
}

export function resolveKeyframeUrl(
  filmstrips: Record<number, string> | null | undefined,
  segments: ReadonlyArray<KeyframeSegmentLike> | null | undefined,
  target: number | 'first',
): string | null {
  const strips = filmstrips ?? {};
  const segs = segments ?? [];

  const urlForIdx = (idx: number): string | null => {
    if (strips[idx]) return strips[idx] ?? null;
    const seg = segs.find((s) => s.idx === idx);
    return seg?.keyframe_uri ?? null;
  };

  const idxSet = new Set<number>();
  for (const k of Object.keys(strips)) idxSet.add(Number(k));
  for (const s of segs) idxSet.add(s.idx);
  const idxs = [...idxSet].sort((a, b) => a - b);
  if (idxs.length === 0) return null;

  if (target === 'first') {
    for (const idx of idxs) {
      const u = urlForIdx(idx);
      if (u) return u;
    }
    return null;
  }

  const sec = target / 1000;
  // The segment whose [t_start, t_end) contains the moment …
  let chosen: KeyframeSegmentLike | undefined = segs.find(
    (s) => sec >= s.t_start && sec < s.t_end,
  );
  // … else the segment whose midpoint is nearest the moment.
  if (!chosen && segs.length > 0) {
    chosen = [...segs].sort(
      (a, b) =>
        Math.abs((a.t_start + a.t_end) / 2 - sec) -
        Math.abs((b.t_start + b.t_end) / 2 - sec),
    )[0];
  }
  if (chosen) {
    const u = urlForIdx(chosen.idx);
    if (u) return u;
  }
  // No usable segment match → earliest available frame.
  for (const idx of idxs) {
    const u = urlForIdx(idx);
    if (u) return u;
  }
  return null;
}
