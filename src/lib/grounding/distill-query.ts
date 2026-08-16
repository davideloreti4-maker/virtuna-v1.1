/**
 * distill-query.ts — compress a long chat ask into a short-form video SEARCH QUERY.
 *
 * gather-for-run's query candidate is often the creator's entire chat message (400+ chars);
 * TikTok search treats it literally and returns topically random videos, which caps how often
 * a receipt can ever be honest. This distills "give me 3 hooks for my video about X…" down to
 * X. Degrade-safe by contract: ANY failure (throw, timeout, malformed/oversized output)
 * returns the input unchanged — retrieval never blocks on the distiller.
 */
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";

/** Queries at or under this length are already search-shaped — no LLM call. */
export const DISTILL_THRESHOLD = 80;

const MAX_DISTILLED_LEN = 60;
const DEFAULT_TIMEOUT_MS = 10_000;

const SYSTEM =
  "You turn a creator's content request into a short-form video search query. " +
  'Return JSON: { "query": string } — 3-6 words naming the VIDEO\'S SUBJECT. ' +
  "No hashtags, no quote marks inside the value, no filler words like 'video about'.";

export type DistillComplete = (system: string, user: string) => Promise<string>;

async function defaultComplete(system: string, user: string): Promise<string> {
  const ai = getQwenClient();
  const completion = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: 100,
      enable_thinking: false, // DashScope extension — thinking blows timeouts (measured)
    } as never,
  );
  return completion.choices[0]?.message?.content ?? "";
}

export async function distillSearchQuery(
  raw: string,
  deps: { complete?: DistillComplete; timeoutMs?: number } = {},
): Promise<string> {
  if (raw.length <= DISTILL_THRESHOLD) return raw;
  const complete = deps.complete ?? defaultComplete;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const out = await Promise.race([
      complete(SYSTEM, raw),
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => reject(new Error("distill timeout")), timeoutMs);
        // Node-only; no-op in edge runtimes. Keeps a resolved race from pinning the process.
        (t as { unref?: () => void }).unref?.();
      }),
    ]);
    // DashScope appends fences / <think> blocks despite response_format:json_object.
    // A bare parse would throw on those and degrade to the raw ask indistinguishably
    // from success — every other Qwen JSON call site here strips first (adapt.ts:348).
    const parsed: unknown = JSON.parse(stripModelOutput(out));
    const q =
      typeof parsed === "object" && parsed !== null && "query" in parsed
        ? (parsed as { query: unknown }).query
        : null;
    if (typeof q !== "string") return raw;
    const trimmed = q.trim();
    if (!trimmed || trimmed.length > MAX_DISTILLED_LEN || /[\r\n]/.test(trimmed)) return raw;
    return trimmed;
  } catch (err) {
    // Say so. A silent fallback here is indistinguishable in the logs from an ask that was already
    // short enough to skip the LLM — so a distiller failing 100% of the time (bad key, dead model,
    // every call timing out) reads exactly like a feature working perfectly, and the measurement
    // that depends on it reports a confident zero.
    console.warn(
      `[grounding] distill error (falling back to the raw ask): ${err instanceof Error ? err.message : String(err)}`,
    );
    return raw;
  }
}
