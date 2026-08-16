/**
 * probe-thinking-content-channel.ts — WHICH delta field carries the reasoning?
 *
 * `probe-thinking-stream.ts` asserted that reasoning arrives as `delta.reasoning_content` and so
 * never reaches `onToken`. It streams a BARE completion: one user message, no tools. The composing
 * path in `chat-agent-loop.ts` binds tools on every round.
 *
 * Three production rows (2026-08-12, thread b13d63f4) persisted 20,742 / 33,165 / 18,484 chars of
 * the model's planning voice as the creator-facing answer, one of them terminated by a literal
 * `</think>`. The loop only ever accumulates `delta.content`, so that text came through the CONTENT
 * channel — which the raw probe says is impossible.
 *
 * This isolates the variables between them. N runs per condition, because a single live run cannot
 * clear a gate on a sampler (see adapt-call-is-nondeterministic).
 *
 * ─── MEASURED 2026-08-16 · qwen3.7-flash · 0 of 21 runs leaked ──────────────────────────────
 *
 *   A. bare call, no tools                          leak 0/8 · reasoning separated 8/8
 *   B. tools bound                                  leak 0/8 · reasoning separated 8/8
 *   C. shipped prompt (25,268 chars), real loop     leak 0/3
 *   D. shipped prompt + 10 prior turns, cards up    leak 0/6
 *
 * So `enable_thinking` does NOT reliably put reasoning in the content channel, and neither tools,
 * nor the shipped prompt, nor thread depth is the variable. The trigger is provider-side and rare:
 * production saw it 3 times in 4 identical asks on 2026-08-12 and 0 times in 6 on 2026-08-13.
 *
 * ⚠️ A clean run here is therefore NOT evidence the defect is gone. It is evidence it cannot be
 * summoned on demand, which is why the remedy is a boundary guard rather than a prompt change.
 *
 * Run: `node node_modules/.bin/tsx scripts/probe-thinking-content-channel.ts [N] [D]`
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");

/** The ask that leaked in production, verbatim. */
const ASK = "explain the structure of a story-time video, start to finish";

/** A stand-in for the composing tool set — shape matters, not the schema's detail. */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "emit_card",
      description: "Render a structured card to the creator.",
      parameters: {
        type: "object",
        properties: { recipe: { type: "string" }, title: { type: "string" } },
        required: ["recipe"],
      },
    },
  },
];

type Run = {
  contentChars: number;
  reasoningChars: number;
  openTag: boolean;
  closeTag: boolean;
  contentHead: string;
};

async function once(withTools: boolean): Promise<Run> {
  const stream = await getQwenClient().chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      { role: "system", content: "You are Maven, a strategist for short-form video creators." },
      { role: "user", content: ASK },
    ],
    temperature: 0.3,
    seed: QWEN_SEED,
    max_tokens: 4000, // COMPOSING_MAX_TOKENS
    enable_thinking: true,
    ...(withTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
    stream: true,
  });

  let content = "";
  let reasoning = "";
  for await (const chunk of stream as AsyncIterable<{ choices?: Array<{ delta?: Record<string, unknown> }> }>) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === "string") content += delta.content;
    if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content;
  }

  return {
    contentChars: content.length,
    reasoningChars: reasoning.length,
    openTag: content.includes("<think>"),
    closeTag: content.includes("</think>"),
    contentHead: content.slice(0, 120).replace(/\n/g, " "),
  };
}

/** The tells the production rows show: first-person deliberation about the task. */
const MONOLOGUE = /^\s*(the user (wants|is asking|asked)|okay,? (so|let)|let me (think|break)|i need to (break|figure|understand)|first,? i)/i;

async function condition(label: string, withTools: boolean, n: number) {
  console.log(`\n── ${label} (n=${n})`);
  const runs: Run[] = [];
  for (let i = 0; i < n; i++) {
    const r = await once(withTools);
    runs.push(r);
    const leak = MONOLOGUE.test(r.contentHead) || r.closeTag || r.openTag;
    console.log(
      `   ${i + 1}. content=${String(r.contentChars).padStart(5)}  reasoning_content=${String(r.reasoningChars).padStart(5)}` +
        `  <think>=${r.openTag ? "Y" : "n"} </think>=${r.closeTag ? "Y" : "n"}  ${leak ? "⚠️ LEAK" : "clean"}`,
    );
    console.log(`      content head: ${JSON.stringify(r.contentHead)}`);
  }
  const leaks = runs.filter((r) => MONOLOGUE.test(r.contentHead) || r.closeTag || r.openTag).length;
  const separated = runs.filter((r) => r.reasoningChars > 0).length;
  console.log(`   → reasoning in its own field: ${separated}/${n} · content-channel leak: ${leaks}/${n}`);
  return { leaks, separated, n };
}

/**
 * C. The SHIPPED prompt, through the real loop.
 *
 * A one-line system prompt is the trap `probes-stop-short-of-the-shipped-prompt` names: the real
 * one is tens of thousands of characters of constraints, and the leaked rows show the model
 * grinding through them ("One last check on the 'Live Grounding Bundle'…") until it degenerates.
 * This measures the only thing that matters — what reaches `onToken`, i.e. the creator's screen.
 */
/**
 * The thread the leak happened in was ~20 turns deep and had CARDS already on screen — the
 * monologue quotes the thread-state note back to itself ("results already on the creator's
 * screen…", "I will not mention the comparison cards"). That note only exists when prior turns
 * carried cards, so a priorTurns-less probe cannot produce the constraint set the model choked on.
 */
