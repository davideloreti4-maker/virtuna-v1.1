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
 * THE LEASH IS NOT A PRICE, and until 2026-07-29 it was the only thing here that knew about money at
 * all: `skill.run()` invoked the real paid pipeline ungated and unbilled, so a revival of this module
 * would have run ideas/hooks/script for free. `DispatchDeps.till` is the seam, and it FAILS CLOSED —
 * a skill declaring `billable` does not run without one. See SkillTill.
 *
 * Spike-staged: prove routing with mock runners (free), then one real run. Route integration (SSE +
 * insertMessage) reuses the existing skill-route emit/persist code.
 */

import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "@/lib/audience/audience-types";
import type { BillableAction } from "@/lib/pricing";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { runScriptPipeline } from "@/lib/tools/runners/script-runner";
import { runTwoAudienceRead } from "@/lib/engine/flash/two-audience-read";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { RunEvidence } from "@/lib/tools/evidence";

// ─── Shared run context (loaded once by the route; passed to every skill) ────

export interface SkillRunContext {
  platform: "tiktok" | "instagram" | "youtube";
  profileRow: ProfileRow | null;
  audience?: Audience | null;
  /** Forwarded to the runner's phase-boundary callback (the route wires it to SSE `stage`). */
  onStage?: (name: string, status: "active" | "done") => void;
  /**
   * Forwarded to the runner's EVIDENCE callback (the route wires it to SSE `evidence`) — the real
   * artifacts the run touched mid-flight, for the loading spine. An agent-dispatched skill runs the
   * SAME pipeline as its own route, so it must show the same evidence; without this the chat door
   * into the engine would be the one wait that stayed blind.
   */
  onEvidence?: (evidence: RunEvidence) => void;
  /**
   * THE CONVERSATION (2026-08-10) — what the creator has said in this thread.
   *
   * On the CONTEXT, not on SkillToolArgs, and that is the whole point. The generators were the
   * one place in the system with no conversation at all: twenty turns reached them only insofar
   * as the agent compressed them into the `topic` string. The obvious fix — a `context` slot on
   * the tool schema for the model to fill — is the one session 6 already measured failing: the
   * `cards` slot built exactly that way earns nothing, because the model never reaches for it.
   * So the LOOP builds this from the turns it is already replaying and injects it, the same way
   * platform/profileRow/audience arrive. See conversation-digest.ts.
   *
   * Absent when ENGINE_GEN_CONVERSATION is off; undefined is byte-identical downstream.
   */
  conversation?: { turns?: string[] };
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
  /** How many the creator asked for (Stage A, N-4 — hooks only today). Runner-clamped. */
  count?: number;
  /**
   * Stage B (B2): the exact lines of cards ALREADY on screen the creator wants rewritten
   * ("rewrite these", "punch them up"). Model-filled from the transcript's cards_on_screen,
   * or forced by the route when a chip carries the pack as data. Loop-capped; the runners
   * fence it under a rewrite contract so the run improves THESE items instead of generating
   * unrelated new ones.
   */
  cards?: string[];
}

/** One skill, exposed to the chat model as a tool. Adding a skill = adding one of these. */
export interface SkillTool {
  name: string;
  /**
   * The skill's DISPLAY key — the id the client's run capsule uses to label the run and seed
   * its stage plan (SKILL_RUN_META / STAGE_PLANS keys: 'ideas' | 'hooks' | 'script' | …).
   * Streamed to the client via the `dispatch` SSE event the moment the agent picks this tool,
   * so the spine can say WHAT is running before the first stage event lands.
   */
  skillKey: string;
  /**
   * WHAT THIS SKILL COSTS — the ledger action the run is gated and billed under, or absent when
   * the skill is genuinely free. This is the same `BillableAction` the skill's own dedicated route
   * charges, so a run costs the creator the same whether they asked the agent or pressed the skill.
   *
   * It replaced a bare `paid: boolean`, which could say THAT a skill spends money but not how much
   * — so the agent path had no price to charge and ran the paid engine for free. A skill that
   * declares a price is gated before it runs and billed on delivery; one that declares none is
   * free everywhere. Presence also drives the per-turn leash and FREE_SKILL_TOOLS.
   */
  billable?: BillableAction;
  /** Which arg the model MUST supply for this skill to run (defaults to "topic" — the generator shape). */
  primaryArg?: "topic" | "draft";
  /** OpenAI/DashScope tool schema the model sees. */
  schema: Record<string, unknown>;
  /** Adapter: model args + shared context → block-cards for the thread. */
  run: (args: SkillToolArgs, ctx: SkillRunContext) => Promise<{ blocks: unknown[]; warnings: string[] }>;
}

