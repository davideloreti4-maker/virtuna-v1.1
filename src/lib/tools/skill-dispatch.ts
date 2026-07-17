/**
 * skill-dispatch.ts — chat as a skill-orchestrating AGENT (the "one thread, all skills" vision).
 *
 * Today the composer's skill SELECTOR decides which /api/tools/<skill> route runs; every route already
 * appends its block-cards to the SAME open thread. This module removes the manual switch: the chat
 * model is given the skills as TOOLS and decides — "make me 3 ideas" → it calls generate_ideas, the
 * real runIdeasPipeline runs, and its idea-card blocks land in the thread like any other message. No new
 * rendering/persistence: the block-message thread already renders every skill's cards.
 *
 * GENERAL by construction: a skill is ONE registry entry (tool schema + a thin adapter to its runner).
 * Adding hooks/script/simulate/… is a line each. The three generators share one input shape, so the
 * adapter is uniform.
 *
 * PAID-ENGINE LEASH: skills hit the paid engine (generate + SIM). An LLM deciding to spend money needs a
 * limit — `maxSkillRuns` caps paid invocations per dispatch; over the cap, the tool returns a refusal
 * the model relays ("ask the creator to confirm") instead of running.
 *
 * Spike-staged: prove routing with mock runners (free), then one real run. Route integration (SSE +
 * insertMessage) reuses the existing skill-route emit/persist code.
 */

import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "@/lib/audience/audience-types";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { runScriptPipeline } from "@/lib/tools/runners/script-runner";

// ─── Shared run context (loaded once by the route; passed to every skill) ────

export interface SkillRunContext {
  platform: "tiktok" | "instagram" | "youtube";
  profileRow: ProfileRow | null;
  audience?: Audience | null;
  /** Forwarded to the runner's phase-boundary callback (the route wires it to SSE `stage`). */
  onStage?: (name: string, status: "active" | "done") => void;
}

/**
 * Args the MODEL supplies per skill call (extracted from the conversation). The registry is generators
 * today (ideas/hooks/script → a `topic`, + optional `anchor`), but the shape stays general: a skill can
 * name a different `primaryArg` (e.g. a `draft` for a future analysis skill) and the dispatcher validates
 * whichever field that skill requires.
 */
export interface SkillToolArgs {
  /** Generator primary input: the subject to generate for. */
  topic?: string;
  /** Optional carried concept/hook to build on (hooks/script). */
  anchor?: string;
  /** Alternate primary input for a non-generator skill: a specific drafted message/scenario. */
  draft?: string;
}

/** One skill, exposed to the chat model as a tool. Adding a skill = adding one of these. */
export interface SkillTool {
  name: string;
  /** Hits the paid engine (generate + SIM) → counts against the leash. */
  paid: boolean;
  /** Which arg the model MUST supply for this skill to run (defaults to "topic" — the generator shape). */
  primaryArg?: "topic" | "draft";
  /** OpenAI/DashScope tool schema the model sees. */
  schema: Record<string, unknown>;
  /** Adapter: model args + shared context → block-cards for the thread. */
  run: (args: SkillToolArgs, ctx: SkillRunContext) => Promise<{ blocks: unknown[]; warnings: string[] }>;
}

function skillSchema(name: string, description: string, withAnchor: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    topic: {
      type: "string",
      description: "The subject/topic to generate for, extracted from the creator's message + the conversation.",
    },
  };
  if (withAnchor) {
    properties.anchor = {
      type: "string",
      description: "Optional: a specific chosen idea or hook line from earlier in the thread to build on.",
    };
  }
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required: ["topic"] } },
  };
}

// ─── The registry — generators (topic shape) ──

