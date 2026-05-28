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
  // Plan 5.3: WhyVerdictCollapsible sub-section labels
  WHY_VERDICT_SUMMARY: 'Why this verdict?',
  SUB_WORKS: 'Why this works',
  SUB_MIGHT_NOT: 'Why this might not',
  SUB_FLAGGED: 'What the engine flagged',
  SUB_COUNTERFACTUAL: 'Counterfactual considered',
  // Plan 5.4: VsHistoryCollapsible copy
  HISTORY_SUMMARY: 'vs my history',
  HISTORY_EMPTY_STATE: (n: number) => `Need 3+ prior analyses to show comparison. ${n}/3 complete.`,
  HISTORY_LAST_10_TITLE: 'vs your last 10 analyses',
  NICHE_TITLE: 'vs niche cohort',
  NICHE_COMING_SOON: 'Niche comparison coming soon',
  HISTORY_LOADING: 'Loading…',
  HISTORY_LABEL_NOW: 'Now',
} as const;

// Telemetry event names (per 05-CONTEXT.md D-31).
export const TELEMETRY = {
  VERDICT_NODE_RENDERED: 'verdict_node_rendered',
  VERDICT_ANTI_VIRALITY_OVERRIDE: 'verdict_anti_virality_override',
  // Plan 5.3: WhyVerdictCollapsible
  VERDICT_REASONING_EXPANDED: 'verdict_reasoning_expanded',
  // Plan 5.4: VsHistoryCollapsible
  VERDICT_HISTORY_EXPANDED: 'verdict_history_expanded',
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