function skillSchema(
  name: string,
  description: string,
  withAnchor: boolean,
  withCount = false,
): Record<string, unknown> {
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
  if (withCount) {
    // N-4: the router rewrites the ask into `topic`, which is exactly where "3 hooks for…"
    // used to lose its 3 — the count must ride its own slot to survive the rewrite.
    properties.count = {
      type: "number",
      description:
        "Optional: how many the creator EXPLICITLY asked for (e.g. 3 in '3 hooks for…'). " +
        "Omit when they named no number.",
    };
  }
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required: ["topic"] } },
  };
}

/**
 * Stage B (B2): add the `cards` slot to a generator's tool schema — the pack being discussed.
 *
 * "Rewrite these hooks" used to dispatch a fresh generation that could not SEE "these": the tool
 * schema had no slot for the pack, so the run returned five strangers. The transcript already
 * shows the model every card's line (`cards_on_screen`, chat-agent-loop replay); this slot is
 * where it hands them back so the runner can rewrite the real items.
 *
 * Applied per-request by the agent loop (flag-gated there), NEVER baked into SKILL_TOOLS — the
 * registry stays byte-identical when the flag is off. Pure: returns a new schema object.
 */
export function withCardsSlot(schema: Record<string, unknown>): Record<string, unknown> {
  const fn = schema.function as
    | { parameters?: { properties?: Record<string, unknown> } }
    | undefined;
  const properties = fn?.parameters?.properties;
  if (!fn || !fn.parameters || !properties) return schema;
  return {
    ...schema,
    function: {
      ...fn,
      parameters: {
        ...fn.parameters,
        properties: {
          ...properties,
          cards: {
            type: "array",
            items: { type: "string" },
            description:
              "ONLY when the creator asks to rewrite/tighten/re-angle cards ALREADY on screen " +
              "('rewrite these', 'punch them up', 'make it sharper'): the exact lines of those " +
              "cards, copied VERBATIM from cards_on_screen in this conversation, in order. " +
              "Omit entirely when they want fresh content.",
          },
        },
      },
    },
  };
}

// ─── The registry — generators (topic shape) ──

