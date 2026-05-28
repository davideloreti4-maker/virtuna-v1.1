import type { PredictionResult } from '@/lib/engine/types';

export interface ReasoningBuckets {
  intro: string;
  works: PredictionResult['factors'];
  mightNot: PredictionResult['factors'];
  flagged: string[];
  counterfactual: NonNullable<PredictionResult['counterfactuals']>['suggestions'];
}

// Engine warnings include both user-actionable signals (e.g. "Hook lands but
// momentum stalls at 0:08") AND internal debug noise (e.g. "Persona X failed:
// Request was aborted", "Weights redistributed — missing signals: ..."). Surface
// only the former; debug-tier warnings stay in logs.
const DEBUG_WARNING_PATTERNS: readonly RegExp[] = [
  /^Persona .* failed:/i,
  /Request was aborted/i,
  /^Weights redistributed/i,
  /^Missing signals?:/i,
  /^[A-Za-z_]+ provider unavailable/i,
];

function isUserFacingWarning(w: string): boolean {
  return !DEBUG_WARNING_PATTERNS.some((re) => re.test(w));
}

// Per 05-RESEARCH.md §Architecture Pattern 1 + 05-CONTEXT.md O-2.
// factors[].score is 0-10 (ScoreSchema in types.ts:432).
//   - score >= 7 → 'works'
//   - score < 4 → 'mightNot'
//   - 4 <= score < 7 → bucketed in neither (middle factors are not surfaced as either positive or negative)
// counterfactuals.suggestions filtered to type === 'fix' || 'stretch' (NOT 'reinforcement'), max 5.
export function assembleReasoningBuckets(result: PredictionResult): ReasoningBuckets {
  return {
    intro: result.reasoning,
    works: result.factors.filter((f) => f.score >= 7),
    mightNot: result.factors.filter((f) => f.score < 4),
    flagged: (result.warnings ?? []).filter(isUserFacingWarning),
    counterfactual:
      result.counterfactuals?.suggestions
        .filter((s) => s.type === 'fix' || s.type === 'stretch')
        .slice(0, 5) ?? [],
  };
}
