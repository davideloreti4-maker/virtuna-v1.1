/**
 * B3, persisted proof. Read the hook-card blocks the Max-selected run stored.
 * If they record sim1-flash, the override didn't just fail to reach the wire —
 * the run recorded the opposite of what the UI said was armed.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync("/Users/davideloreti/virtuna-e2e-audit/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.log("missing supabase env:", Object.keys(env).filter((k) => /SUPABASE/.test(k))); process.exit(1); }
const sb = createClient(url, key);

const { data: msgs, error } = await sb
  .from("messages")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(25);
if (error) { console.log("ERR", error.message); process.exit(1); }

console.log("=== most recent model-bearing blocks ===");
let n = 0;
for (const m of msgs ?? []) {
  for (const b of ((m.body?.blocks ?? m.body ?? []))) {
    if (!b?.props?.model) continue;
    console.log(`${m.created_at}  ${String(b.type).padEnd(12)} model=${b.props.model}  "${String(b.props.hookLine || "").slice(0, 50)}"`);
    if (++n >= 12) break;
  }
  if (n >= 12) break;
}
if (!n) console.log("(none found in the last 25 messages)");
