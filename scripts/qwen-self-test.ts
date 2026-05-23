/**
 * Qwen provider self-test: verifies connectivity + JSON output for each slot.
 * Run: npx tsx scripts/qwen-self-test.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import OpenAI from "openai";

const ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const API_KEY  = process.env.DASHSCOPE_API_KEY;

if (!API_KEY) {
  console.error("DASHSCOPE_API_KEY not set in .env.local");
  process.exit(1);
}

const ai = new OpenAI({ apiKey: API_KEY, baseURL: ENDPOINT });

const SLOTS = [
  { name: "omni-plus",   model: process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-plus" },
  { name: "reasoning",   model: process.env.QWEN_REASONING_MODEL  ?? "qwen3.6-plus" },
  { name: "fast",        model: process.env.QWEN_FAST_MODEL       ?? "qwen3.6-flash" },
];

async function testSlot(name: string, model: string): Promise<boolean> {
  process.stdout.write(`  ${name} (${model}) ... `);
  try {
    const completion = await ai.chat.completions.create({
      model,
      messages: [{ role: "user", content: 'Return {"ok": true} and nothing else.' }],
      response_format: { type: "json_object" },
      extra_body: { enable_thinking: false },
    });
    const raw    = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim());
    if (parsed.ok === true) {
      console.log(`PASS (reported model: ${completion.model})`);
      return true;
    }
    console.log(`FAIL — unexpected response: ${JSON.stringify(parsed)}`);
    return false;
  } catch (err) {
    console.log(`FAIL — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

(async () => {
  console.log("\nQwen DashScope self-test\n");
  let passed = 0;
  for (const { name, model } of SLOTS) {
    const ok = await testSlot(name, model);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${SLOTS.length} slots passed`);
  process.exit(passed === SLOTS.length ? 0 : 1);
})();
