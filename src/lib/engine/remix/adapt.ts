/**
 * Adapt generator — Phase 4 (ADAPT-01).
 *
 * Single Qwen JSON-mode call that produces exactly 3 niche-adapted concepts
 * from the structural decode output. Does NOT touch runPredictionPipeline,
 * usage_tracking, or DAILY_LIMITS (D-04 lightweight path).
 *
 * Input structural guard (D-01, Pitfall 1):
 * `buildAdaptUserContent` accepts only `AdaptInput` (4 structural beats + repeatable
 * lane + niche, produced by `decodeResultToAdaptInput`), making it a compile-time
 * error to pass `luck[]` or any caption field.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { z } from "zod";
import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core";
import type { AdaptInput, AdaptConcept } from "./decode-types";

const log = createLogger({ module: "engine.remix.adapt" });

const TIMEOUT_MS = 90_000; // 90s — adapt is lighter than omni; abort if DashScope stalls
const MAX_RETRIES = 1;     // 2 total attempts (attempt 0 + 1 repair)

// =========================================================
// System prompt — stable string for DashScope cache prefix.
// Grounded in the shared KNOWLEDGE_CORE (R12/D-11) via §6 Rewrite + §2 frameworks.
// Core is prepended so the byte-stable DashScope prefix is preserved across requests.
// NOTE: extraInstruction (retry nudge) is NOT concatenated here — it goes on the USER
//       message (buildAdaptUserContent) to preserve the cached prefix on retries (T-03-08).
// =========================================================

export const ADAPT_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}

---

Apply the §6 Rewrite Lens + §2 frameworks for FORMAT adaptation. Given the structural anatomy of a viral video (hook pattern, structure, emotional beat, repeatable format items), generate exactly 3 DISTINCT adapted concepts for the specified creator niche.

RULES:
- Adapt the FORMAT and STRUCTURE, not the content or topic of the original video.
- Each concept must be firmly grounded in the creator's niche.
- All 3 concepts must be meaningfully different from each other.
- Do NOT reference the original video's topic, subject, or content — only its format patterns.

OUTPUT: Return strict JSON with this exact shape and nothing else:
{
  "concepts": [
    {
      "hook": "string — bold, actionable headline adapted to the niche (≤ 15 words)",
      "angle": "string — the structural angle or narrative approach borrowed from the source",
      "who_its_for": "string — who in the creator's niche this concept targets",
      "format_borrowed": "string — the specific format pattern borrowed (short label, ≤ 10 words)",
      "personaStops": "number — YOUR honest estimate, 0–10, of how many of 10 target viewers would STOP scrolling on this adapted hook in the first 2 seconds",
      "stopQuote": "string — ONE short first-person line of what a viewer who stops thinks in that instant",
      "production": {
        "shots": "string — the shot list to film YOUR version of this concept",
        "onScreenText": "string — key on-screen text overlays",
        "setup": "string — gear / lighting / framing setup",
        "edit": "string — edit style"
      }
    }
  ]
}
The "concepts" array MUST contain exactly 3 items. "personaStops" is a PROJECTION you are making about the ADAPTED HOOK only (not the full video) — be discriminating, never generous: a generic hook with no real mechanism stops 0–2, a genuinely strong niche-true hook stops 7–8, reserve 9–10 for the rare undeniable one; the creator sees it as your estimate and can then measure it against their real audience, so never phrase it as a finished measurement. "production" is the READY-TO-FILM shoot plan for the creator's OWN adapted version — how to execute the borrowed format for this angle, grounded in what the concept actually needs. Never invent gear or shots the concept does not call for.`;

// =========================================================
// Zod schemas
// =========================================================

const AdaptConceptZodSchema = z.object({
  hook:            z.string().min(1).max(200),
  angle:           z.string().min(1).max(300),
  who_its_for:     z.string().min(1).max(200),
  format_borrowed: z.string().min(1).max(200),
  // PROJECTION (new Qwen call system, 2026-07-22) — the adapt call self-estimates each adapted hook's
  // stop-count (/10) + a stop-quote in place of the removed persona-SIM. OPTIONAL + coerced downstream
  // so a model that omits them (or the old /api/remix/adapt surface that never asked) still validates
  // and the 3-concept contract holds; the remix runner defaults a missing personaStops to 0 (Weak).
  personaStops: z.number().optional(),
  stopQuote:    z.string().optional(),
  // READY TO FILM (owner 2026-07-22) — OPTIONAL so a model that omits it (or returns a partial
  // block) still validates and the 3-concept contract holds; the card just renders no shoot plan.
  // shots/onScreenText/setup are required together when present; edit is optional.
  production: z
    .object({
      shots:        z.string().min(1).max(600),
      onScreenText: z.string().min(1).max(600),
      setup:        z.string().min(1).max(600),
      edit:         z.string().min(1).max(400).optional(),
    })
    .optional(),
});

const AdaptConceptsZodSchema = z.object({
  concepts: z.array(AdaptConceptZodSchema).length(3), // ADAPT-01: exactly 3
});

// =========================================================
// Input builder — accepts AdaptInput only (D-01 structural guard)
// =========================================================

/**
 * Build the Qwen user-turn content from the adapt input.
 *
 * Parameter type is `AdaptInput` (4 structural fields + repeatable lane + niche).
 * Passing `luck[]`, `content_summary`, or a raw caption is a compile-time error (Pitfall 1 guard).
 */
