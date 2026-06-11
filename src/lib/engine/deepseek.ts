import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import {
  DeepSeekResponseSchema,
  type AnalysisInput,
  type DeepSeekReasoning,
  type GeminiAnalysis,
  type HookDecomposition,
  type RuleScoreResult,
  type TrendEnrichment,
  type VerbatimPayload,
} from "./types";
import { APOLLO_SYSTEM_PROMPT, PRESENT_SECTIONS } from "./apollo-core";
import { getQwenClient, QWEN_APOLLO_MODEL, QWEN_SEED } from "./qwen/client";
import { calculateCost } from "./qwen/cost";
import { stripModelOutput } from "./utils/strip";

// NOTE: "deepseek" is a LEGACY module/stage name — this stage actually runs Qwen
// (QWEN_APOLLO_MODEL = qwen3.7-plus) via DashScope, not DeepSeek. The pipeline
// is Qwen-only. The string is kept because log dashboards + tests key off the
// "deepseek" / "deepseek_reasoning" stage names.
const log = createLogger({ module: "deepseek" });

// Legacy constant name — resolves to QWEN_APOLLO_MODEL (qwen3.7-plus, scoped to Apollo).
const DEEPSEEK_MODEL = QWEN_APOLLO_MODEL;
const MAX_RETRIES = 2; // 3 total attempts
const TIMEOUT_MS = 120_000; // 120s — bounded-thinking Apollo call on the full KNOWLEDGE_CORE prefix; headroom under the 300s pipeline cap
// Apollo thinking budget. Default 1500 (was 3000) — A/B-validated 2026-06-05
// (quick/20260605-engine-latency-quality-spine-ab): a budget sweep on identical omni
// input showed Apollo insight (6 §-cited dimensions + 3 verbatim-grounded rewrites) is
// NOT thinking-bound — depth held identically from 3000 down to 1000 while latency fell
// 76s→44s. 1500 (~49s) sits just under the fold (~54s) so Apollo is fully hidden on the
// critical path with maximum thinking headroom for dense/long content. Going lower buys
// no E2E (the fold gates). DashScope counts thinking_budget toward max_tokens(3000), so
// 1500 leaves ample room for the §4 JSON answer. Override via env for experimentation.
const DEEPSEEK_THINKING_BUDGET = Number(process.env.DEEPSEEK_THINKING_BUDGET) || 1500;

// Circuit breaker state (INFRA-03: exponential backoff with half-open)
interface CircuitBreakerState {
  status: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  nextRetryAt: number; // timestamp when half-open probe is allowed
  backoffIndex: number; // 0, 1, 2 -> maps to 1s, 3s, 9s
}

const BACKOFF_SCHEDULE_MS = [1_000, 3_000, 9_000]; // 1s, 3s, 9s exponential
const FAILURE_THRESHOLD = 3;

let breaker: CircuitBreakerState = {
  status: "closed",
  consecutiveFailures: 0,
  nextRetryAt: 0,
  backoffIndex: 0,
};

// HARD-04: Mutex to prevent concurrent half-open probes (thundering herd prevention)
let probeInFlight = false;

/** Check if circuit breaker is open (INFRA-03: half-open probe support, HARD-04: probe mutex) */
function isCircuitOpen(): boolean {
  if (breaker.status === "closed") return false;
  if (breaker.status === "open") {
    if (Date.now() >= breaker.nextRetryAt) {
      // HARD-04 Mutex: only one probe at a time
      if (probeInFlight) return true; // Another request is already probing
      probeInFlight = true;
      // Transition to half-open: allow this ONE request through as the probe
      breaker.status = "half-open";
      return false;
    }
    return true;
  }
  // half-open: if probeInFlight is true, block additional requests
  // (defensive guard — probeInFlight gates the transition above)
  if (probeInFlight) return true;
  return false;
}

