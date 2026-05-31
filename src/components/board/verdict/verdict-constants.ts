import type { Factor } from '@/lib/engine/types';

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
  AV_HEADER: (n: number) =>
    n > 0
      ? `⚠ Don't post yet — fixable in ${n} ${n === 1 ? 'step' : 'steps'}`
      : `⚠ Low confidence — review before posting`,
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
  WHY_VERDICT_SUMMARY: 'Why this score?',
  SUB_WORKS: 'Why this works',
  SUB_MIGHT_NOT: 'Why this might not',
  SUB_FLAGGED: 'What the engine flagged',
  SUB_COUNTERFACTUAL: 'Counterfactual considered',
  // Plan 5.4: VsHistoryCollapsible copy
  HISTORY_SUMMARY: 'vs your last 10',
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

/** Fix 3 (05-ux): Live stage label shown in the Verdict "Calculating…" placeholder.
 *  Falls back to "Analyzing…" when stage slug is null (before first stage event). */
export const COPY_CALCULATING_STAGE = (stage: string | null): string =>
  stage ? stage.replace(/_/g, ' ') : 'Analyzing…';

export function bandFromScore(score: number): 'Strong' | 'Mid' | 'Low' {
  if (score >= BAND_THRESHOLDS.STRONG) return 'Strong';
  if (score >= BAND_THRESHOLDS.MID) return 'Mid';
  return 'Low';
}

export function fixCount(suggestions: ReadonlyArray<{ type: string }> | undefined): number {
  if (!suggestions) return 0;
  return Math.min(3, suggestions.filter((s) => s.type === 'fix').length);
}

/** Always-on verdict summary: the single biggest driver + the single biggest
 *  risk, so the verdict's "why" is visible even with the reasoning accordion
 *  collapsed. factors[].score is 0-10. Driver = highest-scoring factor (≥6);
 *  risk = lowest-scoring factor (<6) when distinct from the driver. */
export interface VerdictSummary {
  driver: { name: string; rationale: string } | null;
  risk: { name: string; tip: string } | null;
}

export function deriveVerdictSummary(factors: ReadonlyArray<Factor>): VerdictSummary {
  if (!factors.length) return { driver: null, risk: null };
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;
  const driver = top.score >= 6 ? { name: top.name, rationale: top.rationale } : null;
  const risk =
    bottom.score < 6 && bottom.name !== top.name
      ? { name: bottom.name, tip: bottom.improvement_tip }
      : null;
  return { driver, risk };
}