export const SKILL_TOOLS: SkillTool[] = [
  {
    name: "generate_ideas",
    skillKey: "ideas",
    billable: "ideas",
    schema: skillSchema(
      "generate_ideas",
      "Generate content IDEAS (angles/concepts) for a topic. Use when the creator asks for ideas, " +
        "angles, concepts, or 'what should I make about X'. Produces idea cards shown in the thread.",
      false,
    ),
    run: async (args, ctx) => {
      const r = await runIdeasPipeline({
        ask: args.topic ?? "",
        cards: args.cards,
        conversation: ctx.conversation,
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
        onEvidence: ctx.onEvidence,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
  {
    name: "generate_hooks",
    skillKey: "hooks",
    billable: "hooks",
    schema: skillSchema(
      "generate_hooks",
      "Generate scroll-stopping HOOK lines (opening lines) for a topic or a chosen idea. Use when the " +
        "creator asks for hooks, openers, or opening lines. Produces ranked hook cards shown in the thread.",
      true,
      true,
    ),
    run: async (args, ctx) => {
      const r = await runHooksPipeline({
        ask: args.topic ?? "",
        anchor: args.anchor,
        count: args.count,
        cards: args.cards,
        conversation: ctx.conversation,
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
        onEvidence: ctx.onEvidence,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
  {
    name: "write_script",
    skillKey: "script",
    billable: "script",
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
        cards: args.cards,
        conversation: ctx.conversation,
        platform: ctx.platform,
        profileRow: ctx.profileRow,
        audience: ctx.audience,
        onStage: ctx.onStage,
        onEvidence: ctx.onEvidence,
      });
      return { blocks: r.blocks, warnings: r.warnings };
    },
  },
  /**
   * READ — the first NON-generator bound to the agent loop, and the reason `primaryArg` exists.
   *
   * It does not make content; it runs something the creator ALREADY wrote past their audience and
   * returns a band + a lever. So its primary input is `draft` (the exact text), never `topic` (a
   * subject to invent from). A model that "reads" a subject it paraphrased is scoring its own
   * paraphrase, which is why the arg is the verbatim text and the description says so twice.
   *
   * WHY THIS ONE AND NOT ITS NEIGHBOURS. `account-read`, `explore` and `remix` stay behind a
   * confirm tap because they hit **Apify scrapes** — rotating FREE accounts on a $5/month hard cap
   * — and an agent that can decide to scrape can burn that cap with nobody tapping anything. Read
   * is an audience SIM, not a scrape. VERIFIED rather than assumed (the assumption was the whole
   * blocker): `runTwoAudienceRead` awaits exactly one thing, `runFlashTextMode`. The only Apify
   * edge anywhere in its import graph is `resolve-tier.ts → socials-calibration.ts`, whose
   * `domain-pack` import is `import type` (erased at compile) — and both modules were extracted as
   * leaves precisely to keep `runPredictionPipeline → apify-client` out of the browser bundle.
   * `resolveTier()` is a pure synchronous read of a static descriptor.
   *
   * It keeps its `request_input` capability too, and the two doors do not compete: the tool runs
   * when the creator HAS given the text, the field collects it when they have not. Both spend the
   * same credit under the same gate.
   */
  {
    name: "read_concept",
    skillKey: "read",
    billable: "read",
    primaryArg: "draft",
    schema: {
      type: "function",
      function: {
        name: "read_concept",
        description:
          "Run a piece of writing the creator ALREADY HAS past their audience and report how it " +
          "lands — a band, the fraction who stop, and the one lever to change. Use when they ask " +
          "how their audience would react to a specific hook, concept, caption or draft AND they " +
          "have given you its actual text (\"would this land: …\", \"read this past my audience\", " +
          "\"what would they think of this hook\"). Also use it on a line already on screen — one " +
          "of the hooks or ideas you made earlier — passing that line verbatim. " +
          "Do NOT use it to make new content (call a generator), and do NOT call it when you do " +
          "not have the exact text: ask for it with request_input instead. Never paraphrase or " +
          "invent the text — a Read of your own paraphrase is a Read of the wrong thing.",
        parameters: {
          type: "object",
          properties: {
            draft: {
              type: "string",
              description:
                "The VERBATIM text to run past the audience — the creator's own hook/concept/" +
                "caption/draft, or a line from a card already on screen. Copied exactly, never rewritten.",
            },
          },
          required: ["draft"],
        },
      },
    },
    run: async (args, ctx) => {
      // The audience the thread is pinned to (the route resolves it exactly as /api/tools/read
      // does, from thread.active_audience_id under the session). No pin ⇒ General, the same
      // default. A single audience, never a forced compare — a compare is explicit only (P3).
      const block = await runTwoAudienceRead(args.draft ?? "", [ctx.audience ?? GENERAL_AUDIENCE]);
      return { blocks: [block], warnings: [] };
    },
  },
];

/**
 * The skills that cost NOTHING to run — what an anonymous `/go` visitor may reach through chat.
 *
 * Chat itself is free by decision, but a skill the agent dispatches is a metered action with its
 * own `creditGate` and its own 402 on its own route. The demo entitles one free Test and nothing
 * else, so the chat route binds THIS list for an anonymous session: a wall on /api/tools/hooks is
 * worthless if the same pipeline can be reached by asking the agent nicely.
 *
 * Derived, not hand-listed — a new paid skill is behind the wall the day it is added. Empty today,
 * and that is the honest state: every skill in the registry hits the paid engine.
 */
export const FREE_SKILL_TOOLS: SkillTool[] = SKILL_TOOLS.filter((s) => !s.billable);

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
  /**
   * The skill's DISPLAY key ('ideas' | 'hooks' | 'script' | …) — what the chat route
   * stamps the persisted turn's run-header with (Stage A, F-3). Optional: the legacy
   * runSkillDispatch path predates it.
   */
  skillKey?: string;
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

/**
 * THE TILL — the money seam this module ran without until 2026-07-29.
 *
 * `maxSkillRuns` is a LEASH, not a price: it caps how many paid runs one dispatch may start and
 * says nothing about whether the creator can afford them or that anyone was charged. So every
 * `skill.run()` below invoked the real paid pipeline — ideas, hooks, script — ungated and unbilled.
 * The module is not on the live path today (the chat route uses `runChatAgentStream`), which is the
 * only reason that never cost anything; a note saying "if it is ever revived, it needs a billing
 * seam" is not a thing that stops the revival.
 *
 * So the seam exists now, and it FAILS CLOSED: a skill declaring `billable` does not run at all
 * unless a till is wired and authorizes it. Reviving this module without deciding about money
 * therefore produces a visible refusal the model relays, never a free paid run. Skills with no
 * `billable` are unaffected and need no till.
 *
 * It is deliberately an interface rather than a direct `creditGate` import: this file is a pure
 * orchestration module with no request, no Supabase client and no user, and dragging those in would
 * make it un-unit-testable and couple it to the route. The caller owns the wallet.
 */
export interface SkillTill {
  /** Decide whether ONE paid run may start. A refusal is relayed to the model, and nothing runs. */
  authorize: (action: BillableAction) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Record the spend, AFTER the run delivered its cards — bill on delivery, never on attempt. */
  charge: (action: BillableAction) => Promise<void>;
}

export interface DispatchDeps {
  skills?: SkillTool[];
  complete?: ChatComplete;
  model?: string;
  seed?: number;
  maxRounds?: number;
  maxSkillRuns?: number;
  /** Required for any skill carrying `billable` — without it those skills refuse (see SkillTill). */
  till?: SkillTill;
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
  const till = deps.till;
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
      if (skill.billable && paidRuns >= maxSkillRuns) {
        toolCalls.push({ name: skill.name, args, ran: false, note: "leash: run limit reached" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "skill run limit reached for this turn — ask the creator to confirm before running more" }),
        });
        continue;
      }

      // THE TILL, before the engine. The leash above counts runs; this is the only thing that
      // knows what they cost. No till wired ⇒ a billable skill does not run — fail closed, so
      // reviving this module without a wallet cannot spend the creator's money.
      // Carried, rather than re-derived after the run: the charge is then provably for the exact
      // action that was authorized, and tsc holds the till non-null without an assertion.
      let authorized: { till: SkillTill; action: BillableAction } | null = null;
      if (skill.billable) {
        if (!till) {
          toolCalls.push({ name: skill.name, args, ran: false, note: "no till wired" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "this skill costs credits and no billing seam is wired — it was not run" }),
          });
          continue;
        }
        const verdict = await till.authorize(skill.billable);
        if (!verdict.ok) {
          toolCalls.push({ name: skill.name, args, ran: false, note: "refused: no credits" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: verdict.reason }),
          });
          continue;
        }
        authorized = { till, action: skill.billable };
      }

      try {
        const { blocks, warnings } = await skill.run(args, input.context);
        // BILL ON DELIVERY. The charge sits after the run returned cards, so a skill that threw
        // lands in the catch below and is never charged — the same rule the live routes follow.
        //
        // ⚠️ It is guarded SEPARATELY from the run, and that separation is the point. A charge that
        // threw inside the same `try` would reach the catch below and be reported as a RUN failure:
        // the cards exist by then, so a bookkeeping fault would discard work the creator can see was
        // done, tell the model the skill errored — and still not charge. Delivery is not reversible
        // by a failed charge. The run stands and the miss rides out as a warning.
        const billingWarnings: string[] = [];
        if (authorized) {
          paidRuns++;
          try {
            await authorized.till.charge(authorized.action);
          } catch {
            billingWarnings.push(`the ${skill.name} run was delivered but its charge did not record`);
          }
        }
        skillRuns.push({ name: skill.name, blocks, warnings: [...warnings, ...billingWarnings] });
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