/** Record a failure and potentially open the circuit (INFRA-03: exponential backoff) */
function recordFailure(): void {
  probeInFlight = false; // HARD-04: clear probe mutex on failure
  breaker.consecutiveFailures++;
  if (
    breaker.status === "half-open" ||
    breaker.consecutiveFailures >= FAILURE_THRESHOLD
  ) {
    // Open the circuit with exponential backoff
    const backoffMs =
      BACKOFF_SCHEDULE_MS[breaker.backoffIndex] ??
      BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]!;
    breaker.status = "open";
    breaker.nextRetryAt = Date.now() + backoffMs;
    breaker.backoffIndex = Math.min(
      breaker.backoffIndex + 1,
      BACKOFF_SCHEDULE_MS.length - 1
    );
    log.warn("Circuit breaker OPEN", {
      next_retry_ms: backoffMs,
      backoff_level: breaker.backoffIndex,
    });
  }
}

/** Record a success — full reset to closed state (INFRA-03) */
function recordSuccess(): void {
  probeInFlight = false; // HARD-04: clear probe mutex on success
  breaker = {
    status: "closed",
    consecutiveFailures: 0,
    nextRetryAt: 0,
    backoffIndex: 0,
  };
}

/** Strip markdown code fences from LLM output */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

/**
 * Normalize whitespace for verbatim comparison (Pitfall 4 guard).
 * Trims + collapses internal whitespace to single spaces.
 */
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ── §-cite resolution guard (ENG-02, plan 01-01) ───────────────────────────
// Two jobs, both belt-and-suspenders backstops to the prompt instructions
// (the LLM is untrusted, V5): (1) AUDITABLE-METADATA fields (lever/evidence/
// lever_fixed) may carry §-cites, but only ones that RESOLVE to the lean
// KNOWLEDGE_CORE — strip danglers (§2.6/§7/§8/hallucinated §9+). (2) USER-FACING
// PROSE fields (ceiling_capper/confidence_scope/suggestions/variant) must carry
// NO §-cites — strip them all so cryptic "(§2.1)" tokens never reach the board.
// One literal regex per call (no shared /g lastIndex state).
const CITE_TOKEN = /§\s*\d+(?:\.\d+)?[a-z]?/;
function normalizeCite(raw: string): string {
  return raw.replace(/\s+/g, ""); // "§ 2.1" → "§2.1"
}
/** Tidy whitespace/orphaned punctuation left behind after removing a cite. */
function tidyAfterStrip(s: string): string {
  return s
    .replace(/\(\s*\)/g, "")        // empty parens "()"
    .replace(/\s+([.,;:!?])/g, "$1") // space before punctuation
    .replace(/\s{2,}/g, " ")        // collapsed double spaces
    .trim();
}
/** METADATA: keep cites that resolve to the lean core, strip danglers. */
function stripDanglingCites(s: string, drift: string[]): string {
  const out = s.replace(new RegExp(CITE_TOKEN.source, "g"), (m) => {
    const c = normalizeCite(m);
    if (PRESENT_SECTIONS.has(c)) return m;
    drift.push(c);
    return "";
  });
  const tidied = tidyAfterStrip(out);
  return tidied.length > 0 ? tidied : s; // never empty a required string
}
/** PROSE: strip ALL cites; drop an enclosing paren group if it held only cites. */
function stripAllCites(s: string, drift: string[]): string {
  // First collapse parenthetical groups that contain a cite.
  let out = s.replace(/\(([^()]*)\)/g, (full, inner: string) => {
    if (!/§/.test(inner)) return full; // no cite — leave the paren intact
    const cleaned = inner
      .replace(new RegExp(CITE_TOKEN.source, "g"), (m) => { drift.push(normalizeCite(m)); return ""; })
      .replace(/^[\s,;/&]+|[\s,;/&]+$/g, "")
      .trim();
    return cleaned ? `(${cleaned})` : "";
  });
  // Then any remaining inline/bare cites.
  out = out.replace(new RegExp(CITE_TOKEN.source, "g"), (m) => { drift.push(normalizeCite(m)); return ""; });
  const tidied = tidyAfterStrip(out);
  return tidied.length > 0 ? tidied : s; // never empty a required string
}

/**
 * Apply the §-cite resolution guard to a parsed Apollo response, in place.
 * Returns the set of §-tokens it removed (danglers from metadata + any cite
 * leaked into prose). Exported for the apollo-cite-resolution test (V5 boundary).
 */
