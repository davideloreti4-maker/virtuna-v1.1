/**
 * Phase 6 D-04: format milliseconds as "M:SS" (e.g., 8000 → "0:08").
 * Used by /api/analyze/[id]/script route for scene_order line prefixes
 * and any client-side analog. Inlined here per 06-RESEARCH.md Item 3
 * (no existing time formatter found in src/lib/).
 */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Phase 6 D-05: defensive markdown strip for PredictionResult.reasoning.
 * Per 06-RESEARCH.md Item 18, reasoning is plain prose in practice —
 * this strip is defensive and expected to no-op on real engine output.
 */
export function stripMarkdown(text: string): string {
  return text.replace(/\*\*|__|`/g, '').trim();
}
