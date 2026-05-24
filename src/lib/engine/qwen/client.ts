import OpenAI from "openai";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

let client: OpenAI | null = null;

export function getQwenClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT });
  }
  return client;
}

// Model ID constants — env-overridable, defaults to the agreed stack.
export const QWEN_OMNI_MODEL      = process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-plus";
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.6-plus";
export const QWEN_FAST_MODEL      = process.env.QWEN_FAST_MODEL      ?? "qwen3.6-flash";
