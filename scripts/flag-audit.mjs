#!/usr/bin/env node
// Flag audit — prints VERDICTS, never values. Safe to paste into a transcript.
// Run from the worktree root:  node scripts/flag-audit.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require(process.cwd() + "/node_modules/dotenv");

let parsed = {};
try {
  parsed = dotenv.parse(readFileSync(process.cwd() + "/.env.local"));
} catch (e) {
  console.error("cannot read .env.local:", e.code);
  process.exit(1);
}

// Predicates copied from the code, verified at 697a4b67.
const DEFAULT_ON = [
  "CHAT_AGENT_DISPATCH",
  "GROUNDING_CHAT_TOOL",
  "COMPOSED_CARDS",
  "ENGINE_AUDIO_SPLIT",
  "ENGINE_COUNT_HINT",
  "ENGINE_CHAT_CARDS_ON_SCREEN",
  "ENGINE_COMPARE_HINT",
  "ENGINE_GEN_CONVERSATION",
];
const DEFAULT_OFF = [
  "LIVE_SCRAPE_DEFAULT",
  "GROUNDING_HOOKS_ENABLED",
  "GROUNDING_HOOKS_ADAPT",
  "GROUNDING_IDEAS_ENABLED",
  "GROUNDING_IDEAS_ADAPT",
  "GROUNDING_SCRIPT_ENABLED",
  "GROUNDING_SCRIPT_ADAPT",
  "ENGINE_GUESS_PIN",
  "ENGINE_PROSE_CALL_PIN",
  "ENGINE_REPEAT_ASK_PIN",
  "ENGINE_JUDGE_HOOKS",
  "ENGINE_JUDGE_IDEAS",
  "ENGINE_JUDGE_SCRIPT",
  "NEXT_PUBLIC_AMBIENT_V2",
  "NEXT_PUBLIC_CONCEPT_V8",
  "NEXT_PUBLIC_ENGINE_ONE_BRAIN",
];
const KEEP_OFF = ["BILLING_ENFORCE_QUOTA", "GROUNDING_CHAT_PREFLIGHT"];
const SECRETS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DASHSCOPE_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "FILMSTRIP_EXTRACT_SECRET",
  "APIFY_TOKEN",
  "APIFY_WEBHOOK_SECRET",
  "REPLICATE_API_TOKEN",
];

const has = (k) => Object.prototype.hasOwnProperty.call(parsed, k);

console.log('\n── default-ON  (!== "false") ──────────────────────────');
for (const k of DEFAULT_ON) {
  const on = parsed[k] !== "false";
  const note = !has(k) ? "unset → ON" : on ? "ON" : '🔴 OFF — an explicit "false" is killing this';
  console.log(`  ${on ? "🟢" : "🔴"} ${k.padEnd(30)} ${note}`);
}

console.log('\n── default-OFF (=== "true") ───────────────────────────');
for (const k of DEFAULT_OFF) {
  const on = parsed[k] === "true";
  const note = !has(k) ? "MISSING → off" : on ? "ON" : 'set but not "true" → off';
  console.log(`  ${on ? "🟢" : "⚫"} ${k.padEnd(30)} ${note}`);
}

console.log("\n── must stay OFF ──────────────────────────────────────");
for (const k of KEEP_OFF) {
  const on = parsed[k] === "true";
  console.log(`  ${on ? "🔴 ON — turn this OFF" : "🟢 off"} ${k}`);
}

console.log('\n── NEXT_PUBLIC_REACT_SCAN (predicate is === "1") ──────');
console.log(`  ${parsed.NEXT_PUBLIC_REACT_SCAN === "1" ? "🔴 ON" : "🟢 off"}`);

console.log("\n── secrets / required (presence only) ──────────────────");
for (const k of SECRETS) {
  const set = has(k) && String(parsed[k]).length > 0;
  console.log(`  ${set ? "✓" : "✗"} ${k.padEnd(30)} ${set ? "SET" : "UNSET"}`);
}

const known = new Set([
  ...DEFAULT_ON,
  ...DEFAULT_OFF,
  ...KEEP_OFF,
  ...SECRETS,
  "NEXT_PUBLIC_REACT_SCAN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
]);
const extra = Object.keys(parsed).filter((k) => !known.has(k));
console.log(`\n── keys in .env.local not in this audit (${extra.length}) ──`);
console.log(extra.length ? "  " + extra.join("\n  ") : "  (none)");
console.log();
