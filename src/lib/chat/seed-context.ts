/**
 * seed-context.ts — Build the Qwen system context from a cached analysis_results row.
 *
 * Grounds the Apollo expert chat ENTIRELY on data already persisted in the DB.
 * Zero new engine cost: we never call the analysis pipeline here.
 *
 * Scope keys match board-store selectedNodeId values and CameraPresetKey labels:
 *   'audience' | 'engine' | 'verdict' | 'actions' | 'content' | null (whole-analysis)
 */

/** Subset of an analysis_results row relevant to chat grounding. */
export interface AnalysisRow {
  overall_score?: number | string | null;
  confidence?: number | string | null;
  content_text?: string | null;
  apollo_reasoning?: ApolloReasoning | null;
  behavioral_predictions?: unknown;
  heatmap?: HeatmapData | null;
  variants?: {
    apollo?: ApolloReasoning | null;
    [key: string]: unknown;
  } | null;
}

export interface ApolloReasoning {
  rewrites?: ApolloRewrite[];
  dimensions?: ApolloDimension[];
  composite_score?: number;
  ceiling_capper?: string | null;
  confidence_scope?: string;
  platform_note?: string | null;
}

export interface ApolloRewrite {
  label?: string;
  original?: string;
  rewrite?: string;
}

export interface ApolloDimension {
  name?: string;
  score?: number;
  rationale?: string;
}

export interface HeatmapData {
  weighted_curve?: number[];
  segments?: HeatmapSegment[];
  [key: string]: unknown;
}

export interface HeatmapSegment {
  label?: string;
  score?: number;
  reaction?: string;
  spoken_text?: string;
  [key: string]: unknown;
}

export type ChatScope = 'audience' | 'engine' | 'verdict' | 'actions' | 'content' | null;

/** Known scope frame keys (used for allowlist validation at route boundary). */
export const VALID_SCOPES: readonly string[] = ['audience', 'engine', 'verdict', 'actions', 'content'];

/**
 * Build the Qwen system prompt for the Ask-the-expert chat.
 *
 * @param row   - cached analysis_results row (DUAL-READ: variants?.apollo ?? apollo_reasoning)
 * @param scope - optional frame scope to narrow the embedded data
 */
export function buildChatSystemContext(row: AnalysisRow, scope: ChatScope = null): string {
  // DUAL-READ: newer rows persist apollo under variants.apollo; older rows use apollo_reasoning.
  const apollo: ApolloReasoning | null | undefined =
    row.variants?.apollo ?? row.apollo_reasoning ?? null;

  const overallScore = row.overall_score != null ? Number(row.overall_score) : null;
  const confidence = row.confidence != null ? Number(row.confidence) : null;

  const lines: string[] = [
    `You are Apollo — a veteran social-media content strategist and expert analyst.`,
    `You have just completed a deep analysis of the creator's content. Your role is to`,
    `answer questions about THAT specific analysis, explain your findings, and give`,
    `expert advice grounded in the data provided below.`,
    ``,
    `RULES:`,
    `- Answer ONLY from the provided analysis data and your general creator expertise.`,
    `- NEVER invent metrics, scores, or percentages not in the data.`,
    `- Keep answers concise and actionable (2-4 paragraphs max unless asked for more).`,
    `- Plain prose only — no citation markers or camera references (reserved for future version).`,
    `- Never mention Claude, Gemini, DeepSeek, or any model name. You are Apollo.`,
    ``,
    `=== ANALYSIS DATA ===`,
  ];

  // Whole-analysis or narrow to scope
  if (scope === null) {
    appendWholeAnalysis(lines, apollo, row, overallScore, confidence);
  } else if (scope === 'audience') {
    appendAudienceScope(lines, row);
  } else if (scope === 'verdict') {
    appendVerdictScope(lines, apollo, overallScore, confidence);
  } else if (scope === 'engine' || scope === 'actions') {
    appendApolloScope(lines, apollo);
  } else if (scope === 'content') {
    appendContentScope(lines, apollo, row);
  } else {
    // Unknown scope fallback → whole analysis
    appendWholeAnalysis(lines, apollo, row, overallScore, confidence);
  }

  lines.push('');
  lines.push('=== END ANALYSIS DATA ===');

  return lines.join('\n');
}

// ── Scope builders ─────────────────────────────────────────────────────────

function appendWholeAnalysis(
  lines: string[],
  apollo: ApolloReasoning | null | undefined,
  row: AnalysisRow,
  overallScore: number | null,
  confidence: number | null,
): void {
  if (overallScore != null) lines.push(`Overall score: ${overallScore}/100`);
  if (confidence != null) lines.push(`Confidence: ${(confidence * 100).toFixed(0)}%`);
  if (row.content_text) lines.push(`\nContent caption/text:\n${row.content_text}`);

  appendApolloScope(lines, apollo);
  appendAudienceScope(lines, row);
}

