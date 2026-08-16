/**
 * Probe: what `value` does the model pass to request_input(action:"explore") for an ask that
 * DESCRIBES the content sought ("find me videos going viral about people organically advertising
 * their app on tiktok")? The niche field feeds a caption-text keyword search (apify-provider
 * `searchQueries`), so a verbatim quote of the description is a query no caption will match.
 *
 * Real KC_CHAT_SYSTEM_PROMPT, real assembleBundle, shipped flag defaults, billing omitted
 * (billable skills fail closed — free). Vary seed to sample; report a rate, never one run.
 *
 * Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
 *        scripts/probe-explore-prefill.ts
 */
import { runChatAgentStream } from "@/lib/tools/chat-agent-loop";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { assembleBundle } from "@/lib/kc/assembler";

const ASKS = [
  // The screenshot ask — the reported defect.
  "find me videos going viral about people organically advertising their app on tiktok",
  // A second domain the tool description's example does NOT cover, so a pass here is
  // generalization, not an echo of the in-prompt example (the exemplar-echo trap).
  "what's blowing up right now with people documenting renovating their vans?",
];

const SEEDS = [7, 19, 42, 101, 213, 331, 512, 777];

interface BlockLike {
  type?: string;
  props?: { action?: string; prefill?: string };
}

async function probeOne(ask: string, seed: number) {
  const blocks: BlockLike[] = [];
  const res = await runChatAgentStream(
    {
      ask: assembleBundle(
        { ask, platform: "tiktok", mode: "chat", modeLabel: "copilot" },
        null,
      ),
      systemPrompt: KC_CHAT_SYSTEM_PROMPT,
      priorTurns: [],
      currentAsk: ask,
      context: { platform: "tiktok", profileRow: null },
      grounding: process.env.GROUNDING_CHAT_TOOL !== "false",
      composedCards: process.env.COMPOSED_CARDS !== "false",
      cardsSlot: process.env.NEXT_PUBLIC_ENGINE_ONE_BRAIN === "true",
      onToken: () => {},
      onBlock: (b: unknown) => blocks.push(b as BlockLike),
    },
    { seed }, // no billing dep → billable skills fail closed
  );
  const inputRequests = blocks
    .filter((b) => b.type === "input-request")
    .map((b) => ({ action: b.props?.action, prefill: b.props?.prefill }));
  const calls = res.toolCalls.map((c) => `${c.name}${c.note ? `(${c.note})` : ""}:${c.ran}`);
  return { seed, calls, inputRequests };
}

async function main() {
  for (const ask of ASKS) {
    console.log(`# ask: ${ask}`);
    for (const seed of SEEDS) {
      try {
        const r = await probeOne(ask, seed);
        console.log(JSON.stringify(r));
      } catch (e) {
        console.log(JSON.stringify({ seed, error: String(e).slice(0, 200) }));
      }
    }
  }
}

void main();
