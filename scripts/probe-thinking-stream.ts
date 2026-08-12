/**
 * probe-thinking-stream.ts — does reasoning leak into the creator's stream?
 *
 * `enable_thinking: true` is now set for composed-card turns. The loop only ever forwards
 * `delta.content` to `onToken`, so reasoning arriving as `delta.reasoning_content` is dropped —
 * but "the field we do not read" is an assumption about the provider, and a wrong one puts the
 * model's private deliberation on the creator's screen. This asserts it against live DashScope.
 *
 * Two passes:
 *   1. RAW — stream one thinking completion and report which delta fields actually carry text.
 *   2. END TO END — run the real `runChatAgentStream` with composedCards on and check that every
 *      token the creator would see is answer text, and that a card still lands.
 *
 * Run: `npx tsx scripts/probe-thinking-stream.ts`
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

async function rawPass() {
  console.log(`── 1. RAW stream · ${QWEN_REASONING_MODEL} · enable_thinking: true`);
  const stream = await getQwenClient().chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [{ role: "user", content: "Name one reason a founder's failure story outperforms a tips video. One sentence." }],
    temperature: 0.3,
    seed: QWEN_SEED,
    max_tokens: 1200,
    enable_thinking: true,
    stream: true,
  });

  const fields = new Map<string, number>();
  let content = "";
  let reasoning = "";
  for await (const chunk of stream as AsyncIterable<{ choices?: Array<{ delta?: Record<string, unknown> }> }>) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    for (const [k, v] of Object.entries(delta)) {
      if (typeof v === "string" && v.length > 0) fields.set(k, (fields.get(k) ?? 0) + v.length);
    }
    if (typeof delta.content === "string") content += delta.content;
    if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content;
  }

  console.log(`   delta fields carrying text: ${[...fields].map(([k, n]) => `${k}(${n} chars)`).join(", ") || "(none)"}`);
  console.log(`   reasoning_content: ${reasoning.length} chars`);
  console.log(`   content:           ${content.length} chars → ${JSON.stringify(content.slice(0, 160))}`);
  if (reasoning.length === 0) {
    console.log("   ⚠️  NO reasoning_content — either thinking is not active, or it is inside `content`.");
  }
  return { content, reasoning };
}

async function endToEndPass() {
  console.log("\n── 2. END TO END · runChatAgentStream({ composedCards: true })");
  const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");

  let streamed = "";
  const blocks: unknown[] = [];
  const res = await runChatAgentStream(
    {
      // An ask NO generator covers, so emit_card is the only way to answer with structure. With a
      // hooks ask and generate_hooks bound, the paid skill wins and no card is composed at all —
      // which is its own finding, recorded in the spike write-up.
      ask: "greenscreen vs talking head for explaining a technical product — which works better and why?",
      context: { platform: "tiktok", profileRow: null, audience: null },
      systemPrompt: "You are Maven, a strategist for short-form video creators.",
      grounding: true,
      composedCards: true,
      onToken: (d) => {
        streamed += d;
      },
      onBlock: (b) => blocks.push(b),
    },
    {
      // One bound generator so the turn is not treated as an unpaid visitor (which would switch
      // models and run the artefact guard, and this probe is about neither).
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
    },
  );

  const composed = blocks.filter((b) => (b as { type?: string })?.type === "composed-card");
  console.log(`   tool calls: ${res.toolCalls.map((t) => `${t.name}${t.ran ? "" : `(refused: ${t.note})`}`).join(", ") || "(none)"}`);
  console.log(`   composed-card blocks: ${composed.length}`);
  console.log(`   streamed to the creator (${streamed.length} chars): ${JSON.stringify(streamed.slice(0, 300))}`);

  // The tells: reasoning is first-person deliberation about the task.
  const leak = /(?:^|\s)(?:okay|let me|i need to|first,? i|the user (?:is )?(?:want|ask))/i.test(streamed);
  console.log(`   looks like leaked deliberation: ${leak ? "⚠️  YES" : "no"}`);
  for (const b of composed.slice(0, 1)) {
    const props = (b as { props: Record<string, unknown> }).props;
    console.log(`   sample card: recipe=${props.recipe} deliverable=${JSON.stringify((props.deliverable as { text?: string })?.text)}`);
  }
  return { streamed, composed: composed.length, leak };
}

async function main() {
  const raw = await rawPass();
  const e2e = await endToEndPass();

  console.log("\n── VERDICT");
  const separated = raw.reasoning.length > 0;
  console.log(`   reasoning arrives in its own field: ${separated ? "yes" : "NO"}`);
  console.log(`   creator stream free of deliberation: ${e2e.leak ? "NO ⚠️" : "yes"}`);
  console.log(`   a card still rendered: ${e2e.composed > 0 ? "yes" : "no"}`);
  if (!separated || e2e.leak) {
    console.error("\nFAIL: thinking is not safely separated from the creator's stream.");
    process.exit(1);
  }
  console.log("\nPASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
