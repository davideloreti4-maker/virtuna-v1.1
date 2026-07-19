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
import {
  SKILL_CAPABILITIES,
  SKILL_INPUT_ACTIONS,
  isSkillInputAction,
} from "@/lib/tools/skill-capabilities";

// ─── In-thread input affordance (request_input) ──────────────────────────────
// A free, non-paid tool: instead of guessing a value (a URL, a concept, a niche) or answering in
// prose, the model asks for what a skill needs by surfacing an inline FIELD in the thread. The loop
// services the call by emitting an `input-request` block (the field) — the client runs the skill on
// its OWN dedicated route on submit. Kind/label/placeholder come from SKILL_CAPABILITIES, set HERE,
// never by the model (no model-generated UI): the model only chooses WHICH action to request, and may
// pass an optional `value` to pre-fill a text field with something the creator already stated.
const REQUEST_INPUT_ACTION_LINES = SKILL_INPUT_ACTIONS.map(
  (a) => `- "${a}": when ${SKILL_CAPABILITIES[a].when}.`,
).join("\n");

export const REQUEST_INPUT_TOOL = {
  type: "function",
  function: {
    name: "request_input",
    description:
      "Surface an inline INPUT FIELD in the thread to collect what a skill needs before it runs — " +
      "instead of guessing, inventing a value, or just asking for it in prose. Call this when the " +
      "creator clearly wants one of these skills:\n" +
      REQUEST_INPUT_ACTION_LINES +
      "\nSome fields need nothing typed (e.g. an account read) — it renders a single confirm button. " +
      "After calling it, add ONE short line telling them to fill the field (or press the button). " +
      "NEVER invent the missing value yourself, and never claim a result before they submit.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...SKILL_INPUT_ACTIONS],
          description: "Which skill to run once the creator submits the field (or taps the button).",
        },
        value: {
          type: "string",
          description:
            "OPTIONAL — for 'explore' and 'read' only: the niche or concept the creator ALREADY stated " +
            "in their message, used to PRE-FILL the field so they review-and-go instead of retyping. " +
            "They can still edit it. Omit entirely when there is nothing to pre-fill.",
        },
      },
      required: ["action"],
    },
  },
} as const;

/** Server-side cap on a model-supplied prefill value (mirrors the read/chat route ask caps). */
const PREFILL_CAP = 2000;

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
  /** The creator's message this turn — as sent to the model (may be the grounding-assembled bundle). */
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
  /**
   * Fired the moment the agent COMMITS to running a skill — with the skill's DISPLAY key
   * (`SkillTool.skillKey`: 'ideas' | 'hooks' | 'script' | …), BEFORE `run` and before any stage
   * event. The route streams it as the `dispatch` SSE event so the client can label its progress
   * capsule and seed the right stage plan while the skill is still spinning up. NOT fired for the
   * free tools (request_input / search_corpus) — nothing runs on those.
   */
  onDispatch?: (skill: string) => void;
}

export interface ChatAgentStreamResult {
  /** The full streamed assistant text (for persistence as a markdown turn). */
  text: string;
  /** Each skill that ran, with its block-cards (the route persists these). */
  skillRuns: SkillRunOutput[];
  /**
   * Non-skill UI affordance blocks the loop emitted this turn (an `input-request` field from
   * request_input). Emitted via onBlock for the live render AND returned here so the route PERSISTS
   * them — without persistence the field would vanish the moment the turn completes and the client
   * reloads the thread from the server. Empty on a normal turn.
   */
  uiBlocks: unknown[];
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
    "You also have TOOLS that produce rich scored cards shown to the creator. To MAKE content call " +
    "generate_ideas / generate_hooks / write_script (pass the `topic`; pass an optional `anchor` for a " +
    "chosen idea/hook to build on). " +
    "DISPATCH EAGERLY: when the ask is a clear request to make ideas, hooks, or a script and you have a " +
    "workable subject, CALL the matching tool THIS turn — do NOT ask whether they want 'a card vs an " +
    "opinion', do NOT offer to run it, and do NOT write the content yourself first. Just call it. Stay " +
    "conversational only when the creator is genuinely just talking or thinking out loud, OR when the ask " +
    "is too vague or too generic to produce something non-obvious — then push back ONCE for a sharper " +
    "angle, and the moment you have a workable subject, call the tool. " +
    "CRITICAL — NEVER tell the creator a card is 'on screen', 'generated', or 'ready', and never describe " +
    "its contents, UNLESS you actually called the tool THIS turn. If you did not call a tool, do not claim " +
    "a card exists. " +
    "After a tool runs, its cards are already shown to the creator; add ONE short line pointing at what " +
    "you made and a natural next step, and never re-write the card content in prose. If a tool returns an " +
    "ERROR instead of a card, tell the creator plainly what went wrong and what to do about it (relay the " +
    "error's guidance) — do NOT silently answer the request in prose as though the tool had succeeded. " +
    "When the creator wants a skill that still needs something from them — a video LINK to remix, a concept " +
    "to read past their audience, a niche to explore, a real finished video to TEST against their audience — " +
    "or an account read (which needs nothing typed), call request_input with the matching action so an inline " +
    "field (a text box, a video drop, or a confirm button) appears in the thread. " +
    "Never invent the missing value, never just describe a result you cannot produce, and never claim a card " +
    "exists before they submit the field.";
  const groundLine = grounding
    ? " When a real, proven real-world example would make a strategy answer stronger, call search_corpus " +
      "and ground your answer on what it returns."
    : "";
  return base + groundLine;
}