function appendVerdictScope(
  lines: string[],
  apollo: ApolloReasoning | null | undefined,
  overallScore: number | null,
  confidence: number | null,
): void {
  lines.push('SCOPE: Verdict & score');
  if (overallScore != null) lines.push(`Overall score: ${overallScore}/100`);
  if (confidence != null) lines.push(`Confidence: ${(confidence * 100).toFixed(0)}%`);
  if (apollo?.ceiling_capper) {
    lines.push(`Ceiling capper (primary growth limiter): ${apollo.ceiling_capper}`);
  }
  if (apollo?.composite_score != null) {
    lines.push(`Apollo composite score: ${apollo.composite_score}/100`);
  }
  if (apollo?.confidence_scope) {
    lines.push(`Confidence scope: ${apollo.confidence_scope}`);
  }
  if (apollo?.platform_note) {
    lines.push(`Platform note: ${apollo.platform_note}`);
  }
}

function appendApolloScope(
  lines: string[],
  apollo: ApolloReasoning | null | undefined,
): void {
  if (!apollo) return;
  lines.push('');
  lines.push('APOLLO EXPERT ANALYSIS:');
  if (apollo.ceiling_capper) {
    lines.push(`Primary growth limiter (ceiling capper): ${apollo.ceiling_capper}`);
  }
  if (apollo.confidence_scope) {
    lines.push(`Confidence scope: ${apollo.confidence_scope}`);
  }
  if (apollo.platform_note) {
    lines.push(`Platform note: ${apollo.platform_note}`);
  }
  if (Array.isArray(apollo.dimensions) && apollo.dimensions.length > 0) {
    lines.push('\nDimension scores:');
    for (const dim of apollo.dimensions) {
      const score = dim.score != null ? ` — ${dim.score}/10` : '';
      const rationale = dim.rationale ? `: ${dim.rationale}` : '';
      lines.push(`  ${dim.name ?? 'Unknown'}${score}${rationale}`);
    }
  }
  if (Array.isArray(apollo.rewrites) && apollo.rewrites.length > 0) {
    lines.push('\nSuggested rewrites:');
    for (const rw of apollo.rewrites) {
      lines.push(`  [${rw.label ?? 'Rewrite'}]`);
      if (rw.original) lines.push(`    Original: ${rw.original}`);
      if (rw.rewrite) lines.push(`    Improved: ${rw.rewrite}`);
    }
  }
}

function appendAudienceScope(lines: string[], row: AnalysisRow): void {
  const heatmap = row.heatmap as HeatmapData | null | undefined;
  const behavioral = row.behavioral_predictions;

  if (!heatmap && !behavioral) return;
  lines.push('');
  lines.push('AUDIENCE SIMULATION:');

  if (heatmap) {
    if (Array.isArray(heatmap.weighted_curve) && heatmap.weighted_curve.length > 0) {
      const curve = heatmap.weighted_curve.map((v) => Math.round(v)).join(', ');
      lines.push(`Retention curve (0-100 per segment): [${curve}]`);
    }
    if (Array.isArray(heatmap.segments) && heatmap.segments.length > 0) {
      lines.push('Segment reactions:');
      for (const seg of heatmap.segments) {
        const score = seg.score != null ? ` (${seg.score}/10)` : '';
        const reaction = seg.reaction ? ` — ${seg.reaction}` : '';
        const text = seg.spoken_text ? ` "${seg.spoken_text.slice(0, 80)}"` : '';
        lines.push(`  ${seg.label ?? 'Segment'}${score}${reaction}${text}`);
      }
    }
  }

  if (behavioral && typeof behavioral === 'object') {
    lines.push(`\nBehavioral predictions: ${JSON.stringify(behavioral).slice(0, 500)}`);
  }
}

function appendContentScope(
  lines: string[],
  apollo: ApolloReasoning | null | undefined,
  row: AnalysisRow,
): void {
  lines.push('SCOPE: Content craft');
  if (row.content_text) {
    lines.push(`\nContent caption/text:\n${row.content_text}`);
  }
  if (Array.isArray(apollo?.rewrites) && apollo!.rewrites!.length > 0) {
    lines.push('\nSuggested rewrites:');
    for (const rw of apollo!.rewrites!) {
      lines.push(`  [${rw.label ?? 'Rewrite'}]`);
      if (rw.original) lines.push(`    Original: ${rw.original}`);
      if (rw.rewrite) lines.push(`    Improved: ${rw.rewrite}`);
    }
  }
  if (Array.isArray(apollo?.dimensions) && apollo!.dimensions!.length > 0) {
    lines.push('\nContent dimensions:');
    for (const dim of apollo!.dimensions!) {
      const score = dim.score != null ? ` — ${dim.score}/10` : '';
      lines.push(`  ${dim.name ?? 'Unknown'}${score}`);
    }
  }
}
