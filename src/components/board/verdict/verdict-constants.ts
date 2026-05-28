// Band thresholds derived from overall_score (0-100). Per 05-UI-SPEC.md §Copywriting Contract.
export const BAND_THRESHOLDS = {
  STRONG: 70, // >=70 -> 'Strong' + coral percentile
  MID: 40,    // 40-69 -> 'Mid'
  // < 40 -> 'Low'
} as const;

// localStorage key prefix for per-analysisId 'Post anyway' dismissal. Per 05-RESEARCH.md.
export const AV_OVERRIDE_LOCALSTORAGE_PREFIX = 'virtuna:verdict-av-override:' as const;

// Verbatim copy from 05-UI-SPEC.md §Copywriting Contract. DO NOT paraphrase.
export const COPY = {
  AV_HEADER: (n: number) => `⚠ Don't post yet — fixable in ${n} steps`,
  AV_OVERRIDE_LINK: 'Post anyway →',
  CONFIDENCE_PILL: (label: string) => `Confidence: ${label}`,
  CONFIDENCE_POPOVER:
    'This score reflects how certain the engine is about this prediction, based on model agreement across personas.',
  PERCENTILE_SUFFIX: 'th percentile',
  UNCALIBRATED_NOTE: '(score uncalibrated)',
  SKELETON_CONFIDENCE: 'Calculating…',
  SKELETON_PERCENTILE: '--',
  ARIA_VERDICT_READY: (score: number, label: string) =>
    `Verdict ready: ${score}th percentile, confidence ${label}`,
  ARIA_ANTI_VIRALITY: "Don't post yet — see suggested fixes",
} as const;

// Telemetry event names (per 05-CONTEXT.md D-31).
export const TELEMETRY = {
  VERDICT_NODE_RENDERED: 'verdict_node_rendered',
  VERDICT_ANTI_VIRALITY_OVERRIDE: 'verdict_anti_virality_override',
} as const;

export function bandFromScore(score: number): 'Strong' | 'Mid' | 'Low' {
  if (score >= BAND_THRESHOLDS.STRONG) return 'Strong';
  if (score >= BAND_THRESHOLDS.MID) return 'Mid';
  return 'Low';
}

export function fixCount(suggestions: ReadonlyArray<{ type: string }> | undefined): number {
  if (!suggestions) return 0;
  return Math.min(3, suggestions.filter((s) => s.type === 'fix').length);
}