export function guardApolloCites(data: DeepSeekReasoning): { drift: string[] } {
  const drift: string[] = [];
  // (1) auditable metadata — strip danglers only
  for (const dim of data.dimensions) {
    dim.lever = stripDanglingCites(dim.lever, drift);
    dim.evidence = stripDanglingCites(dim.evidence, drift);
  }
  for (const rw of data.rewrites) {
    rw.lever_fixed = stripDanglingCites(rw.lever_fixed, drift);
  }
  // (2) user-facing prose — strip ALL cites (prose discipline)
  if (data.ceiling_capper) data.ceiling_capper = stripAllCites(data.ceiling_capper, drift);
  data.confidence_scope = stripAllCites(data.confidence_scope, drift);
  for (const s of data.suggestions) s.text = stripAllCites(s.text, drift);
  for (const rw of data.rewrites) rw.variant = stripAllCites(rw.variant, drift);
  return { drift };
}

/** Parse and validate Apollo response with Zod + post-parse backstop (Pattern 2) */
function parseDeepSeekResponse(
  raw: string,
  verbatim?: VerbatimPayload | null
): DeepSeekReasoning {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = DeepSeekResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`DeepSeek response validation failed: ${result.error.message}`);
  }
  const data = result.data;

  // ── Post-parse backstop (RESEARCH Pattern 2, Pitfall 4) ──────────────────
  // Assert dimensions.length === 6 (Zod .length(6) handles schema rejection, but
  // clamp here for belt-and-suspenders on partial-success paths).
  if (data.dimensions.length !== 6) {
    log.warn("Apollo dimensions length mismatch post-parse", { count: data.dimensions.length });
  }

  // D-01 + F26 (2026-06-11): composite_score is a deterministic rubric-sum of the six dimension
  // scores — the LLM is no longer asked to produce it (it was emitted then discarded; the prompt
  // contract dropped the ask, schema made it .optional()). Computed here from dimensions only.
  // Hook carries ~80% weight (apollo-core §4 weighting, §2.0a consensus); the 5 body dimensions
  // share the remaining 20% equally. Clamp + round as defense-in-depth (V5). Runs BEFORE any
  // rewrite-backstop reads composite.
  {
    const HOOK_WEIGHT = 0.80;
    const BODY_WEIGHT = 0.20 / 5; // 5 non-hook dims share remaining 20%
    const sum = data.dimensions.reduce((acc, dim) => {
      const w = dim.name === "hook" ? HOOK_WEIGHT : BODY_WEIGHT;
      return acc + dim.score * w;
    }, 0);
    data.composite_score = Math.min(100, Math.max(0, Math.round(sum)));
  }

  // Assert rewrites.length >= 2 (Zod .min(2) handles schema rejection)
  if (data.rewrites.length < 2) {
    log.warn("Apollo rewrites too few post-parse", { count: data.rewrites.length });
  }

  // ── §-cite resolution guard (ENG-02): strip danglers from metadata + ALL cites
  // from user-facing prose, so no unresolvable / cryptic §-token reaches the board.
  const { drift } = guardApolloCites(data);
  if (drift.length > 0) {
    log.warn("Apollo cite_drift — §-cites stripped (danglers + prose leaks)", {
      cite_drift: [...new Set(drift)].sort(),
      count: drift.length,
    });
  }

  // R2 backstop: normalize-whitespace-compare rewrite.original to verbatim hook.
  // On mismatch — LLM paraphrased instead of copying verbatim — overwrite from TS.
  if (verbatim?.hook) {
    const feedHook = verbatim.hook.spoken_words || verbatim.hook.on_screen_text || "";
    if (feedHook) {
      const normFeed = normalizeWs(feedHook);
      for (const rewrite of data.rewrites) {
        if (normalizeWs(rewrite.original) !== normFeed) {
          log.warn("Apollo rewrite.original mismatch — backstopped from verbatim (R2)", {
            was: rewrite.original.slice(0, 60),
            fixed: feedHook.slice(0, 60),
          });
          rewrite.original = feedHook;
        }
      }
    }
  }

  return data;
}

/**
 * Calculate cost in cents from token usage metadata.
 *
 * Phase 3 (CACHE-03): cache-aware pricing when usage.prompt_cache_hit_tokens AND
 * usage.prompt_cache_miss_tokens are both present (at least one > 0). Falls back
 * to legacy uncached pricing when the breakdown is missing — backwards-compat with
 * pre-Phase-3 callers and providers that don't expose the cache fields.
 */

