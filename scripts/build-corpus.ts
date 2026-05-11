import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

// Load .env.local (Next.js convention — same pattern as other scripts)
config({ path: resolve(__dirname, "../.env.local") });

// Register tsconfig-paths so @/ aliases resolve correctly at runtime.
// Must happen before any @/-aliased modules are required.
const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildCorpus } = require("../src/lib/engine/corpus/orchestrator");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseBuildCorpusArgs,
  BuildCorpusArgsError,
} = require("../src/lib/engine/corpus/cli/build-corpus-args");

const log = (msg: string) => console.log(`[build-corpus] ${msg}`);

async function main() {
  let args;
  try {
    args = parseBuildCorpusArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof BuildCorpusArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(1);
    }
    throw err;
  }

  log(
    `Starting corpus build: version=${args.version} pilot=${args.isPilot} dryRun=${args.dryRun}`,
  );
  const result = await buildCorpus({
    corpusVersion: args.version,
    isPilot: args.isPilot,
    dryRun: args.dryRun,
  });
  log(`Inserted: ${result.inserted}`);
  log(`Failed configs: ${result.failed.length}`);
  log(`Summary: ${JSON.stringify(result.summary, null, 2)}`);
  if (result.failed.length > 0) {
    log("Failures:");
    for (const f of result.failed) log(`  ${f.niche}/${f.config}: ${f.error}`);
  }
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