/** Parse the model's tool args into the shape the skills read (topic + optional anchor). */
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
  // request_input is always bound (free — it just shows an inline field); the corpus tool only when
  // grounding is on (naming an unbound tool invites a call that can't be serviced).
  const tools = [
    ...skills.map((s) => s.schema),
    REQUEST_INPUT_TOOL,
    ...(input.grounding ? [SEARCH_CORPUS_TOOL] : []),
  ];

  // The caller's prompt grounds voice/chat; the loop appends the tool-use directive (it owns the tools).
  const systemContent = `${input.systemPrompt}\n\n${toolUseDirective(!!input.grounding)}`;
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemContent },
    ...(input.priorTurns ?? []).map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: input.ask },
  ];

  const skillRuns: SkillRunOutput[] = [];
  const uiBlocks: unknown[] = [];
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

      // In-thread input affordance: the model asks for what a skill needs → emit an `input-request`
      // block (the field) instead of running anything paid inline. The client renders it inline and
      // runs the action on its OWN route on submit. kind/label/placeholder come from SKILL_CAPABILITIES
      // (no model-generated UI); the model only chose which action + an optional text prefill value.
      if (call.name === "request_input") {
        let action: unknown;
        let rawValue: unknown;
        try {
          const parsed = JSON.parse(call.args || "{}");
          action = parsed.action;
          rawValue = parsed.value;
        } catch {
          /* handled by the guard below */
        }
        if (!isSkillInputAction(action)) {
          toolCalls.push({ name: "request_input", ran: false, note: "unknown action" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "unknown input action — cannot show a field" }),
          });
          continue;
        }
        const cap = SKILL_CAPABILITIES[action];
        // Prefill only for text kinds the capability marks prefillable; cap the model value.
        const prefill =
          cap.prefillable && cap.kind === "text" && typeof rawValue === "string" && rawValue.trim().length > 0
            ? rawValue.trim().slice(0, PREFILL_CAP)
            : undefined;
        const fieldBlock = {
          type: "input-request",
          props: {
            kind: cap.kind,
            action,
            label: cap.label,
            ...(cap.placeholder ? { placeholder: cap.placeholder } : {}),
            ...(prefill ? { prefill } : {}),
            platform: input.context.platform,
          },
        };
        input.onBlock(fieldBlock); // live render this turn…
        uiBlocks.push(fieldBlock); // …and persist it so a reload restores the field (route persists uiBlocks)
        toolCalls.push({ name: "request_input", ran: true, note: action });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            shown: `${cap.kind} input field`,
            action,
            note:
              cap.kind === "none"
                ? "a confirm button is now shown to the creator; tell them to press it — do not describe a result yet"
                : "a field is now shown to the creator; ask them to fill it — do not describe a result yet",
          }),
        });
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
        // Announce the dispatch BEFORE the run: the client's capsule labels itself + seeds the
        // skill's stage plan off this, ahead of the first onStage event (~seconds later).
        input.onDispatch?.(skill.skillKey);
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

  return { text: fullText, skillRuns, uiBlocks, toolCalls };
}
