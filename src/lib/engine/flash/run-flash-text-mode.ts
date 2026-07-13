/**
 * SIM-1 Flash — runFlashTextMode (Plan 01-03 Task 2).
 *
 * Fires ONE bounded Qwen json_object call returning 10 per-persona verdicts + quotes.
 * Returns whole (no streaming) — P1 Pitfall #6 / A3.
 *
 * HARD ISOLATION (Pitfall #2):
 * This module imports ONLY from:
 *   - flash/* (flash-schema.ts, flash-prompts.ts)
 *   - wave3/persona-registry.ts (D-05 — data-driven personas)
 *   - qwen/client.ts (getQwenClient, QWEN_SEED, QWEN_REASONING_MODEL)
 *   - utils/strip (stripModelOutput)
 * It MUST NOT import pipeline.ts, aggregator.ts, version.ts, or any wave3/fold*.ts.
 *
 * Call envelope mirrors runFold (wave3/fold.ts):
 *   getQwenClient + AbortController + temperature:0 + seed:QWEN_SEED +
 *   response_format:json_object + stripModelOutput → coerceFlashResponse → safeParse.
 * Model is resolved behind FLASH_MODEL env, defaulting to QWEN_REASONING_MODEL (qwen3.7-plus).
 */

import { getQwenClient, QWEN_SEED, QWEN_REASONING_MODEL } from "../qwen/client";
import { stripModelOutput } from "../utils/strip";
import {
  FlashResultSchema,
  coerceFlashResponse,
  coerceFlashBatchResponse,
} from "./flash-schema";
import type { FlashResult } from "./flash-schema";
import {
  buildFlashUserContent,
  buildGenericSystemPrompt,
  buildNicheAwareSystemPrompt,
  buildFlashBatchSystemPrompt,
  buildFlashBatchUserContent,
} from "./flash-prompts";
import type { FlashFraming, NichePanel, IntentLens, DomainLens } from "./flash-prompts";
import type { ContentTypeSlug } from "../types";

// Re-export FlashFraming, NichePanel, IntentLens and DomainLens so callers can import them here
export type { FlashFraming, NichePanel, IntentLens, DomainLens };
// Re-export ContentTypeSlug for convenience (D-05 callers need it for the panel)
export type { ContentTypeSlug };

// ─── Model resolution (FLASH_MODEL env seam — Open Q1 / A2) ──────────────────
// FLASH_MODEL env lets the operator substitute a different model for testing.
// Defaults to QWEN_REASONING_MODEL (qwen3.7-plus). 3.6-flash was retired platform-wide
// (2026-06-25): with thinking OFF the plus/flash latency gap is small while plus holds
// persona reactions far more distinct. The SIM badge "sim1-flash" stays a PRODUCT label
// (flash = text-only call; max = with-video) — it is NOT the underlying model id (D-09/D-10).

const FLASH_MODEL = process.env.FLASH_MODEL ?? QWEN_REASONING_MODEL;

// ─── Timeout (mirrors fold.ts PER_CALL_TIMEOUT_MS) ───────────────────────────
// Flash is a single bounded JSON call (~8–17s on flash models).
// 60s is generous; trim if needed for latency budget in future phases.

const PER_CALL_TIMEOUT_MS = 60_000;

// ─── FlashRunResult ──────────────────────────────────────────────────────────

export interface FlashRunResult {
  result: FlashResult;
  warnings: string[];
}

// ─── runFlashTextMode ────────────────────────────────────────────────────────

