import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { formatTime, stripMarkdown } from '@/lib/script-utils';
import type {
  ScriptResult,
  ScriptResultBody,
} from '@/components/board/actions/script/script-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const log = createLogger({ module: 'analyze.script' });

// D-01: mirror comparisons/route.ts:24-30 verbatim
const ParamsSchema = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});

// Signal-anchor regexes per 06-RESEARCH.md Item 1
const HOOK_ANCHOR_RE =
  /^hook_decomposition\.|gemini_factor\.(Hook|Scroll-Stop|Completion Pull)|first_words|opening/i;
const TEXT_ANCHOR_RE = /text_overlay|hashtag|caption|cta/i;
const HOOK_FIX_ANCHOR_RE =
  /^hook_decomposition\.(visual_stop_power|audio_hook_quality|first_words_speech_score|text_overlay_score)$|gemini_factor\.(Hook|Scroll-Stop|Completion Pull)|opening/i;

type CounterfactualSuggestion = {
  type: 'fix' | 'stretch' | 'reinforcement' | string;
  headline: string;
  detail: string;
  timestamp_ms: number;
  signal_anchor: string;
};
type FactorRow = {
  name: string;
  score: number;
  max_score: number;
  rationale: string;
  improvement_tip: string;
};
type CounterfactualPayload = {
  band?: 'low' | 'mid' | 'high';
  suggestions?: CounterfactualSuggestion[];
};

type HookDecomposition = {
  weakest_modality?: 'visual' | 'audio' | 'speech' | 'text_overlay' | string;
  [k: string]: unknown;
};

