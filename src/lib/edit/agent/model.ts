/**
 * model.ts — the agent's one network boundary: a call to Qwen (part 3, P1: "lets use just qwen"). The platform's reasoning
 * model (`QWEN_REASONING_MODEL`, today qwen3.7-flash) through DashScope's OpenAI-compatible API, as every engine call is made
 * (`docs/MODEL-POLICY.md`): a JSON object back, temperature 0 and the platform's seed, thinking on or off and the token budget as
 * the loop asks (X88: set from Task 14's measures). Thinking tokens count toward `max_tokens`.
 *
 * It gives back the answer's text as the model wrote it, what the call used and how long it took; the loop reads and judges the
 * text. A call that fails throws: the loop owns the retries (the client's own are off, `client.ts`).
 */
import type OpenAI from "openai";
import { QWEN_REASONING_MODEL, QWEN_SEED, getQwenClient } from "@/lib/engine/qwen/client";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "edit.agent" });

/** A message to the model: text, or text and pictures (each a `data:image/jpeg;base64,…` address), as `vision.ts` sends them. */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
};

/** The model's answer: its text, the tokens it read and wrote (DashScope's `prompt_tokens` and `completion_tokens`), and the call's time. */
export interface Asked {
  text: string;
  usage: { input: number; output: number };
  ms: number;
  /** True when the answer stopped at `maxTokens` before it was done. */
  truncated?: boolean;
}

export interface AskOptions {
  maxTokens: number;
  thinking: boolean;
  /** Stops the call: the loop passes what is left of its deadline. */
  signal?: AbortSignal;
}

export type Ask = (messages: Message[], opts: AskOptions) => Promise<Asked>;

/** `enable_thinking` is DashScope's own; the OpenAI types do not name it. */
type Params = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & { enable_thinking: boolean };

export const askQwen: Ask = async (messages, { maxTokens, thinking, signal }) => {
  const started = performance.now();
  const params: Params = {
    model: QWEN_REASONING_MODEL,
    // Our messages are a narrower shape of the API's: a system or assistant message never carries a picture.
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: QWEN_SEED,
    max_tokens: maxTokens,
    enable_thinking: thinking,
  };
  const completion = await getQwenClient().chat.completions.create(params, { signal });
  const choice = completion.choices[0];
  if (!completion.usage) log.warn("the model's answer came without its usage; counted as none", { model: QWEN_REASONING_MODEL });
  return {
    text: choice?.message?.content ?? "",
    usage: { input: completion.usage?.prompt_tokens ?? 0, output: completion.usage?.completion_tokens ?? 0 },
    ms: Math.round(performance.now() - started),
    truncated: choice?.finish_reason === "length",
  };
};
