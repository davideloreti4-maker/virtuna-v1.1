import type { PredictionResult } from '@/lib/engine/types';

export interface ReasoningBuckets {
  intro: string;
  works: PredictionResult['factors'];
  mightNot: PredictionResult['factors'];
  flagged: string[];
  counterfactual: NonNullable<PredictionResult['counterfactuals']>['suggestions'];
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
    flagged: result.warnings,
    counterfactual:
      result.counterfactuals?.suggestions
        .filter((s) => s.type === 'fix' || s.type === 'stretch')
        .slice(0, 5) ?? [],
  };
}