/**
 * Format the Read's PERCEPTION for Apollo consumption (D-R1, 2026-06-11).
 *
 * The Read is now a pure sensor: it no longer supplies factor rationales /
 * overall_impression / content_summary (generic JUDGMENT — Apollo is the sole judge).
 * Instead Apollo receives the raw PERCEPTUAL reading it interprets itself: hook-modality
 * strengths, production signals, the audio reading, and the emotional-intensity curve.
 * These are SENSOR measurements (how strong/clear/fast), explicitly NOT quality grades —
 * so handing Apollo the numbers does not anchor its verdict the way the old factor SCORES
 * (deliberately stripped) would have. emotion_arc + hook_decomposition ride the
 * GeminiVideoAnalysis cast (Omni-only extensions, not on the base GeminiAnalysis type).
 */
function formatGeminiSignals(analysis: GeminiAnalysis): string {
  const sections: string[] = [];
  sections.push("## Perceptual Sensor Reading (objective signals — YOU interpret them; these are measurements, NOT grades)");

  const hook = (analysis as unknown as { hook_decomposition?: HookDecomposition | null }).hook_decomposition;
  if (hook) {
    sections.push("\n**Hook modalities (0-10 perceptual strength, first ~3s):**");
    sections.push(`- Visual stop power: ${hook.visual_stop_power}`);
    sections.push(`- Audio hook: ${hook.audio_hook_quality ?? "n/a (no audio)"}`);
    sections.push(`- On-screen text: ${hook.text_overlay_score}`);
    sections.push(`- First-words speech: ${hook.first_words_speech_score ?? "n/a (no speech)"}`);
    sections.push(`- Weakest modality: ${hook.weakest_modality}`);
    sections.push(`- Visual/audio coherence: ${hook.visual_audio_coherence}`);
    sections.push(`- Cognitive load (higher = harder to follow): ${hook.cognitive_load}`);
  }

  if (analysis.video_signals) {
    const v = analysis.video_signals;
    sections.push("\n**Production signals (0-10 perceptual):**");
    sections.push(`- Visual production quality: ${v.visual_production_quality}`);
    sections.push(`- Hook visual impact: ${v.hook_visual_impact}`);
    sections.push(`- Pacing: ${v.pacing_score}`);
    sections.push(`- Transition quality: ${v.transition_quality}`);
  }

  if (analysis.audio_signals) {
    const a = analysis.audio_signals;
    sections.push("\n**Audio reading:**");
    sections.push(`- Description: ${a.audio_description}`);
    if (a.voice_clarity_0_10 != null) sections.push(`- Voice clarity: ${a.voice_clarity_0_10}/10`);
    if (a.audio_hook_first_2s_0_10 != null) sections.push(`- Audio hook (first 2s): ${a.audio_hook_first_2s_0_10}/10`);
    sections.push(`- Mix: ${Math.round(a.voiceover_ratio * 100)}% voice / ${Math.round(a.music_ratio * 100)}% music / ${Math.round(a.silence_ratio * 100)}% silence`);
  }

  const arc = (analysis as unknown as { emotion_arc?: { timestamp_ms: number; intensity_0_1: number; label?: string }[] | null }).emotion_arc;
  if (arc && arc.length > 0) {
    const curve = arc
      .map((p) => `${Math.round(p.timestamp_ms / 1000)}s:${p.intensity_0_1.toFixed(2)}${p.label ? `(${p.label})` : ""}`)
      .join("  ");
    sections.push(`\n**Emotional intensity curve:** ${curve}`);
  }

  return sections.join("\n");
}

/**
 * Build the VOLATILE user message containing all per-request dynamic content.
 *
 * Apollo Reasoner reframe (Plan 03-02): the system prompt is APOLLO_SYSTEM_PROMPT
 * (the knowledge core — byte-stable, cached). This function builds only the
 * per-request dynamic portion: verbatim hook/segments, Omni sensor signals,
 * creator context, trend context, and platform target.
 *
 * Per RESEARCH Pitfall 1: ZERO dynamic content in the system prefix.
 * Per RESEARCH Pitfall 4: verbatim hook MUST appear in the user message so the model
 * can copy it into `original` — instruct "copy the hook line VERBATIM into each rewrite's `original`".
 */