/**
 * Fire ONE bounded Qwen json_object call returning all 10 archetype persona
 * verdicts + quotes for the provided TEXT content.
 *
 * Mirrors the runFold bounded-call envelope:
 *   - getQwenClient (Qwen/DashScope OpenAI-compatible client)
 *   - AbortController timeout (PER_CALL_TIMEOUT_MS)
 *   - temperature:0 + seed:QWEN_SEED (determinism R8)
 *   - response_format: json_object
 *   - stripModelOutput → coerceFlashResponse → FlashResultSchema.safeParse
 *
 * @param content_text    The creator's text content to react to.
 * @param framing         Mode framing — swaps persona question + band verbiage (D-04).
 * @param panel           Optional niche panel (D-05, Plan 03-01). When present and panel.niche
 *                        is non-null, the system prompt is built via buildNicheAwareSystemPrompt,
 *                        folding selectPersonaSlots output into one niche-instantiated prompt.
 *                        When absent or panel.niche is null → byte-identical to STABLE_FLASH_SYSTEM_PROMPT
 *                        (back-compat; existing behavior unchanged).
 * @param audienceRepaint Optional per-audience archetype description overrides (07-04 / AUD-04).
 *                        When provided (and panel.niche is non-null), folds the stored per-audience
 *                        repaint into buildNicheAwareSystemPrompt — deterministic per audience.
 *                        When absent → byte-identical no-op (General regression gate preserved).
 * @param intent          Optional per-run reaction lens (GAP-C2 / §P.10). `sell` re-frames the
 *                        verdict toward purchase intent via a user-message directive; `grow`/undefined
 *                        → byte-identical no-op. Only the USER message changes — the system-prompt
 *                        cache prefix (D-17) and ENGINE_VERSION are untouched.
 * @param domain          Optional reaction FRAME (MODE-01). `general` swaps the TikTok-FYP population
 *                        + question for a merit-judging panel (a `mode: 'general'` audience is not a
 *                        crowd scrolling a feed). `socials`/undefined → byte-identical no-op.
 * @returns FlashRunResult with parsed FlashResult and any warnings.
 * @throws if the model response fails Zod validation after coercion.
 */
