/**
 * fetch-madlib-pairs.mjs — pull (hookLine, proof.hookTemplate) pairs for replay-madlib-guard.ts.
 *
 * Defaults to the pre-regression window 2026-08-03..2026-08-09 — cards that carried proof BEFORE
 * `templateInstantiated` shipped. Reads the service key from .env.local itself.
 * Writes .scratch/pre-regression-pairs.json (gitignored).
 *
 *   node scripts/fetch-madlib-pairs.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const URL_=env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_KEY;
if(!KEY){console.error("no service key; keys:",Object.keys(env).filter(k=>k.includes("SUPABASE")).join(", "));process.exit(1);}
const r=await fetch(`${URL_}/rest/v1/messages?select=body,created_at&role=eq.assistant&created_at=gte.2026-08-03&created_at=lt.2026-08-09`,
  {headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});
if(!r.ok){console.error(r.status,(await r.text()).slice(0,200));process.exit(1);}
const rows=await r.json();
const pairs=[];
for(const row of rows) for(const b of (row.body?.blocks||[]))
  if(b.type==="hook-card"&&b.props?.proof?.hookTemplate&&b.props?.hookLine)
    pairs.push({hook_line:b.props.hookLine,template:b.props.proof.hookTemplate});
writeFileSync(".scratch/pre-regression-pairs.json",JSON.stringify(pairs,null,1));
console.log(`wrote ${pairs.length} pre-regression (hookLine, hookTemplate) pairs`);