// Exported for the prompt-contract guard test (deepseek.test.ts): the live LLM
// reads this user-message blueprint, so it must stay in sync with the D-01
// schema (each dimension carries a required band-anchored `score`).
export function buildDeepSeekUserMessage(context: DeepSeekInput): string {
  const sections: string[] = [];

  // ── Verbatim hook + segments (R2 load-bearing) ───────────────────────────
  // Fed in the VOLATILE user message ONLY — never the system prefix.
  // The model is instructed to copy the hook line verbatim into each rewrite's `original`.
  if (context.verbatim?.hook) {
    const hook = context.verbatim.hook;
    sections.push("## Verbatim Hook (copy EXACTLY into each rewrite's `original` field)");
    if (hook.spoken_words) {
      sections.push(`Spoken: ${hook.spoken_words}`);
    }
    if (hook.on_screen_text) {
      sections.push(`On-screen: ${hook.on_screen_text}`);
    }
    sections.push(
      "\n> INSTRUCTION: Copy the spoken hook line VERBATIM into each rewrite's `original` field. Do NOT paraphrase, re-case, or rephrase it."
    );
    sections.push("");
  }

  if (context.verbatim?.segments && context.verbatim.segments.length > 0) {
    sections.push("## Verbatim Segments");
    for (const seg of context.verbatim.segments) {
      sections.push(`[${seg.idx}] Spoken: ${seg.spoken_text} | On-screen: ${seg.on_screen_text}`);
    }
    sections.push("");
  }

  // ── Content being analyzed ────────────────────────────────────────────────
  sections.push("## Content to Analyze");
  sections.push(`Content type: ${context.input.content_type}`);
  sections.push(`Content:\n${context.input.content_text}`);
  sections.push("");

  // ── Omni sensor signals (qualitative only, no scores) ────────────────────
  sections.push("---");
  sections.push(formatGeminiSignals(context.gemini_analysis));
  sections.push("");

  // ── Creator context ──────────────────────────────────────────────────────
  // T3.2 (2026-06-06): the "## Rule Matches" + "## Trend Context" sections were
  // DELETED — both stages were removed from the pipeline, so they injected dead
  // text ("Matched rules: None", "Trend analysis running in parallel…") that
  // described phantom systems and risked the model weighting a non-existent trend
  // lever. rule_result/trend_enrichment are still accepted on DeepSeekInput (passed
  // by the pipeline) but no longer rendered. Creator context (real) is preserved.
  if (context.creator_context) {
    sections.push("---");
    sections.push(context.creator_context);
    sections.push("");
  }

  // ── JSON OUTPUT CONTRACT (machine shape for the §4 narrative) ─────────────
  // The system prefix (§4) describes WHAT to assess; this enumerates the exact
  // JSON object DeepSeekResponseSchema requires. Lives in the volatile user
  // message so the cached system prefix (apollo-core.ts) stays byte-stable.
  // The request also sets response_format: { type: "json_object" }.
  //
  // T3.3 (2026-06-07): on video runs the fold owns behavioral_predictions, so we drop
  // the ask (Apollo spent output tokens + reasoning on 4 discarded numbers). In
  // text/tiktok_url mode (videoUrl null → no fold) Apollo IS the behavioral source, so
  // the block stays. videoUrl presence aligns with fold presence (both gated on omni video).
  const isVideoMode = context.videoUrl != null;
  const behavioralPredictionsBlock = isVideoMode
    ? ""
    : `  "behavioral_predictions": {
    "completion_pct": <number 0-100>,   // est. % who watch to the end
    "share_pct": <number 0-100>,
    "comment_pct": <number 0-100>,
    "save_pct": <number 0-100>
  },
`;
  sections.push("---");
  sections.push(
    `## OUTPUT — return ONE JSON object, no prose, with EXACTLY these keys:

{
${behavioralPredictionsBlock}  "component_scores": {                  // your 0-10 estimate per lever, grounded in the signals
    "hook_effectiveness": <number 0-10>,
    "retention_strength": <number 0-10>,
    "shareability": <number 0-10>,
    "comment_provocation": <number 0-10>,
    "save_worthiness": <number 0-10>,
    "trend_alignment": <number 0-10>,
    "originality": <number 0-10>
  },
  "suggestions": [                       // ≥1; lead with the §4 highest-leverage fix (priority "high")
    { "text": "<actionable fix tied to a §2/§3 lever>", "priority": "high"|"medium"|"low", "category": "<short tag>" }
  ],
  "confidence": "high"|"medium"|"low",   // overall assessment confidence
  "dimensions": [                        // EXACTLY 6, one per name below, in this order. "score" is REQUIRED and MUST use the fixed band anchors: strong→85, mid→50, weak→20 (do NOT deviate — this fixed mapping is what makes the composite deterministic, §4).
    { "name": "hook",        "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever that fired/failed>", "evidence": "<quoted sensor signal>" },
    { "name": "retention",   "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "clarity",     "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "share_pull",  "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "substance",   "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "credibility", "band": "strong"|"mid"|"weak", "score": 85|50|20, "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" }
  ],
  "ceiling_capper": "<one sentence naming the single thing capping the score; note any §3 anti-pattern present>",
  "confidence_scope": "<which §2 signals the sensor could NOT provide, lowering confidence>",
  "rewrites": [                          // 2-3 directional hook variants
    { "original": "<the verbatim hook line above, copied EXACTLY>", "variant": "<rewritten hook>", "lever_fixed": "<the §2 lever this variant fixes — a DIFFERENT lever per rewrite>" }
  ],
  "platform_note": "<optional: watermark/cross-post warning, or omit>"
}

Rules: "dimensions" is an ARRAY of exactly 6 objects (not an object map). Every "rewrites[].original" MUST be the verbatim hook line above, byte-for-byte. Each "rewrites[].lever_fixed" MUST name a different §2 lever. Cite §-numbers ONLY inside "lever"/"evidence"/"lever_fixed" — NEVER inside "ceiling_capper", "confidence_scope", "suggestions", or rewrite "variant" (those are user-facing prose; name the lever in plain words there, e.g. "the curiosity gap" not "§2.1"). Return ONLY the JSON object.`
  );

  return sections.join("\n");
}