export async function runFlashTextMode(
  content_text: string,
  framing: FlashFraming,
  panel?: NichePanel,
  audienceRepaint?: Record<string, string>,
  intent?: IntentLens,
  domain: DomainLens = "socials",
): Promise<FlashRunResult> {
  const ai = getQwenClient();
  const warnings: string[] = [];

  // Resolve system prompt: niche-aware if a panel with a non-null niche is provided (D-05),
  // otherwise the generic prompt — which now ALSO honours audienceRepaint (MODE-01).
  //
  // It did not before, and that was the steering bug: the Read passes `niche: null`, so it took
  // this branch and got STABLE_FLASH_SYSTEM_PROMPT with the repaint silently dropped. Every
  // audience therefore ran the byte-identical General prompt, and the "two-audience Read"
  // compared General to General with one side relabelled (live-verified: 10/10 identical verdicts).
  // No repaint + socials domain → still the interned STABLE constant (General regression gate).
  const systemPrompt =
    panel && panel.niche !== null
      ? buildNicheAwareSystemPrompt(panel, audienceRepaint, domain)
      : buildGenericSystemPrompt(audienceRepaint, domain);

  const callParams = {
    model: FLASH_MODEL,
    messages: [
      {
        role: "system" as const,
        content: systemPrompt, // byte-stable per {niche × contentType} tuple (D-17/D-05)
      },
      {
        role: "user" as const,
        content: buildFlashUserContent(content_text, framing, intent, domain),
      },
    ],
    response_format: { type: "json_object" as const },
  };

  // @ts-expect-error — temperature:0 + seed = reproducible results (R8, mirrors fold.ts)
  callParams.temperature = 0;
  // @ts-expect-error — seed pins residual nondeterminism (R8)
  callParams.seed = QWEN_SEED;
  // @ts-expect-error — DashScope extension: disable chain-of-thought. The SIM is a scoring
  // task (verdict + quote), NOT reasoning — thinking added ~37s of fixed latency (live-measured
  // ~55s→~15s on the batched path) with no diversity/independence gain. Keeps determinism.
  callParams.enable_thinking = false;
  // @ts-expect-error — max_tokens not in the inferred callParams literal type; standard OpenAI field
  callParams.max_tokens = 1000; // safety rail: measured ~400–500 output, ×2 headroom

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  let response;
  try {
    response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    const isTimeout = error.name === "AbortError";
    throw new Error(
      isTimeout
        ? `runFlashTextMode: call aborted (timeout ${PER_CALL_TIMEOUT_MS}ms)`
        : `runFlashTextMode: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  // ROBUST parse: stripModelOutput removes <think>/fences + extracts first balanced JSON
  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripModelOutput(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`runFlashTextMode: JSON.parse failed on model output: ${text.slice(0, 200)}`);
  }

  // Coerce small-model sloppiness (bare array, verdict casing, fences) before Zod.
  const coerced = coerceFlashResponse(parsed);

  // Validate at the model boundary (T-04-01 pattern)
  const validated = FlashResultSchema.safeParse(coerced);
  if (!validated.success) {
    throw new Error(
      `runFlashTextMode: FlashResultSchema validation failed — ${validated.error.message}`,
    );
  }

  return { result: validated.data, warnings };
}

// ─── runFlashTextModeBatch (S3′ — generate-rate-rank) ────────────────────────────

export interface FlashBatchRunResult {
  /** Per-candidate FlashResult, keyed by the candidate id. A candidate that fails
   *  validation is ABSENT from the map (per-candidate salvage — never nukes the batch). */
  results: Map<string, FlashResult>;
  warnings: string[];
}

// With enable_thinking:false the batched call is ~15s live-measured (N=5 → 14–18s; thinking
// ON was ~55s). 90s is a generous ceiling, not an expected wait — it bounds a stalled call.
const BATCH_TIMEOUT_MS = 90_000;

/**
 * Fire ONE bounded Qwen json_object call that scores ALL candidates (each by the 10
 * archetypes) in a single response. Same determinism envelope as runFlashTextMode
 * (temp:0 + seed + json_object + strip + coerce + zod), but per-candidate salvage:
 * a malformed/short candidate drops ITSELF (absent from the returned map) rather than
 * failing the whole batch (mirrors the per-call `.catch(() => null)` of the old fan-out).
 *
 * The N=1 runFlashTextMode is kept as-is for the react modal + script + the single paths.
 *
 * @param candidates  Drafts to score — each needs a STABLE id (echoed by the model, used to map back).
 * @param framing     hook | idea | chat (D-04 — swaps the per-candidate question + band verbiage).
 * @param panel       Optional niche panel (D-05). niche !== null → niche-instantiated batched prompt.
 * @param audienceRepaint  Optional per-audience archetype overrides (07-04 / AUD-04).
 * @param intent      Optional per-run lens (`sell`); grow/undefined → byte-identical no-op.
 */
export async function runFlashTextModeBatch(
  candidates: { id: string; text: string }[],
  framing: FlashFraming,
  panel?: NichePanel,
  audienceRepaint?: Record<string, string>,
  intent?: IntentLens,
): Promise<FlashBatchRunResult> {
  const warnings: string[] = [];
  const results = new Map<string, FlashResult>();

  // Empty batch → nothing to call (defensive; runners never pass [] but keep it total).
  if (candidates.length === 0) return { results, warnings };

  const ai = getQwenClient();

  // Batched system prompt — same population block as the single path, batched output schema.
  // niche === null → generic block (General regression path); D-17 cache prefix preserved.
  const systemPrompt = buildFlashBatchSystemPrompt(panel, audienceRepaint);

  const callParams = {
    model: FLASH_MODEL,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: buildFlashBatchUserContent(candidates, framing, intent) },
    ],
    response_format: { type: "json_object" as const },
  };

  // @ts-expect-error — temperature:0 + seed = reproducible results (R8, mirrors runFlashTextMode)
  callParams.temperature = 0;
  // @ts-expect-error — seed pins residual nondeterminism (R8)
  callParams.seed = QWEN_SEED;
  // @ts-expect-error — DashScope extension: disable chain-of-thought (scoring task, not reasoning).
  // Live-measured ~55s→~15s with same/better diversity + independence. Determinism preserved.
  callParams.enable_thinking = false;
  // @ts-expect-error — max_tokens not in the inferred callParams literal type; standard OpenAI field
  callParams.max_tokens = 3500; // safety rail: measured ~1.9k @ N=5, ×~1.8 headroom

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);

  let response;
  try {
    response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    const isTimeout = error.name === "AbortError";
    throw new Error(
      isTimeout
        ? `runFlashTextModeBatch: call aborted (timeout ${BATCH_TIMEOUT_MS}ms)`
        : `runFlashTextModeBatch: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripModelOutput(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Whole-response parse failure → no candidate survives (all dropped → runners treat as failed SIM).
    warnings.push(
      `runFlashTextModeBatch: JSON.parse failed on model output: ${text.slice(0, 200)}`,
    );
    return { results, warnings };
  }

  // Normalize to one entry per expected id (id-echo, positional fallback), then validate EACH
  // candidate independently so one bad candidate drops itself (not the batch).
  const ids = candidates.map((c) => c.id);
  const perCandidate = coerceFlashBatchResponse(parsed, ids);

  for (const { id, personas } of perCandidate) {
    const coerced = coerceFlashResponse({ personas });
    const validated = FlashResultSchema.safeParse(coerced);
    if (validated.success) {
      results.set(id, validated.data);
    } else {
      warnings.push(`runFlashTextModeBatch: candidate "${id}" failed validation — dropped`);
    }
  }

  return { results, warnings };
}
