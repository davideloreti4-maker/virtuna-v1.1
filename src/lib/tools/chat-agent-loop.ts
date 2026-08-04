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
 *
 * MONEY: a skill the agent decides to run is gated and billed HERE, through `deps.billing`, at the
 * same price its own route charges — see SkillBilling. Before that seam existed this loop called the
 * runners directly with no gate and no bill, so the identical hooks pack cost 1 credit when pressed
 * from the skill pill and 0 when asked for in chat. The pill was the only thing keeping most traffic
 * on the paid path, which made deleting the pill a pricing change. A billable skill with no seam
 * wired is REFUSED, never run for free.
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
  type SkillCapability,
} from "@/lib/tools/skill-capabilities";
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
import type { BillableAction } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

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
            "OPTIONAL — something the creator ALREADY gave you in their message, used to PRE-FILL the " +
            "field so they review-and-go instead of typing it twice. They can still edit it. " +
            "For 'explore' and 'read': the niche or concept they named. For 'remix' and 'test': the " +
            "video LINK they pasted, copied exactly. Omit entirely when there is nothing to pre-fill — " +
            "never invent a value, and never pass one for 'account' (it needs nothing typed).",
        },
      },
      required: ["action"],
    },
  },
} as const;

/** Server-side cap on a model-supplied prefill value (mirrors the read/chat route ask caps). */
const PREFILL_CAP = 2000;

/**
 * Validate + normalize a model-supplied prefill against the shape the capability declares
 * (SKILL_CAPABILITIES[action].prefill). Returns undefined when the field is not prefillable, the
 * value is absent/blank, or it does not match the declared shape — and an unmatched value is
 * DROPPED rather than passed through, so the model can never seed a field with something that
 * field would visibly reject.
 *
 * The URL shapes matter because a pasted link is exactly what a creator should not have to type
 * twice: `remix` takes any public video link (its route classifies it), `test` takes only a TikTok
 * URL (the same TIKTOK_URL_PATTERN its field validates against, so client and loop can't disagree).
 */
function resolvePrefill(shape: SkillCapability["prefill"], raw: unknown): string | undefined {
  if (!shape) return undefined;
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().slice(0, PREFILL_CAP);
  if (value.length === 0) return undefined;
  switch (shape) {
    case "text":
      return value;
    case "url":
      return /^https?:\/\/\S+$/.test(value) ? value : undefined;
    case "tiktok-url":
      return TIKTOK_URL_PATTERN.test(value) ? value : undefined;
  }
}

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

/**
 * One prior conversation turn, as the loop replays it to the model.
 *
 * `toolRuns` is the fix for a thread that poisons its own later turns. A turn that dispatched a
 * skill persists TWO things: the cards (their own message row) and the model's closing line ("Five
 * hooks are on screen."). The route can only replay the second — card blocks are filtered out of the
 * anchor — so the transcript used to show a bare assistant sentence claiming five hooks exist, with
 * nothing anywhere saying a tool produced them. Asked for hooks again, the model did the only thing
 * that transcript supports: it reproduced the sentence and called nothing. Zero cards, and the UI
 * insisting five were on screen (confirmed live, 3/3 offline).
 *
 * A prompt clause could not fix this — the precedent IS the transcript. So the transcript now tells
 * the truth: a turn carrying `toolRuns` is replayed as the tool-call exchange it actually was
 * (assistant → tool_calls, tool result, then the closing line), which is byte-for-byte the shape
 * this loop builds for a live turn. The sentence stops reading as a template a model can type and
 * starts reading as what follows a tool call.
 */
export interface ChatAgentPriorTurn {
  role: "user" | "assistant";
  text: string;
  /**
   * Skills this assistant turn actually ran, in run order — reconstructed by the caller from the
   * card blocks it persisted. Ignored on a user turn, and ignored for any tool not currently BOUND
   * (an unbound name in the replayed transcript would advertise a tool the model cannot call).
   */
  toolRuns?: Array<{
    /** The tool name as bound here (`SkillTool.name`, e.g. "generate_hooks"). */
    name: string;
    /** How many cards it produced — the same count the live tool result reports. */
    cards: number;
    /** The subject it ran on, for the replayed arguments. Falls back to the turn's own text. */
    topic?: string;
  }>;
}

