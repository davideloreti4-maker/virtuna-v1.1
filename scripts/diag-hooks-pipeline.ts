/**
 * Throwaway diagnostic (P13 render-bug investigation).
 * Calls runHooksPipeline directly to see whether it returns blocks and, if not, why.
 * Run: npx tsx scripts/diag-hooks-pipeline.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
  const { GENERAL_AUDIENCE } = await import("@/lib/audience/audience-repo");

  const ask = process.argv[2] ?? "morning routine for busy founders";
  console.log(`\n=== runHooksPipeline ask="${ask}" platform=tiktok audience=General ===\n`);

  const t0 = Date.now();
  try {
    const { blocks, warnings, seedHookPath } = await runHooksPipeline({
      ask,
      platform: "tiktok",
      profileRow: null,
      audience: GENERAL_AUDIENCE,
    });
    const ms = Date.now() - t0;
    console.log(`DONE in ${(ms / 1000).toFixed(1)}s`);
    console.log(`seedHookPath: ${seedHookPath}`);
    console.log(`blocks.length: ${blocks.length}`);
    console.log(`warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
    if (blocks.length > 0) {
      console.log(`\nfirst block props:`);
      console.log(JSON.stringify(blocks[0].props, null, 2));
    }
  } catch (err) {
    console.error(`THREW after ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
    console.error(err);
  }
}

void main().then(() => process.exit(0));
