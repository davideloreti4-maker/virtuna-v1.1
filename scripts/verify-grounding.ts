/**
 * verify-grounding.ts — live E2E of the PRODUCTIZED gather path (grounding/orchestrator).
 * Proves scrape→select→profile-scrape survivors→§12 gate→extract(Qwen)→cache-write(prod)→
 * RetrievedExample[]. Writes real rows to outlier_teardowns. Run: npx tsx scripts/verify-grounding.ts ["query"] [topN]
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });
import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { gatherAndExtract } from "../src/lib/grounding/orchestrator";
import { formatCorpusForPrompt } from "../src/lib/grounding/prompt";

async function main() {
  const query = process.argv[2] ?? "high protein breakfast";
  const topN = process.argv[3] ? parseInt(process.argv[3], 10) : 3;
  const t0 = Date.now();
  console.log(`\n=== live grounding verify — query "${query}", topN ${topN} ===\n`);

  const { examples, stats } = await gatherAndExtract({ query, platform: "tiktok", niche: "fitness", topN });

  console.log("STATS:", JSON.stringify(stats));
  console.log(`\nEXAMPLES (${examples.length}):`);
  for (const e of examples) {
    const mult = e.multiplier != null ? `${e.multiplier.toFixed(1)}× ${e.baselineLabel ?? ""}` : "(cheap fallback)";
    console.log(`\n  📎 @${e.handle ?? "?"} · ${mult} · ${e.views ?? "?"} views · id=${e.teardownId}`);
    console.log(`     [${e.hookArchetype ?? "?"} / ${e.format ?? "?"}]  hook: ${e.spokenHook ?? "—"}`);
    console.log(`     template: ${e.template?.skeleton?.join(" → ") ?? e.template?.name ?? "—"}`);
    console.log(`     why: ${e.whyItWorks ?? "—"}`);
  }
  console.log(`\n--- corpus block that would feed assembler.corpus ---\n${formatCorpusForPrompt(examples) ?? "(none)"}`);
  console.log(`\n⏱  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
main().catch((e) => { console.error("VERIFY FATAL:", e); process.exit(1); });