export interface ChatAgentStreamInput {
  /** The creator's message this turn — as sent to the model (may be the grounding-assembled bundle). */
  ask: string;
  /** Shared skill context (platform, profileRow, audience, onStage) — same shape the skills already use. */
  context: SkillRunContext;
  /** The fully-built system prompt (KC chat prompt + cheap assembleBundle grounding), built by the route. */
  systemPrompt: string;
  /** Prior conversation turns (role + text), oldest→newest. */
  priorTurns?: ChatAgentPriorTurn[];
  /**
   * A generator the CREATOR already chose — the `skillKey` of a follow-up chip they tapped
   * ('ideas' | 'hooks' | 'script'). Pins the FIRST round's `tool_choice` to that tool.
   *
   * WHY THIS IS NOT "dispatch more". A tapped chip is a command issued under cards that already fix
   * the subject; the model's job on that turn is to write the arguments and the closing line, not to
   * decide whether the creator meant it. Left to `tool_choice: "auto"` it decided wrong every time:
   * "Give me a few more hook options." reads as subject-less, so the directive's "too vague or too
   * generic → push back ONCE" clause fired and nothing ran (0/3, unchanged by the §4 fix). The
   * sentence cannot be re-worded out of that — prompt text was tried and reached 1/3 while
   * destabilising sibling chips.
   *
   * Scope is deliberately narrow, so this cannot leak into ordinary asks:
   *   · only set when the client names a skill (a TYPED message never does — controls stay untouched);
   *   · only honoured when that skill is actually BOUND this turn, so an anonymous visitor with
   *     `skills: []` silently gets the unpinned path rather than a forced paid run;
   *   · round 1 ONLY — the model must be free to write the closing line once the tool has returned,
   *     and a pin left in place would make it call the same tool every round.
   * The gate still runs: a pinned call is admitted, priced and billed exactly like a chosen one.
   */
  forceSkill?: string;
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
  /**
   * Fired when a billable skill is REFUSED by the gate, with the structured 402 body. The route
   * streams it so the client can raise the credit wall — the same dialog, with the same server
   * sentence, that a 402 from the skill's own route would have raised.
   */
  onCreditWall?: (quota: unknown) => void;
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

/**
 * THE MONEY SEAM — admission + the till, for a skill the AGENT decided to run.
 *
 * A skill reached through the pill goes to its own route, which gates before spending and bills on
 * delivery. A skill reached through the agent goes through THIS loop, which called the runner
 * directly and charged nothing — so the same hooks pack cost 1 credit when pressed and 0 when
 * asked for. Chat was the free door into the paid engine, and the pill was the only thing keeping
 * most traffic off it.
 *
 * Supplied by the route (it holds the supabase client + the user); injectable so the loop stays
 * network-free under test.
 */
export interface SkillBilling {
  /**
   * Admission for one run of `action`, priced. Called BEFORE the runner — a refused run must cost
   * nothing. `reason` is the honest creator-facing sentence (the same copy the 402 wall shows);
   * the loop hands it to the model as a tool result to relay, since a mid-stream turn cannot
   * become a 402.
   */
  gate: (action: BillableAction) => Promise<{
    allowed: boolean;
    reason?: string;
    tier?: NumenTier | null;
    /**
     * The structured 402 body a dedicated route would have RETURNED. Carried so the client can
     * raise the same paywall dialog here: a streaming turn can't answer 402, and without this the
     * creator hits the wall as a sentence in the chat with no upgrade door — the worst possible
     * moment to lose one. The loop just relays it; `credit-wall.ts` decides what to draw.
     */
    quota?: unknown;
  }>;
  /**
   * Bill a DELIVERED run. Best-effort by contract — never throws, never blocks the answer. Takes
   * the `tier` the gate resolved, so the ledger row is stamped with the plan that was checked
   * rather than one re-read afterwards (they can differ mid-turn, and the gate's is the true one).
   */
  bill: (action: BillableAction, tier?: NumenTier | null) => Promise<void>;
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
  /**
   * Gate + till for billable skills. **Omitting it does not make them free** — a skill that
   * declares a `billable` action and has no way to charge for it is REFUSED, loudly, rather than
   * run for nothing. Failing closed is the whole point: the defect this seam exists to fix was an
   * ungated path nobody noticed, and a silent free fallback would rebuild it the first time a
   * caller forgot to wire this.
   */
  billing?: SkillBilling;
}

const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_SKILL_RUNS = 2;
/** Source cards rendered per search — a citation, not a search-results page. */
const MAX_REFERENCE_CARDS = 4;

/** Every generator in the registry — the default when a caller binds the full skill set. */
const GENERATOR_TOOL_NAMES: readonly string[] = SKILL_TOOLS.map((s) => s.name);

/**
 * The tool-use directive the loop appends to the caller's system prompt. The loop OWNS this because it
 * owns the tools — the caller's prompt (e.g. KC_CHAT_SYSTEM_PROMPT) grounds voice/chat but says nothing
 * about the bound tools, so without this the model just writes the content inline instead of calling a
 * skill (observed live). The corpus line is added only when grounding is on (the tool is otherwise not
 * bound — naming an unbound tool invites a call that can't be serviced), and `generators` carries the
 * SAME rule for the skills: it lists what this caller actually bound, never the registry.
 */
function toolUseDirective(grounding: boolean, generators: readonly string[] = GENERATOR_TOOL_NAMES): string {
  // NAME ONLY WHAT IS BOUND. An anonymous /go visitor gets `skills: FREE_SKILL_TOOLS`, which is EMPTY
  // (every generator is billable), yet this directive used to advertise all three regardless. The model
  // duly called generate_hooks, the loop answered "unknown skill", and the model then wrote the hooks
  // out in prose — handing over the paid product for free through the one door that is free by design.
  // Same rule the corpus tool already follows two lines down: never name a tool that is not bound.
  const makeLine =
    generators.length > 0
      ? "You also have TOOLS that produce rich scored cards shown to the creator. To MAKE content call " +
        `${generators.join(" / ")} (pass the \`topic\`; pass an optional \`anchor\` for a ` +
        "chosen idea/hook to build on). " +
        "DISPATCH EAGERLY: when the ask is a clear request to make that content and you have a " +
        "workable subject, CALL the matching tool THIS turn — do NOT ask whether they want 'a card vs an " +
        "opinion', do NOT offer to run it, and do NOT write the content yourself first. Just call it. Stay " +
        "conversational only when the creator is genuinely just talking or thinking out loud, OR when the ask " +
        "is too vague or too generic to produce something non-obvious — then push back ONCE for a sharper " +
        "angle, and the moment you have a workable subject, call the tool. "
      : // Nothing generative is bound (an anonymous visitor). Say so honestly instead of silently
        // becoming the generator yourself — writing the pack in prose IS delivering the paid product.
        // The wording is deliberately concrete: "offer the thinking instead" ALONE was read as licence to
        // ship the same pack relabelled as thinking (measured: a refusal opener followed by three finished,
        // quoted hook lines). What is banned is the ARTEFACT, not the topic.
        "You have NO content-generation tools on this account. When the creator wants content MADE, say " +
        "plainly that making it needs an account with credits. " +
        "HARD LIMIT — you may NOT produce the artefact yourself, in any wrapper: no hook lines, no opening " +
        "lines, no idea/concept list, no script or outline, not even ONE as an example, an illustration, a " +
        "demo, or 'the thinking'. A refusal sentence followed by the content is still delivering the " +
        "content. Never write a quoted candidate line they could paste into a video. " +
        "What you MAY do: name the mechanism in the abstract, ask what would sharpen the angle, and " +
        "critique lines THEY write. If they push, hold the limit and point at the account. ";
  const base =
    makeLine +
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
      "and ground your answer on what it returns. Use its FILTERS when the creator names a constraint " +
      "(a platform, a format, a visual setting like greenscreen, an editing style, a niche) rather than " +
      "hoping a topical search surfaces it. " +
      // Warrant-vs-claim, stated where the model composes. The tool already computes `grounded` and
      // refuses to hand back citable rows without warrant; this is the language half of the same rule.
      "HONESTY ABOUT PROOF: the tool returns a computed `grounded` flag and a `note` — obey them. " +
      "Claim something is PROVEN only when you have at least three returned examples clearing 3× " +
      "against a stated baseline; with one example say 'one example', not 'this works'. When " +
      "`grounded` is false, say plainly that you have no proven examples for that subject — never " +
      "imply the corpus contains them, and never dress a craft reference as evidence. Cite only " +
      "creators and numbers the tool actually returned."
    : "";
  return base + groundLine;
}

/**
 * Replay ONE prior turn as the messages the model sees.
 *
 * A plain turn is one message, exactly as before. A turn that ran skills becomes the exchange that
 * actually happened — assistant/tool_calls → tool result(s) → the assistant's closing line — so the
 * closing line has its cause attached to it. `boundNames` is the loop's live tool set: a run whose
 * tool is not bound this turn replays as plain text rather than naming a tool the model cannot call
 * (an anonymous visitor binds no generators, and a dangling name would invite exactly the call that
 * cannot be serviced).
 */
function replayPriorTurn(
  turn: ChatAgentPriorTurn,
  index: number,
  boundNames: Set<string>,
): Array<Record<string, unknown>> {
  const runs = turn.role === "assistant" ? (turn.toolRuns ?? []).filter((r) => boundNames.has(r.name)) : [];
  if (runs.length === 0) return [{ role: turn.role, content: turn.text }];

  const out: Array<Record<string, unknown>> = [];
  runs.forEach((run, i) => {
    const id = `prior_${index}_${i}`;
    out.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id,
          type: "function",
          // The topic is a reconstruction (the args were never persisted) — the creator's own ask
          // from that turn. It matters only as a well-formed precedent for HOW the tool is called.
          function: { name: run.name, arguments: JSON.stringify({ topic: run.topic || turn.text }) },
        },
      ],
    });
    out.push({
      role: "tool",
      tool_call_id: id,
      // The same result shape a live run pushes below, so the replayed round is indistinguishable
      // from one this loop just executed.
      content: JSON.stringify({
        ran: run.name,
        produced: `${run.cards} card(s)`,
        note: "cards are shown to the creator",
      }),
    });
  });
  out.push({ role: "assistant", content: turn.text });
  return out;
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
  // The directive is told what THIS caller bound, so it can never advertise a skill the model cannot call.
  const systemContent = `${input.systemPrompt}\n\n${toolUseDirective(!!input.grounding, skills.map((s) => s.name))}`;
  const boundNames = new Set(tools.map((t) => (t as { function?: { name?: string } }).function?.name ?? ""));
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemContent },
    ...(input.priorTurns ?? []).flatMap((t, i) => replayPriorTurn(t, i, boundNames)),
    { role: "user", content: input.ask },
  ];

  // The creator's own choice, resolved against what is actually bound. An unbound or unknown key
  // resolves to null and the turn runs exactly as it did before — never an error, and never a tool
  // name in `tool_choice` that is absent from `tools` (which the API would reject).
  const pinnedTool = input.forceSkill
    ? (skills.find((s) => s.skillKey === input.forceSkill)?.name ?? null)
    : null;

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
      // Round 1 only — see `forceSkill`. After the tool has returned, the model needs `auto` back to
      // write its closing line instead of calling the same tool again.
      tool_choice:
        pinnedTool && round === 1
          ? { type: "function", function: { name: pinnedTool } }
          : "auto",
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

    // Grounding searches run FIRST and CONCURRENTLY: they are read-only, side-effect-free, and
    // independent of each other, and the model emits them in batches (the streaming spike observed
    // four in one round). Run sequentially they cost the sum of their round-trips — each one is an
    // embed + an RPC, ~10s+, so a four-call round spent ~52s before a single token resumed streaming.
    // Skills stay sequential below: they are paid, leashed by a counter, and emit ordered cards.
    const corpusCalls = input.grounding ? calls.filter((c) => c.name === "search_corpus") : [];
    const corpusResults = await Promise.all(
      corpusCalls.map(async (call) => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.args || "{}");
        } catch {
          parsed = {};
        }
        const res = await executeCorpus(parsed, input.context.platform, round, retrieve);
        return { id: call.id, content: res.content, citable: res.citable ?? [], record: res.record };
      }),
    );
    // Appended in the model's own call order (Promise.all preserves it) so results line up with ids.
    for (const r of corpusResults) {
      toolCalls.push({ name: "search_corpus", ran: true });
      messages.push({ role: "tool", tool_call_id: r.id, content: r.content });

      // The CITATION, rendered from the tool's own rows rather than written by the model. Without
      // this the creator only ever sees the model's prose retelling of these numbers, which is a
      // claim it can get wrong; the card is the same data the RPC returned. Emitted only when the
      // search earned a warrant — a source card is itself an assertion that the rows are relevant,
      // so an ungrounded batch (warrant "none") shows nothing and the model degrades in prose.
      const warrant = r.record?.warrant;
      if ((warrant === "topical" || warrant === "structural") && r.citable.length > 0) {
        const block = {
          type: "corpus-references",
          props: {
            query: r.record?.query ?? "",
            warrant,
            ...(r.record?.facets && Object.keys(r.record.facets).length > 0
              ? { filters: r.record.facets as Record<string, string> }
              : {}),
            sources: r.citable.slice(0, MAX_REFERENCE_CARDS).map((e) => ({
              handle: e.handle ?? "",
              videoUrl: e.videoUrl,
              coverUrl: e.coverUrl,
              hookTemplate: e.hookTemplate,
              spokenHook: e.spokenHook,
              archetype: e.hookArchetype,
              format: e.format,
              visualSetting: e.visualSetting,
              editingStyle: e.editingStyle,
              multiplier: e.multiplier,
              views: e.views,
              baselineLabel: e.baselineLabel,
              // Retrieval's own §11c label. Not recomputed here — the card must not invent a
              // match claim the pipeline never made.
              fitLabel: e.fitLabel,
            })),
          },
        };
        input.onBlock(block); // live render this turn…
        uiBlocks.push(block); // …and persist, or the citation vanishes on reload while the prose stays
      }
    }

    // Execute the remaining calls in order, pushing a role:"tool" result the next round reads.
    for (const call of calls) {
      if (input.grounding && call.name === "search_corpus") continue; // already serviced above

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
        // Prefill per the capability's declared shape (text / url / tiktok-url); a value that
        // doesn't match is dropped, and a non-prefillable field never takes one.
        const prefill = resolvePrefill(cap.prefill, rawValue);
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
        // Every other refusal below tells the model not to answer the request in prose; this one used to
        // hand back a bare error, and the model read "the tool is unavailable" as licence to write the
        // pack itself. That is the free-content leak, so the same instruction rides here too.
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            error: "this skill is not available on this account",
            tell_the_creator: "Making that needs an account with credits.",
            note: "do NOT write the ideas/hooks/script yourself in prose as a substitute — offer the thinking instead",
          }),
        });
        continue;
      }
      const args = parseSkillArgs(call.args);
      const primary = skill.primaryArg ?? "topic";
      if (!args[primary]) {
        toolCalls.push({ name: skill.name, ran: false, note: `no ${primary}` });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: `no ${primary} provided` }) });
        continue;
      }
      if (skill.billable && paidRuns >= maxSkillRuns) {
        toolCalls.push({ name: skill.name, ran: false, note: "leash: run limit reached" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "skill run limit reached for this turn — ask the creator to confirm before running more" }),
        });
        continue;
      }

      // ── THE GATE — before the runner, because a refused run must cost nothing ──
      // The leash above bounds HOW MANY runs a turn may fire; it says nothing about whether this
      // creator can afford one. A run count is a blast radius, not consent to spend, and it was
      // the only thing standing between an agent decision and the paid engine.
      // The verdict's tier carries forward to the bill (see below).
      let admission: { allowed: boolean; reason?: string; tier?: NumenTier | null; quota?: unknown } | null = null;
      if (skill.billable) {
        if (!deps.billing) {
          // FAIL CLOSED. No till wired → the run does not happen. The alternative (run it free)
          // is exactly the defect this seam exists to close, and it would come back silently.
          toolCalls.push({ name: skill.name, ran: false, note: "no billing seam" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error:
                "this skill cannot be run right now — tell the creator plainly that it is unavailable " +
                "and suggest they try again shortly; do NOT answer the request in prose instead",
            }),
          });
          continue;
        }
        admission = await deps.billing.gate(skill.billable);
        if (!admission.allowed) {
          toolCalls.push({ name: skill.name, ran: false, note: "credit gate refused" });
          // Raise the SAME paywall the dedicated routes raise. The model still relays a sentence
          // below (the turn must not just stop), but the dialog is what carries the upgrade door.
          if (admission.quota !== undefined) input.onCreditWall?.(admission.quota);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: "not enough credits to run this",
              // The honest sentence the 402 wall would have shown. A mid-stream turn cannot BE a
              // 402, so the model relays it verbatim rather than inventing its own excuse.
              tell_the_creator: admission.reason ?? "You're out of credits for this action.",
              note: "do NOT run or fake the result, and do not answer the request in prose as though it succeeded",
            }),
          });
          continue;
        }
      }

      try {
        // Announce the dispatch BEFORE the run: the client's capsule labels itself + seeds the
        // skill's stage plan off this, ahead of the first onStage event (~seconds later).
        input.onDispatch?.(skill.skillKey);
        const { blocks } = await skill.run(args, input.context);
        if (skill.billable) {
          paidRuns++;
          // BILL ON DELIVERY — the cards are about to stream to the creator and nothing after this
          // can un-deliver them. (The dedicated routes bill after their insertMessage; here the
          // route persists once the loop returns, so this is the same "delivered" moment reached a
          // beat earlier. Best-effort by contract, so a ledger hiccup never costs the answer.)
          await deps.billing!.bill(skill.billable, admission?.tier);
        }
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