interface AnalysisRow {
  id: string;
  counterfactuals: CounterfactualPayload | null;
  factors: FactorRow[] | null;
  reasoning: string | null;
  confidence: number | null;
  confidence_label: string | null; // 'LOW' | 'MID' | 'HIGH'
  anti_virality_gated: boolean | null;
  hook_decomposition: HookDecomposition | null;
  engine_version: string | null;
  script_result: ScriptResult | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const validated = ParamsSchema.safeParse(resolved);
  if (!validated.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validated.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('analysis_results')
    .select(
      'id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const row = data as unknown as AnalysisRow;

  // D-08 cache hit path with engine-version-skew guard
  if (
    row.script_result &&
    row.script_result.engine_version === row.engine_version
  ) {
    log.info('script_endpoint_cache_hit', { analysis_id: id });
    return NextResponse.json(row.script_result, { status: 200 });
  }

  // Cache miss — compute deterministically
  log.info('script_endpoint_cache_miss', { analysis_id: id });
  const computed = computeScript(row);

  // Fire-and-forget service-client UPDATE per D-08 + RESEARCH item 11
  // Note: no Zod parse of script_result on read — column written only by this route;
  // engine-version-skew guard above is sufficient (trade-off: avoids parse cost on every hit).
  try {
    const serviceClient = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (serviceClient as any)
      .from('analysis_results')
      .update({ script_result: computed })
      .eq('id', id)
      .then(({ error: writeError }: { error: { message: string } | null }) => {
        if (writeError) {
          log.warn('script_result cache write failed', {
            analysis_id: id,
            error: writeError.message,
          });
        }
      });
  } catch (writeErr) {
    log.warn('script_result cache write threw', {
      analysis_id: id,
      error: writeErr instanceof Error ? writeErr.message : String(writeErr),
    });
  }

  return NextResponse.json(computed, { status: 200 });
}

function computeScript(row: AnalysisRow): ScriptResult {
  const engineVersion = row.engine_version ?? 'unknown';
  const generatedAt = new Date().toISOString();
  const counterfactuals = row.counterfactuals ?? {};
  const suggestions: CounterfactualSuggestion[] =
    counterfactuals.suggestions ?? [];
  const factors: FactorRow[] = row.factors ?? [];
  const confidence = row.confidence ?? 0;
  const confidenceLabel = row.confidence_label ?? 'LOW';
  const isGated = row.anti_virality_gated === true;
  const band = counterfactuals.band;

  // D-20: empty-state branch (R5.3)
  const isEmpty =
    confidenceLabel === 'HIGH' &&
    !isGated &&
    (band === 'high' || confidence >= 0.7);

  if (isEmpty) {
    const openingVariants = buildOpeningVariants(suggestions, factors);
    return {
      is_empty_state: true,
      opening_variants: openingVariants,
      engine_version: engineVersion,
      generated_at: generatedAt,
    };
  }

  // Full reshoot path — D-03..D-06
  const openingLine = deriveOpeningLine(
    suggestions,
    factors,
    row.hook_decomposition,
  );
  const sceneOrder = deriveSceneOrder(suggestions);
  const voiceover = deriveVoiceover(row.reasoning, factors);
  const captions = deriveCaptions(suggestions, factors);

  const body: ScriptResultBody = {
    opening_line: openingLine,
    scene_order: sceneOrder,
    voiceover,
    captions,
  };

  return {
    is_empty_state: false,
    script: body,
    engine_version: engineVersion,
    generated_at: generatedAt,
  };
}

function buildOpeningVariants(
  suggestions: CounterfactualSuggestion[],
  factors: FactorRow[],
): string[] {
  // D-03 Step 3: filter stretch + hook-anchored, top 2-3 by occurrence order
  const stretchHook = suggestions
    .filter((s) => s.type === 'stretch' && HOOK_ANCHOR_RE.test(s.signal_anchor))
    .slice(0, 3)
    .map((s) => s.headline.slice(0, 80));

  if (stretchHook.length >= 2) return stretchHook;

  // Supplement from factors with hook/opening name and score near max
  const factorVariants = factors
    .filter((f) => /hook|opening/i.test(f.name))
    .filter((f) => f.max_score > 0 && f.score >= f.max_score * 0.7)
    .map((f) => (f.improvement_tip || f.rationale || '').slice(0, 80))
    .filter((s) => s.length > 0);

  const merged = [...stretchHook, ...factorVariants].slice(0, 3);
  if (merged.length === 0) {
    return ['Lead with the strongest visual moment in the first second.'];
  }
  return merged;
}

function deriveOpeningLine(
  suggestions: CounterfactualSuggestion[],
  factors: FactorRow[],
  hookDecomposition: HookDecomposition | null,
): string {
  // D-03 Step 4 Primary: fix + hook-anchored, prefer suggestion matching weakest_modality
  const hookFixes = suggestions.filter(
    (s) => s.type === 'fix' && HOOK_FIX_ANCHOR_RE.test(s.signal_anchor),
  );
  let picked: CounterfactualSuggestion | undefined;
  const weakest = hookDecomposition?.weakest_modality;
  if (weakest && hookFixes.length > 0) {
    const modalityMap: Record<string, RegExp> = {
      visual: /visual_stop_power/,
      audio: /audio_hook_quality/,
      speech: /first_words_speech_score/,
      text_overlay: /text_overlay_score/,
    };
    const matcher = modalityMap[weakest];
    if (matcher) {
      const matches = hookFixes.filter((s) => matcher.test(s.signal_anchor));
      if (matches.length > 0) {
        // Greedy: lowest timestamp_ms wins
        picked = matches
          .slice()
          .sort((a, b) => a.timestamp_ms - b.timestamp_ms)[0];
      }
    }
  }
  if (!picked && hookFixes.length > 0) {
    picked = hookFixes.slice().sort((a, b) => a.timestamp_ms - b.timestamp_ms)[0];
  }

  if (picked) {
    const composed = `${picked.headline}. ${picked.detail.slice(0, 140)}`;
    return composed.slice(0, 200);
  }

  // Fallback 1: factor with hook/first/opening name + score < 0.5 * max
  const weakHookFactor = factors.find(
    (f) =>
      /hook|first|opening/i.test(f.name) &&
      f.max_score > 0 &&
      f.score < f.max_score * 0.5,
  );
  if (weakHookFactor?.improvement_tip)
    return weakHookFactor.improvement_tip.slice(0, 200);

  // Fallback 2: deterministic constant
  return 'Lead with the strongest visual moment in the first 1 second — see Hook breakdown for which modality needs the biggest lift.';
}

function deriveSceneOrder(suggestions: CounterfactualSuggestion[]): string[] {
  // D-04 simplified: no heatmap available (RESEARCH Item 2 / S-1). Sort by timestamp_ms ASC, cap at 6.
  const fixes = suggestions.filter(
    (s) => s.type === 'fix' && s.timestamp_ms > 0,
  );
  if (fixes.length === 0) {
    return [
      'Keep the existing scene order — no major reshoots needed below the hook.',
    ];
  }
  return fixes
    .slice()
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms)
    .slice(0, 6)
    .map((s) => `${formatTime(s.timestamp_ms)} — ${s.headline}`);
}

function deriveVoiceover(
  reasoning: string | null,
  factors: FactorRow[],
): string {
  // D-05: reasoning prose + top 3 improvement_tips by score ASC (with score < 0.6 * max)
  const cleanReasoning = stripMarkdown(reasoning ?? '');
  const tips = factors
    .filter(
      (f) =>
        f.max_score > 0 && f.score < f.max_score * 0.6 && f.improvement_tip,
    )
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((f) => f.improvement_tip.trim())
    .filter((t) => t.length > 0);

  if (!cleanReasoning && tips.length === 0) {
    return 'Tighten the hook timing, hold tension through the scene cuts, and pay off the promise of the first beat.';
  }
  if (!cleanReasoning) {
    return `Three tightenings while you record: ${tips.join(' ')}`;
  }
  if (tips.length === 0) {
    return cleanReasoning.slice(0, 1200);
  }
  const combined = `${cleanReasoning}\n\nThree tightenings while you record: ${tips.join(' ')}`;
  return combined.slice(0, 1200);
}

function deriveCaptions(
  suggestions: CounterfactualSuggestion[],
  factors: FactorRow[],
): string[] {
  // D-06: primary = fix + text-anchor regex
  const textFixes = suggestions
    .filter((s) => s.type === 'fix' && TEXT_ANCHOR_RE.test(s.signal_anchor))
    .map((s) => s.headline.slice(0, 80));

  // Supplement from factors with text/overlay/caption name + score < 0.5 max
  const factorCaptions = factors
    .filter(
      (f) =>
        /text|overlay|caption/i.test(f.name) &&
        f.max_score > 0 &&
        f.score < f.max_score * 0.5,
    )
    .map((f) => (f.improvement_tip || '').slice(0, 80))
    .filter((s) => s.length > 0);

  // Always-include A/B alternative from the highest-impact text-overlay suggestion
  const highImpact = suggestions
    .filter((s) => s.type === 'fix' && TEXT_ANCHOR_RE.test(s.signal_anchor))
    .slice()
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms)[0];
  const ab = highImpact ? highImpact.detail.slice(0, 80).trim() : undefined;

  const merged = [...textFixes, ...factorCaptions];
  if (ab && !merged.includes(ab)) merged.push(ab);

  if (merged.length === 0) {
    return [
      'Add a 2-3 word text overlay at the hook moment matching your spoken first words.',
    ];
  }
  // Cap at 5 captions per D-06
  return merged.slice(0, 5);
}