export interface DeepSeekInput {
  input: AnalysisInput;
  gemini_analysis: GeminiAnalysis;
  rule_result: RuleScoreResult;
  trend_enrichment: TrendEnrichment;
  creator_context?: string;
  /**
   * P2 verbatim payload — threaded into the volatile user message so Apollo
   * can quote the real hook line in each rewrite's `original` (R2).
   * Optional: aggregator wires it in Plan 04; accepted optionally until then.
   */
  verbatim?: VerbatimPayload | null;
  /**
   * Signed video URL (2026-06-06 sighted reasoner). When present, prepended to the
   * volatile user message so qwen3.6-plus WATCHES the video and grades the hook with
   * eyes instead of reasoning blind over the read's text. The read still supplies the
   * audio half (qwen3.6-plus is deaf): transcript + audio_signals. Null in
   * text/tiktok_url mode → reason runs text-only (byte-identical to the pre-video path).
   */
  videoUrl?: string | null;
}

/**
 * Apollo Reasoner — reframed from the generic 5-step reasoner (Plan 03-02).
 *
 * Uses the shared APOLLO_SYSTEM_PROMPT (knowledge core, §4 output contract) as
 * the byte-stable cached system prefix. Emits 6 dimensions + composite 0–100 +
 * 2–3 verbatim-grounded hook rewrites in one deterministic call (D-10).
 *
 * Returns null if circuit breaker is open.
 */