const PRIOR_TURNS = [
  { role: "user" as const, text: "what kind of content should I be making for a comedy storytelling account" },
  {
    role: "assistant" as const,
    text: "Your lane is escalating personal misfortune — the everyday disaster told straight.",
  },
  { role: "user" as const, text: "give me some hooks for that" },
  {
    role: "assistant" as const,
    text: "Here are five hooks built on that lane.",
    toolRuns: [
      {
        name: "generate_hooks",
        cards: 5,
        topic: "escalating personal misfortune",
        lines: [
          "I got banned from a Wetherspoons for a reason I still can't explain",
          "The day I accidentally joined someone else's wedding",
          "I lost my job over a group chat I wasn't even in",
          "My landlord and I have been lying to each other for two years",
          "I once queued 40 minutes for the wrong building entirely",
        ],
      },
    ],
  },
  { role: "user" as const, text: "which of those is strongest" },
  {
    role: "assistant" as const,
    text: "The Wetherspoons one. It names a specific place and withholds the reason, so the viewer has to stay for the answer.",
  },
  { role: "user" as const, text: "compare confession vs observational for my account" },
  {
    role: "assistant" as const,
    text: "Confession wins for you. Here is the comparison.",
    toolRuns: [
      {
        name: "generate_hooks",
        cards: 2,
        topic: "confession vs observational",
        lines: ["Confession — higher completion, harder to batch", "Observational — easier to batch, lower saves"],
      },
    ],
  },
  { role: "user" as const, text: "ok and what about posting times" },
  {
    role: "assistant" as const,
    text: "Post when your own audience is awake, not when a generic chart says. Your last six uploads all peaked in the evening.",
  },
];

async function realLoopCondition(n: number, withPriorTurns: boolean) {
  console.log(
    `\n── ${withPriorTurns ? "D" : "C"}. SHIPPED prompt through runChatAgentStream` +
      `${withPriorTurns ? ` + ${PRIOR_TURNS.length} prior turns (cards on screen)` : " (no history)"} (n=${n})`,
  );
  const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
  const { KC_CHAT_SYSTEM_PROMPT } = await import("@/lib/kc/compiled");
  console.log(`   system prompt: ${KC_CHAT_SYSTEM_PROMPT.length} chars`);

  let leaks = 0;
  for (let i = 0; i < n; i++) {
    let streamed = "";
    const blocks: unknown[] = [];
    const res = await runChatAgentStream(
      {
        ask: ASK,
        currentAsk: ASK,
        context: { platform: "tiktok", profileRow: null, audience: null },
        systemPrompt: KC_CHAT_SYSTEM_PROMPT,
        grounding: true,
        composedCards: true,
        ...(withPriorTurns ? { priorTurns: PRIOR_TURNS } : {}),
        onToken: (d: string) => {
          streamed += d;
        },
        onBlock: (b: unknown) => blocks.push(b),
      } as never,
      {
        skills: [
          {
            name: "generate_hooks",
            skillKey: "hooks",
            billable: "hooks",
            schema: { type: "function", function: { name: "generate_hooks", parameters: { type: "object", properties: {} } } },
            run: async () => ({ blocks: [], warnings: [] }),
          } as never,
        ],
        billing: { gate: async () => ({ allowed: true, tier: "pro" as const }), bill: async () => {} } as never,
      } as never,
    );

    const head = streamed.slice(0, 120).replace(/\n/g, " ");
    const leak = MONOLOGUE.test(streamed) || streamed.includes("</think>") || streamed.includes("<think>");
    if (leak) leaks++;
    console.log(
      `   ${i + 1}. streamed=${String(streamed.length).padStart(6)} chars · persisted=${String((res as { text: string }).text.length).padStart(6)}` +
        ` · blocks=${blocks.length} · </think>=${streamed.includes("</think>") ? "Y" : "n"}  ${leak ? "⚠️ LEAK" : "clean"}`,
    );
    console.log(`      head: ${JSON.stringify(head)}`);
  }
  console.log(`   → content-channel leak: ${leaks}/${n}`);
  return { leaks, n };
}

async function main() {
  const n = Number(process.argv[2] ?? 5);
  console.log(`model: ${QWEN_REASONING_MODEL} · enable_thinking: true · seed: ${QWEN_SEED} · temp 0.3`);
  console.log(`ask:   ${JSON.stringify(ASK)}`);

  const only = process.argv[3]; // optional: "D" to run just the deep-thread condition
  if (only === "D") {
    const deep = await realLoopCondition(n, true);
    console.log(`\n── VERDICT\n   D (real prompt + history): leak ${deep.leaks}/${deep.n}`);
    return;
  }

  const bare = await condition("A. NO tools — what probe-thinking-stream.ts measured", false, n);
  const tooled = await condition("B. tools bound — what the composing loop actually sends", true, n);
  const real = await realLoopCondition(Math.min(n, 3), false);
  const deep = await realLoopCondition(Math.min(n, 3), true);

  console.log("\n── VERDICT");
  console.log(`   A (no tools):              leak ${bare.leaks}/${bare.n} · reasoning separated ${bare.separated}/${bare.n}`);
  console.log(`   B (tools bound):           leak ${tooled.leaks}/${tooled.n} · reasoning separated ${tooled.separated}/${tooled.n}`);
  console.log(`   C (real prompt):           leak ${real.leaks}/${real.n}`);
  console.log(`   D (real prompt + history): leak ${deep.leaks}/${deep.n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
