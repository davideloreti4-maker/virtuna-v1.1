/**
 * One-shot backup — dump a user's `audiences` rows to a JSON file before a destructive edit.
 * Usage: npx tsx scripts/dump-audiences-backup.ts <userId> <outPath>
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const [userId, outPath] = process.argv.slice(2);
if (!userId || !outPath) {
  console.error("usage: dump-audiences-backup.ts <userId> <outPath>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("audiences").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`backed up ${(data ?? []).length} audience row(s) → ${outPath}`);
  for (const a of data ?? []) console.log(`  ${a.id}  ${a.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
