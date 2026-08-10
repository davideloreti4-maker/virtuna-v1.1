/**
 * Lane synthesis — Phase 5 (day-0 "it finds your lane", spec §4.2).
 *
 * ONE Qwen JSON-mode call: the creator's answer to "what could you talk about for 20
 * minutes without notes?" → 2–3 DISTINCT candidate lanes. Structurally a clone of
 * adapt.ts (same client, same JSON mode, same repair-on-the-user-message retry so the
 * DashScope cache prefix stays byte-stable).
 *
 * Returns null on graceful failure — never throws. The reveal shows nothing rather than
 * a fabricated lane; a creator's identity is not a slot to fill with invention.
 *
 * ⚠️ NO EVAL YET. SSOT open owner call #8 says day-0 lane synthesis needs a real producer
 * (prompt + eval). This is the producer and its unit tests; read real output against
 * varied answers in a sandbox before this leaves CONCEPT_V8_ENABLED.
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core";
import type { Lane } from "./lane-types";

export type { Lane } from "./lane-types";

const log = createLogger({ module: "engine.lanes.synthesize" });

const TIMEOUT_MS = 60_000; // lighter than adapt — two or three short objects
const MAX_RETRIES = 1; // 2 total attempts (attempt 0 + 1 repair)

/** Spec §4.2: "2–3 candidate lanes (distinct angles)". */
export const LANE_MIN = 2;
export const LANE_MAX = 3;

export const LANE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}

---

A creator has told you the one subject they could talk about for twenty minutes without notes. Propose ${LANE_MIN}–${LANE_MAX} DISTINCT lanes they could credibly occupy inside that subject.

RULES:
- A lane is a POSTURE, not a sub-topic: the same subject seen through a different person.
- Every lane must be credible for someone who genuinely knows this subject.
- Lanes must be meaningfully different from each other — never three shades of one voice.
- Never invent biography, credentials, or a backstory the creator did not give you.

OUTPUT: Return strict JSON with this exact shape and nothing else:
{
  "lanes": [
    {
      "name": "string — the lane as a person, 2-4 words, with a leading article (e.g. \\"The numbers person\\")",
      "who": "string — what they lead with, <= 6 words, lowercase (e.g. \\"receipts, not vibes\\")",
      "niche": "string — the creator niche this lane writes for, <= 12 words, used to steer format adaptation"
    }
  ]
}
The "lanes" array MUST contain between ${LANE_MIN} and ${LANE_MAX} items.`;

const LaneZodSchema = z.object({
  name: z.string().min(1).max(60),
  who: z.string().min(1).max(80),
  niche: z.string().min(1).max(120),
});

const LanesZodSchema = z.object({
  lanes: z.array(LaneZodSchema).min(LANE_MIN).max(LANE_MAX),
});

/** Build the user turn. The answer is the creator's own words — carried verbatim. */
export function buildLaneUserContent(answer: string): string {
  return `WHAT THEY COULD TALK ABOUT FOR TWENTY MINUTES WITHOUT NOTES:
${answer.trim()}

Propose between ${LANE_MIN} and ${LANE_MAX} distinct lanes they could occupy.`;
}

/** The narrow slice of the OpenAI-shaped client this module actually calls. */
type LaneClient = {
  chat: {
    completions: {
      create: (
        body: Record<string, unknown>,
        opts?: { signal?: AbortSignal },
      ) => Promise<{ choices?: ({ message?: { content?: string | null } } | undefined)[] }>;
    };
  };
};

export interface SynthesizeLanesDeps {
  /** Injectable I/O boundary — tests swap the DashScope client; prod uses the real one. */
  client?: () => LaneClient;
}

/**
 * Synthesize 2–3 candidate lanes from the creator's answer.
 * Returns null on graceful failure (never throws).
 */
export async function synthesizeLanes(
  answer: string,
  deps: SynthesizeLanesDeps = {},
): Promise<Lane[] | null> {
  // A blank answer is not a model problem — never spend a call on it.
  if (!answer.trim()) return null;

  const getClient = deps.client ?? (getQwenClient as unknown as () => LaneClient);
  const ai = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // The repair nudge goes on the USER message, never the system one — that is what
      // preserves the byte-stable LANE_SYSTEM_PROMPT prefix for DashScope cache hits
      // across retries (same reason as adapt.ts:153).
      const extraInstruction =
        attempt > 0
          ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
          : "";

      const completion = await ai.chat.completions.create(
        {
          model: QWEN_REASONING_MODEL,
          messages: [
            { role: "system", content: LANE_SYSTEM_PROMPT },
            { role: "user", content: buildLaneUserContent(answer) + extraInstruction },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
          seed: QWEN_SEED,
          max_tokens: 700,
          enable_thinking: false,
        },
        { signal: controller.signal },
      );

      const raw = completion.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(stripModelOutput(raw)) as unknown;
      const result = LanesZodSchema.safeParse(parsed);

      if (!result.success) {
        log.warn("lane Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        continue; // → repair attempt with extraInstruction on the next loop
      }

      log.info("lanes synthesized", { attempt, count: result.data.lanes.length });
      return result.data.lanes;
    } catch (err: unknown) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("lane attempt failed", { attempt, error: String(err), isAbort });
      if (attempt >= MAX_RETRIES) break;
    } finally {
      // Clear on EVERY exit path, including the Zod-fail `continue` above — the leak
      // adapt.ts:206 documents (a stray abort firing TIMEOUT_MS after the request settled).
      clearTimeout(timer);
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "lane_synthesis" } });
  log.error("lane synthesis failed after all retries", { error: String(lastError) });
  return null;
}
