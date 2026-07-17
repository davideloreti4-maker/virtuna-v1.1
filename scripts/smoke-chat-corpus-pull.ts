/**
 * smoke-chat-corpus-pull.ts — LIVE end-to-end proof of the Option-A chat reference-mode pull.
 *
 * (1) calls gatherReferencesViaTool directly → prints the rows the real model chose to pull + telemetry.
 * (2) runs runChatPipeline with GROUNDING_CHAT_TOOL=true → prints the streamed answer grounded on them.
 * If the answer cites a pulled @handle, the whole Option-A path works on the real model+corpus.
 *
 * Run (FOREGROUND, sandbox OFF): npx tsx scripts/smoke-chat-corpus-pull.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

process.env.GROUNDING_CHAT_TOOL = "true";

/* eslint-disable @typescript-eslint/no-require-imports */
const { gatherReferencesViaTool, buildReferenceBlock } = require("@/lib/grounding/corpus-tool");
const { runChatPipeline } = require("@/lib/tools/runners/chat-runner");

const ASK =
  process.env.SMOKE_ASK ??
  "I'm stuck at 400 followers. What's the actual strategy to get to my first 1000, and what hook styles tend to work for creator-growth videos?";
const PLATFORM = "tiktok";

async function main(): Promise<void> {
  console.log("SMOKE: chat corpus PULL (Option A)  flag=GROUNDING_CHAT_TOOL=true\n");

  // (1) direct pull — what did the model fetch?
  console.log("─── (1) gatherReferencesViaTool — the model's own pulls ───");
  const { references, toolCalls } = await gatherReferencesViaTool({ ask: ASK, platform: PLATFORM });
  toolCalls.forEach((t: any, i: number) =>
    console.log(`  [${i + 1}] r${t.round} axis=${t.axis} rows=${t.rows}${t.error ? ` ERR:${t.error}` : ""}  q="${t.query}"`),
  );
  console.log(`  → ${references.length} distinct references pulled: ${references.map((r: any) => "@" + r.handle).join(", ")}`);
  console.log("\n  reference block injected into the stream:\n" + buildReferenceBlock(references).split("\n").map((l: string) => "    " + l).join("\n"));

  // (2) full pipeline — does the streamed answer ground on them?
  console.log("\n─── (2) runChatPipeline (flag ON) — the grounded streamed answer ───");
  let streamed = "";
  const result = await runChatPipeline(
    { ask: ASK, platform: PLATFORM, profileRow: null, priorTurns: [], audience: null },
    (d: string) => {
      streamed += d;
    },
  );
  console.log(result.fullContent);

  // machine check: did the answer cite a pulled handle?
  const handles = [...new Set(references.map((r: any) => r.handle).filter(Boolean))];
  const cited = handles.filter((h: any) => result.fullContent.toLowerCase().includes(String(h).toLowerCase()));
  console.log("\n─── VERDICT ───");
  console.log(`  references pulled: ${references.length}   answer cites a pulled handle: ${cited.length ? "YES → " + cited.map((h) => "@" + h).join(", ") : "no (read the answer)"}`);
  console.log(`  ${references.length > 0 ? "✅ Option-A chat pull works end-to-end on the real path" : "⚠️ no rows pulled — check corpus/env"}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
