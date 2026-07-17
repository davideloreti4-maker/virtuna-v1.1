/**
 * Audience Sim v2 — Stage 2 content characterization (the ONE model call at test-time).
 *
 * SSOT: docs/DESIGN-2026-07-15-audience-simulation-v2.md §4.4. Maps a content candidate
 * into the SAME named axes the population reacts on (`ContentVector`) so the cheap O(N)
 * scorer (`population.ts`) can react all N sampled individuals with NO per-persona LLM
 * call. This is the only cost the population aggregate adds to a content test.
 *
 * Envelope mirrors `runFlashTextMode` (temp:0 + seed + json_object + enable_thinking:false
 * + strip → Zod) so it is deterministic and validated at the model boundary. `topicVocab`
 * is the signature's stored vocabulary — the model is told to key `topics` to it so the
 * dot product against `persona.reaction.interests` shares an axis space.
 */

import { z } from "zod";
import { getQwenClient, QWEN_SEED, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import type { ContentVector } from "./population";

const CHAR_MODEL = process.env.FLASH_MODEL ?? QWEN_REASONING_MODEL;
const PER_CALL_TIMEOUT_MS = 30_000;

const CHAR_SYSTEM = `You score a short-form video HOOK on fixed axes so an audience model can react to it.
Output STRICT JSON, no prose:
{
  "topics": { "<tag>": number },  // 0..1 how strongly the hook engages each RELEVANT topic (use the given vocab)
  "hookStrength": number,         // 0..1 how arresting the first 2 seconds are
  "novelty": number,              // 0..1 how novel / trend-forward vs familiar
  "hype": number,                 // 0..1 how much it over-promises / makes big claims
  "slowness": number              // 0..1 how slow the payoff is (0 = instant, 1 = long build)
}
All numbers in [0,1]. topics keys MUST come from the provided vocabulary.`;

// Model-boundary validation (CLAUDE.md). Coerce → clamp → default so a sloppy small-model
// response can never crash the O(N) scorer; out-of-vocab topic keys are dropped downstream
// (they simply never match a persona's interests). Missing scalars default to a neutral 0.5.
const num01 = z.coerce.number().min(0).max(1).catch(0.5);
const ContentVectorSchema = z.object({
  topics: z.record(z.string(), z.coerce.number().min(0).max(1).catch(0)).default({}),
  hookStrength: num01.default(0.5),
  novelty: num01.default(0.5),
  hype: num01.default(0.5),
  slowness: num01.default(0.5),
});

/**
 * Characterize one content candidate into the `ContentVector` axes. ONE bounded Qwen JSON
 * call (temp 0 + seed → deterministic). Throws on a call/parse failure so the caller can
 * degrade (skip the population aggregate) rather than surface a broken distribution.
 *
 * @param content    The hook / idea / draft text to score.
 * @param topicVocab The signature's `topic_vocab` — the axis space `topics` keys into.
 */
export async function characterizeContent(
  content: string,
  topicVocab: string[],
): Promise<ContentVector> {
  const ai = getQwenClient();

  const callParams = {
    model: CHAR_MODEL,
    messages: [
      { role: "system" as const, content: CHAR_SYSTEM },
      {
        role: "user" as const,
        content: `TOPIC VOCABULARY: ${topicVocab.join(", ")}\n\nHOOK: "${content}"\n\nScore it.`,
      },
    ],
    response_format: { type: "json_object" as const },
  };
  // @ts-expect-error — temperature:0 + seed = reproducible (mirrors runFlashTextMode)
  callParams.temperature = 0;
  // @ts-expect-error — seed pins residual nondeterminism
  callParams.seed = QWEN_SEED;
  // @ts-expect-error — DashScope extension: scoring task, not reasoning
  callParams.enable_thinking = false;
  // @ts-expect-error — standard OpenAI field, not in the inferred literal type
  callParams.max_tokens = 400;

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
        ? `characterizeContent: call aborted (timeout ${PER_CALL_TIMEOUT_MS}ms)`
        : `characterizeContent: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripModelOutput(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`characterizeContent: JSON.parse failed on model output: ${text.slice(0, 200)}`);
  }

  const validated = ContentVectorSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`characterizeContent: schema validation failed — ${validated.error.message}`);
  }
  return validated.data;
}
