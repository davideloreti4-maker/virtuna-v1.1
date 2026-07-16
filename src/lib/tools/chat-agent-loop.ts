/**
 * chat-agent-loop.ts — the single STREAMING agent loop (the ChatGPT/Claude-native chat path).
 *
 * Replaces the flag-on two-to-three-call chat path (runSkillDispatch's discarded pre-flight →
 * runChatPipeline → its own corpus scout) with ONE streaming completion that has the skills + the
 * corpus search bound as tools. The model STREAMS its answer directly (token-by-token via onToken) and
 * only pauses to call a tool — a content skill (its cards stream via onBlock) or `search_corpus`
 * (grounding, whose rows feed back into the next streamed round). No pre-flight, no discarded answer.
 *
 * Proven viable by scripts/spike-stream-tools.ts: DashScope streams `delta.tool_calls` in fragments
 * (accumulate by index) and text token-by-token; the two never co-occur in one delta.
 *
 * Reuses: the SKILL_TOOLS registry + adapters + paid-engine leash (skill-dispatch.ts), and
 * SEARCH_CORPUS_TOOL + executeCorpusSearch (corpus-tool.ts). The streaming completion is an injectable
 * seam (`deps.streamComplete`) so the whole loop is unit-tested with a mock chunk stream, network-free.
 */

import {
  SKILL_TOOLS,
  type SkillTool,
  type SkillToolArgs,
  type SkillRunContext,
  type SkillRunOutput,
} from "@/lib/tools/skill-dispatch";
import { SEARCH_CORPUS_TOOL, executeCorpusSearch } from "@/lib/grounding/corpus-tool";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";

// ─── Streaming completion seam ───────────────────────────────────────────────

/** One streamed chunk (the OpenAI/DashScope streaming delta shape we consume). */
export interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

/** A streaming completion: params in → an async-iterable of chunks out. Injectable for tests. */
export type StreamingChatComplete = (params: Record<string, unknown>) => Promise<AsyncIterable<StreamChunk>>;

const defaultStreamComplete: StreamingChatComplete = async (params) => {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { getQwenClient } = require("@/lib/engine/qwen/client");
  return getQwenClient().chat.completions.create({ ...params, stream: true });
};

// ─── Public types ────────────────────────────────────────────────────────────

export interface ChatAgentStreamInput {
  /** The creator's message this turn. */
  ask: string;
  /** Shared skill context (platform, profileRow, audience, onStage) — same shape the skills already use. */
  context: SkillRunContext;
  /** The fully-built system prompt (KC chat prompt + cheap assembleBundle grounding), built by the route. */
  systemPrompt: string;
  /** Prior conversation turns (role + text), oldest→newest. */
  priorTurns?: Array<{ role: "user" | "assistant"; text: string }>;
  /** Bind the corpus search tool (grounding-as-a-tool). Gated by GROUNDING_CHAT_TOOL at the route. */
  grounding?: boolean;
  /** Streamed answer tokens, in order. */
  onToken: (delta: string) => void;
  /** A skill's card-block, as it is produced (streamed to the client + collected for persistence). */
  onBlock: (block: unknown) => void;
}

export interface ChatAgentStreamResult {
  /** The full streamed assistant text (for persistence as a markdown turn). */
  text: string;
  /** Each skill that ran, with its block-cards (the route persists these). */
  skillRuns: SkillRunOutput[];
  /** Telemetry: every tool the model called. */
  toolCalls: Array<{ name: string; ran: boolean; note?: string }>;
}

export interface ChatAgentStreamDeps {
  streamComplete?: StreamingChatComplete;
  skills?: SkillTool[];
  executeCorpus?: typeof executeCorpusSearch;
  retrieve?: typeof retrieveCachedExamples;
  model?: string;
  seed?: number;
  maxRounds?: number;
  /** Paid-engine leash: skill invocations per turn (skills hit the paid engine). */
  maxSkillRuns?: number;
}

const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_SKILL_RUNS = 2;

/**
 * The tool-use directive the loop appends to the caller's system prompt. The loop OWNS this because it
 * owns the tools — the caller's prompt (e.g. KC_CHAT_SYSTEM_PROMPT) grounds voice/chat but says nothing
 * about the bound tools, so without this the model just writes the content inline instead of calling a
 * skill (observed live). The corpus line is added only when grounding is on (the tool is otherwise not
 * bound — naming an unbound tool invites a call that can't be serviced).
 */
function toolUseDirective(grounding: boolean): string {
  const base =
    "You also have TOOLS. When the creator asks you to MAKE content, call the matching skill tool instead " +
    "of writing it yourself — generate_ideas / generate_hooks / write_script (pass the `topic`); the tool " +
    "produces rich cards shown to the creator. To TEST a specific drafted message the creator already has, " +
    "or to forecast a scenario, call simulate_reaction / predict_outcome (pass the `draft`). Call a tool " +
    "ONLY when it fits the ask; if the creator is just talking or asking strategy, answer conversationally " +
    "— do not call a tool they didn't ask for. After a tool runs, its cards are already shown to the " +
    "creator; add ONE short line pointing at what you made and a natural next step, and never re-write the " +
    "card content in prose.";
  const groundLine = grounding
    ? " When a real, proven real-world example would make a strategy answer stronger, call search_corpus " +
      "and ground your answer on what it returns."
    : "";
  return base + groundLine;
}