export async function reasonWithDeepSeek(
  context: DeepSeekInput,
  opts?: { thinkingBudgetOverride?: number },
): Promise<{ reasoning: DeepSeekReasoning; cost_cents: number } | null> {
  // Circuit breaker check
  if (isCircuitOpen()) {
    return null;
  }

  // Thinking budget: explicit override (experimentation/sweep harness) > env > default.
  const thinkingBudget = opts?.thinkingBudgetOverride ?? DEEPSEEK_THINKING_BUDGET;

  const startTime = performance.now();
  const ai = getQwenClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // Retry-nudge on the USER message only (Pattern 3) — keeps the byte-stable
      // system prefix intact across retries (preserves DashScope prefix-cache hit).
      const baseUserMessage = buildDeepSeekUserMessage(context);
      const userMessage =
        attempt === 0
          ? baseUserMessage
          : `Your previous response was not valid JSON. Return ONLY the JSON object with no extra text.\n\n${baseUserMessage}`;

      // Apollo call: byte-stable system prefix (APOLLO_SYSTEM_PROMPT) + volatile user message.
      // temp:0 + seed for determinism (D-10). json_object for structured output.
      // Sighted reasoner (2026-06-06): when a video URL is present, prepend it so qwen3.6-plus
      // WATCHES the hook it grades. The system prefix stays byte-stable → DashScope prefix-cache
      // still hits; only the (already-volatile) user message carries the video. Null → string
      // user message, byte-identical to the pre-video path (preserves text/tiktok_url behavior).
      const userContent = context.videoUrl
        ? [
            { type: "video_url" as const, video_url: { url: context.videoUrl } },
            { type: "text" as const, text: userMessage },
          ]
        : userMessage;
      const response = await ai.chat.completions.create(
        {
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: APOLLO_SYSTEM_PROMPT }, // byte-stable knowledge core
            { role: "user",   content: userContent as never },  // verbatim + sensor signals (+ video) here ONLY
          ],
          response_format: { type: "json_object" },
          temperature: 0, // D-10: single deterministic call
          seed: QWEN_SEED,
          // Bound generation so the single Apollo call lands under TIMEOUT_MS on the
          // full KNOWLEDGE_CORE prefix (mirrors pass2/decode/stage11). Without these
          // the reasoning model emits unbounded CoT and times out (>90s). Sized up
          // vs decode (1200) because Apollo emits a larger §4 JSON object.
          max_tokens: 3000,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types
          enable_thinking: true,
          thinking_budget: thinkingBudget,
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const raw  = response.choices[0]?.message?.content ?? "";
      const text = stripModelOutput(raw);
      // Post-parse backstop: assert dims===6, clamp composite 0-100, R2 original check
      const reasoning = parseDeepSeekResponse(text, context.verbatim);

      recordSuccess();

      const cost_cents = calculateCost(DEEPSEEK_MODEL, response.usage ?? undefined);

      if (cost_cents > 1.0) {
        log.warn("Reasoning cost exceeds soft cap", {
          cost_cents: +cost_cents.toFixed(4),
          soft_cap: 1.0,
        });
      }

      const duration_ms = Math.round(performance.now() - startTime);
      log.info("Apollo reasoning complete", {
        stage: "deepseek_reasoning",
        duration_ms,
        cost_cents: +cost_cents.toFixed(4),
        model: DEEPSEEK_MODEL,
      });

      Sentry.addBreadcrumb({
        category: "engine.deepseek",
        message: "Apollo reasoning complete",
        level: "info",
        data: { duration_ms, cost_cents: +cost_cents.toFixed(4), model: DEEPSEEK_MODEL },
      });

      return { reasoning, cost_cents };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        recordFailure();
        log.warn("DeepSeek request timed out", { timeout_ms: TIMEOUT_MS, attempt });
        break; // Fall through instead of throwing
      }
      // Retry on parse/validation errors, but record API failures
      if (
        lastError.message.includes("timeout") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("503") ||
        lastError.message.includes("429")
      ) {
        recordFailure();
      }
      if (attempt === MAX_RETRIES) break;
      // Exponential backoff: 1s, 3s
      const delay = attempt === 0 ? 1000 : 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  recordFailure();
  log.error("Apollo reasoning failed after retries", {
    attempts: MAX_RETRIES + 1,
    error: lastError?.message,
  });
  Sentry.captureException(lastError, {
    tags: { stage: "deepseek_reasoning" },
  });

  // No fallback — circuit breaker failure returns null; caller handles graceful degradation.
  log.warn("Apollo reasoning failed after all retries — returning null");
  return null;
}

/** @internal -- test use only. Resets circuit breaker to closed state. */
export function resetCircuitBreaker(): void {
  breaker = {
    status: "closed",
    consecutiveFailures: 0,
    nextRetryAt: 0,
    backoffIndex: 0,
  };
  probeInFlight = false; // HARD-04: clear probe mutex for test isolation
}

export { DEEPSEEK_MODEL, isCircuitOpen };