export const SKILL_TOOLS: SkillTool[] = [
  {
    name: "generate_ideas",
    paid: true,
    schema: skillSchema(
      "generate_ideas",
      "Generate content IDEAS (angles/concepts) for a topic. Use when the creator asks for ideas, " +
        "angles, concepts, or 'what should I make about X'. Produces idea cards shown in the thread.",
      false,
    ),
    run: async (args, ctx) => {
      const r = await runIdeasPipeline({
        ask: args.topic ?? "",
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
  {
    name: "generate_hooks",
    paid: true,
    schema: skillSchema(
      "generate_hooks",
      "Generate scroll-stopping HOOK lines (opening lines) for a topic or a chosen idea. Use when the " +
        "creator asks for hooks, openers, or opening lines. Produces ranked hook cards shown in the thread.",
      true,
    ),
    run: async (args, ctx) => {
      const r = await runHooksPipeline({
        ask: args.topic ?? "",
        anchor: args.anchor,
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
  {
    name: "write_script",
    paid: true,
    schema: skillSchema(
      "write_script",
      "Write a short-form SCRIPT / video outline for a topic or a chosen hook. Use when the creator " +
        "asks for a script, outline, or full video plan. Produces a script card shown in the thread.",
      true,
    ),
    run: async (args, ctx) => {
      const r = await runScriptPipeline({
        ask: args.topic ?? "",
        anchor: args.anchor,
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
];

// ─── The dispatcher loop ─────────────────────────────────────────────────────

export type ChatComplete = (params: Record<string, unknown>) => Promise<{
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
}>;

const DISPATCH_SYSTEM_PROMPT =
  "You are Numen's content co-pilot, talking with a creator in one continuous thread. You can either " +
  "answer conversationally OR run a skill by calling a tool. The GENERATORS make new content for a " +
  "subject — generate_ideas, generate_hooks, write_script (pass the `topic`). Call a tool ONLY when the " +
  "creator asks for that kind of help; extract the topic from their words and the conversation so far. " +
  "If they are just talking, asking strategy, or thinking out loud, answer directly — do NOT call a tool " +
  "they didn't ask for. After a skill runs, its cards are already shown to the creator; add ONE short " +
  "line pointing at what you made and a natural next step. Never invent card content in text — the cards " +
  "carry it.";

const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_SKILL_RUNS = 2; // paid-engine leash: skill invocations per dispatch turn

const defaultComplete: ChatComplete = async (params) => {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { getQwenClient } = require("@/lib/engine/qwen/client");
  return getQwenClient().chat.completions.create(params);
};

export interface SkillRunOutput {
  name: string;
  blocks: unknown[];
  warnings: string[];
}

export interface DispatchResult {
  /** The closing conversational turn (co-pilot voice), if any. */
  text: string;
  /** Each skill the model ran, with its block-cards (the route persists + streams these). */
  skillRuns: SkillRunOutput[];
  /** Telemetry: which tools the model called with what args. */
  toolCalls: Array<{ name: string; args: SkillToolArgs; ran: boolean; note?: string }>;
}

export interface DispatchDeps {
  skills?: SkillTool[];
  complete?: ChatComplete;
  model?: string;
  seed?: number;
  maxRounds?: number;
  maxSkillRuns?: number;
}

/**
 * Run the chat-as-agent dispatch: the model sees the skill toolbelt + the creator's ask, and either
 * answers or calls skills. Returns the closing text + every skill's block-cards. Paid runs are capped.
 */
export async function runSkillDispatch(
  input: { ask: string; context: SkillRunContext; priorTurns?: Array<{ role: "user" | "assistant"; text: string }> },
  deps: DispatchDeps = {},
): Promise<DispatchResult> {
  const skills = deps.skills ?? SKILL_TOOLS;
  const complete = deps.complete ?? defaultComplete;
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

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: DISPATCH_SYSTEM_PROMPT },
    ...(input.priorTurns ?? []).map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: input.ask },
  ];
  const skillRuns: SkillRunOutput[] = [];
  const toolCalls: DispatchResult["toolCalls"] = [];
  let paidRuns = 0;
  let text = "";

  for (let round = 1; round <= maxRounds; round++) {
    const completion = await complete({
      model,
      messages,
      tools: skills.map((s) => s.schema),
      tool_choice: "auto",
      temperature: 0.3,
      seed,
      max_tokens: 1200,
      enable_thinking: false,
    });

    const msg = completion.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg as Record<string, unknown>);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      text = msg.content ?? "";
      break;
    }

    for (const call of calls) {
      const skill = byName.get(call.function?.name ?? "");
      let args: SkillToolArgs = {};
      try {
        const parsed = JSON.parse(call.function?.arguments ?? "{}");
        args = {
          topic: parsed.topic != null ? String(parsed.topic).trim() : undefined,
          anchor: parsed.anchor,
          draft: parsed.draft != null ? String(parsed.draft).trim() : undefined,
        };
      } catch {
        args = {};
      }

      // Unknown tool, missing primary input, or over the paid leash → a tool result the model relays; no run.
      if (!skill) {
        toolCalls.push({ name: call.function?.name ?? "?", args, ran: false, note: "unknown skill" });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown skill" }) });
        continue;
      }
      // Generators require `topic`; analysis skills require `draft`. Each skill names its primary arg.
      const primary = skill.primaryArg ?? "topic";
      if (!args[primary]) {
        toolCalls.push({ name: skill.name, args, ran: false, note: `no ${primary}` });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: `no ${primary} provided` }) });
        continue;
      }
      if (skill.paid && paidRuns >= maxSkillRuns) {
        toolCalls.push({ name: skill.name, args, ran: false, note: "leash: run limit reached" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "skill run limit reached for this turn — ask the creator to confirm before running more" }),
        });
        continue;
      }

      try {
        const { blocks, warnings } = await skill.run(args, input.context);
        if (skill.paid) paidRuns++;
        skillRuns.push({ name: skill.name, blocks, warnings });
        toolCalls.push({ name: skill.name, args, ran: true });
        // The model doesn't need the full blocks (they render to the UI) — just confirmation + count.
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ran: skill.name, produced: `${blocks.length} card(s)`, note: "cards are shown to the creator" }),
        });
      } catch (err) {
        toolCalls.push({ name: skill.name, args, ran: false, note: "error" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        });
      }
    }
  }

  return { text, skillRuns, toolCalls };
}