/** Parse the model's tool args into the union both skill shapes read (generators: topic; analysis: draft). */
function parseSkillArgs(raw: string): SkillToolArgs {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      topic: p.topic != null ? String(p.topic).trim() : undefined,
      anchor: p.anchor,
      draft: p.draft != null ? String(p.draft).trim() : undefined,
    };
  } catch {
    return {};
  }
}

// ─── The loop ────────────────────────────────────────────────────────────────

/**
 * Stream a chat turn as an agent loop: the model streams its answer and may call skills / search_corpus
 * mid-conversation. Returns the streamed text + the skill cards (already emitted via onBlock) for the
 * route to persist. Paid skill runs are capped; tool errors are absorbed into tool results the model
 * relays (never thrown out of the loop).
 */
export async function runChatAgentStream(
  input: ChatAgentStreamInput,
  deps: ChatAgentStreamDeps = {},
): Promise<ChatAgentStreamResult> {
  const skills = deps.skills ?? SKILL_TOOLS;
  const streamComplete = deps.streamComplete ?? defaultStreamComplete;
  const executeCorpus = deps.executeCorpus ?? executeCorpusSearch;
  const retrieve = deps.retrieve ?? retrieveCachedExamples;
  const maxRounds = deps.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const maxSkillRuns = deps.maxSkillRuns ?? DEFAULT_MAX_SKILL_RUNS;
  let model = deps.model;
  let seed = deps.seed;
  if (model === undefined || seed === undefined) {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const client = require("@/lib/engine/qwen/client");
    model = model ?? client.QWEN_REASONING_MODEL;
    seed = seed ?? client.QWEN_SEED;
  }

  const byName = new Map(skills.map((s) => [s.name, s]));
  const tools = [...skills.map((s) => s.schema), ...(input.grounding ? [SEARCH_CORPUS_TOOL] : [])];

  // The caller's prompt grounds voice/chat; the loop appends the tool-use directive (it owns the tools).
  const systemContent = `${input.systemPrompt}\n\n${toolUseDirective(!!input.grounding)}`;
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemContent },
    ...(input.priorTurns ?? []).map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: input.ask },
  ];

  const skillRuns: SkillRunOutput[] = [];
  const toolCalls: ChatAgentStreamResult["toolCalls"] = [];
  let paidRuns = 0;
  let fullText = "";

  for (let round = 1; round <= maxRounds; round++) {
    const stream = await streamComplete({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      seed,
      max_tokens: 2000,
      enable_thinking: false,
    });

    // Accumulate the round: text streams straight through; tool-call fragments accumulate by index.
    let roundText = "";
    const toolAcc = new Map<number, { id?: string; name?: string; args: string }>();
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        roundText += delta.content;
        input.onToken(delta.content);
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const acc = toolAcc.get(idx) ?? { args: "" };
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
          toolAcc.set(idx, acc);
        }
      }
    }
    fullText += roundText;

    // Resolve the round's calls (ids stable so the assistant message + tool results line up).
    const calls = [...toolAcc.values()]
      .filter((c) => c.name)
      .map((c, i) => ({ id: c.id ?? `call_${round}_${i}`, name: c.name as string, args: c.args }));

    const assistantMsg: Record<string, unknown> = { role: "assistant", content: roundText || null };
    if (calls.length > 0) {
      assistantMsg.tool_calls = calls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.args || "{}" },
      }));
    }
    messages.push(assistantMsg);

    // No tool call → the model answered; the loop is done.
    if (calls.length === 0) break;

    // Execute each call, push a role:"tool" result the next round reads.
    for (const call of calls) {
      // Grounding: the corpus search leaf (never throws) → its JSON rows feed back to the model.
      if (input.grounding && call.name === "search_corpus") {
        let parsed: { query?: unknown; axis?: unknown } = {};
        try {
          parsed = JSON.parse(call.args || "{}");
        } catch {
          parsed = {};
        }
        const res = await executeCorpus(parsed, input.context.platform, round, retrieve);
        toolCalls.push({ name: "search_corpus", ran: true });
        messages.push({ role: "tool", tool_call_id: call.id, content: res.content });
        continue;
      }

      const skill = byName.get(call.name);
      if (!skill) {
        toolCalls.push({ name: call.name, ran: false, note: "unknown skill" });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown skill" }) });
        continue;
      }
      const args = parseSkillArgs(call.args);
      const primary = skill.primaryArg ?? "topic";
      if (!args[primary]) {
        toolCalls.push({ name: skill.name, ran: false, note: `no ${primary}` });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: `no ${primary} provided` }) });
        continue;
      }
      if (skill.paid && paidRuns >= maxSkillRuns) {
        toolCalls.push({ name: skill.name, ran: false, note: "leash: run limit reached" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "skill run limit reached for this turn — ask the creator to confirm before running more" }),
        });
        continue;
      }
      try {
        const { blocks } = await skill.run(args, input.context);
        if (skill.paid) paidRuns++;
        for (const block of blocks) input.onBlock(block);
        skillRuns.push({ name: skill.name, blocks, warnings: [] });
        toolCalls.push({ name: skill.name, ran: true });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ran: skill.name, produced: `${blocks.length} card(s)`, note: "cards are shown to the creator" }),
        });
      } catch (err) {
        toolCalls.push({ name: skill.name, ran: false, note: "error" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        });
      }
    }
  }

  return { text: fullText, skillRuns, toolCalls };
}
