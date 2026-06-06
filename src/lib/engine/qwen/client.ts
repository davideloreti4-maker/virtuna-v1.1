import OpenAI from "openai";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

let client: OpenAI | null = null;

export function getQwenClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    // maxRetries:0 — every engine stage owns its own retry loop (+ circuit breaker on
    // deepseek). The SDK default (2) stacks on top of those manual loops → up to 6 HTTP
    // attempts on a single Omni call. Make the app the sole retry authority: predictable
    // latency tail + cost. (Audit A2.)
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT, maxRetries: 0 });
  }
  return client;
}

/**
 * Fixed sampling seed for all scoring-critical LLM calls, paired with `temperature: 0`.
 * Together these make the engine reproducible: the same input yields the same score
 * run-to-run. This is the precondition for a trustworthy eval/weight-fit number — you
 * cannot separate model error from run-to-run sampling jitter if the scorer drifts
 * between runs. Greedy decoding (temp 0) is the primary lever; the seed pins any residual
 * nondeterminism (notably thinking-mode stages).
 */
export const QWEN_SEED = 7;

// Model ID constants — env-overridable, defaults to the agreed stack.
// Default flipped plus→flash 2026-06-06 (quick/20260605-engine-latency-quality-spine-ab):
// A/B-validated on 2 videos (easy + hard) — omni-flash HALVED the read (36→17s), held/
// improved the text substrate (richer verbatim, emotion_arc intact, correct flop detection
// on the weak-hook case) at ~5× lower GA cost. omni is the foundation the fold + Apollo
// both reason over → highest-leverage latency lever. Rollback: QWEN_OMNI_MODEL=qwen3.5-omni-plus.
export const QWEN_OMNI_MODEL      = process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-flash";
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.6-plus";
export const QWEN_FAST_MODEL      = process.env.QWEN_FAST_MODEL      ?? "qwen3.6-flash";
