/**
 * seed-prompts.ts — Derive 2-3 highest-leverage seeded questions from an analysis row.
 *
 * Shown above the "Ask the expert" input to eliminate blank-box cold start.
 * Copy is picked to reflect the most salient signal in the analysis.
 */

import type { AnalysisRow, ApolloReasoning, ApolloDimension } from './seed-context';

/**
 * Derive 2-3 seeded prompts from the analysis row.
 * Falls back to 2 generic expert prompts if the row lacks apollo data.
 */
export function deriveSeedPrompts(row: AnalysisRow): string[] {
  // DUAL-READ: variants?.apollo preferred over apollo_reasoning
  const apollo: ApolloReasoning | null | undefined =
    row.variants?.apollo ?? row.apollo_reasoning ?? null;

  if (!apollo) {
    return genericFallback();
  }

  const prompts: string[] = [];

  // Signal 1 — ceiling_capper present → "Why will this flop?"
  if (apollo.ceiling_capper && apollo.ceiling_capper.trim().length > 0) {
    prompts.push('Why will this flop — what\'s holding it back?');
  }

  // Signal 2 — weakest dimension → "How do I fix my <dimension>?"
  const weakest = findWeakestDimension(apollo.dimensions);
  if (weakest) {
    const dimName = weakest.name?.toLowerCase() ?? 'weakest area';
    prompts.push(`How do I improve my ${dimName}?`);
  }

  // Signal 3 — top rewrite present → "Rewrite my hook"
  const hasRewrites = Array.isArray(apollo.rewrites) && apollo.rewrites.length > 0;
  if (hasRewrites && prompts.length < 3) {
    const hookRewrite = apollo.rewrites!.find(
      (r) => r.label?.toLowerCase().includes('hook') || r.original?.toLowerCase().includes('hook')
    );
    if (hookRewrite) {
      prompts.push('Can you give me a better hook?');
    } else if (prompts.length < 3) {
      prompts.push('What\'s the #1 change that would boost this content?');
    }
  }

  // Fill up to 2 prompts with generic fallbacks if we don't have enough signals
  const fallbacks = genericFallback();
  for (const fb of fallbacks) {
    if (prompts.length >= 2) break;
    if (!prompts.includes(fb)) prompts.push(fb);
  }

  // Deduplicate and cap at 3
  return [...new Set(prompts)].slice(0, 3);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function findWeakestDimension(
  dimensions: ApolloDimension[] | undefined | null
): ApolloDimension | null {
  if (!Array.isArray(dimensions) || dimensions.length === 0) return null;
  let weakest: ApolloDimension | null = null;
  let lowestScore = Infinity;
  for (const dim of dimensions) {
    if (dim.score != null && dim.score < lowestScore) {
      lowestScore = dim.score;
      weakest = dim;
    }
  }
  return weakest;
}

function genericFallback(): string[] {
  return [
    'What\'s stopping this from going viral?',
    'What should I prioritize to improve this content?',
  ];
}