export function buildAdaptUserContent(input: AdaptInput): string {
  const repeatableList = input.repeatable
    .map((item, i) =>
      item.why_repeatable
        ? `  ${i + 1}. "${item.label}" — ${item.why_repeatable}`
        : `  ${i + 1}. "${item.label}"`,
    )
    .join("\n");

  return `VIRAL VIDEO STRUCTURAL ANATOMY:
Hook Pattern: ${input.hook_pattern}
Structure: ${input.structure}
The Turn: ${input.the_turn}
Emotional Beat: ${input.emotional_beat}

Repeatable Format Items (adapt these, not the content):
${repeatableList}

CREATOR NICHE: ${input.niche}

Generate exactly 3 distinct niche-adapted concepts using the format patterns above.`;
}

// =========================================================
// Main generator
// =========================================================

/**
 * Generate exactly 3 niche-adapted concepts from the structural decode output.
 *
 * Returns `null` on graceful failure (never throws). The Adapt frame shows an
 * error state when null — it does NOT propagate to the Decode frame (D-06).
 */
export async function generateAdaptConcepts(input: AdaptInput): Promise<AdaptConcept[] | null> {
  const ai = getQwenClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Retry nudge goes on the USER message (not system) to preserve the byte-stable
      // ADAPT_SYSTEM_PROMPT prefix for DashScope cache hits on retries (T-03-08).
      // Aligns with decode.ts:67 and deepseek.ts:471 patterns.
      const extraInstruction = attempt > 0
        ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
        : "";

      const completion = await ai.chat.completions.create(
        {
          model:           QWEN_REASONING_MODEL, // qwen3.6-plus — same as pass2.ts
          messages: [
            { role: "system", content: ADAPT_SYSTEM_PROMPT },
            { role: "user",   content: buildAdaptUserContent(input) + extraInstruction },
          ],
          response_format: { type: "json_object" },
          temperature:     0,         // reproducible (D-04 determinism requirement)
          seed:            QWEN_SEED, // 7
          // Bound generation: ADAPT_SYSTEM_PROMPT now carries the full KNOWLEDGE_CORE
          // (Plan 03-03), so without these the reasoning model emits unbounded CoT and
          // times out (>90s) — the same failure fixed for deepseek.ts at the 03-04
          // checkpoint. Mirrors decode.ts (1200); 3 concepts fit comfortably.
          max_tokens: 1200,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types
          enable_thinking: false,
        },
        { signal: controller.signal },
      );

      const raw     = completion.choices[0]?.message?.content ?? "";
      const cleaned = stripModelOutput(raw); // strips <think>...</think> + fences
      const parsed  = JSON.parse(cleaned) as unknown;
      const result  = AdaptConceptsZodSchema.safeParse(parsed);

      if (!result.success) {
        log.warn("adapt Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        continue; // → repair attempt with extraInstruction on next loop
      }

      // Belt-and-suspenders count guard (mirrors pass2.ts:197-200)
      if (result.data.concepts.length !== 3) {
        throw new Error(`concept count mismatch: ${result.data.concepts.length}`);
      }

      log.info("adapt concepts generated", { attempt, count: result.data.concepts.length });
      return result.data.concepts as AdaptConcept[];

    } catch (err: unknown) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("adapt attempt failed", { attempt, error: String(err), isAbort });
      if (attempt >= MAX_RETRIES) break;
    } finally {
      // #11: clear the abort timer on EVERY exit path — including the Zod-fail `continue`
      // above, which previously skipped clearTimeout and leaked the timer (a spurious
      // controller.abort() would fire TIMEOUT_MS later on the already-settled request).
      clearTimeout(timer);
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "remix_adapt" } });
  log.error("adapt generation failed after all retries", { error: String(lastError) });
  return null; // graceful failure → frame shows error state (D-06)
}
