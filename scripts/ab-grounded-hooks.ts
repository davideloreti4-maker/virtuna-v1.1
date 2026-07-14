/**
 * ab-grounded-hooks.ts — does grounding actually make a BETTER hook?
 *
 * WHY THIS EXISTS. Everything built for grounding so far proves the MECHANISM: the corpus is
 * retrieved, the block is assembled, it reaches the model, the receipts are honest. None of it
 * proves the PAYOFF. The flags have been off since the subsystem was written, and not once has
 * anyone put a grounded hook next to an ungrounded one for the same ask and looked.
 *
 * That is a lot of machinery resting on an unverified premise. This is the check: identical ask,
 * identical profile, identical platform, identical model — grounding is the ONLY variable.
 *
 * It calls the real Qwen generation path twice (costs a little). That is the point: a mocked
 * comparison would prove nothing about output quality.
 *
 * Run: npx tsx scripts/ab-grounded-hooks.ts ["your ask"]
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { runHooksPipeline } = require("@/lib/tools/runners/hooks-runner");

const ASK = process.argv[2] ?? "why founders should post daily even when it feels cringe";

/** One realistic creator. Held IDENTICAL across both arms. */
const PROFILE = {
  id: "ab-profile",
  user_id: "ab-user",
  niche_primary: "founder personal branding",
  target_audience: "early-stage B2B SaaS founders, technical, allergic to marketing",
  primary_goal: "inbound leads for a fractional CMO offer",
  past_wins: ["a raw selfie video about firing a client did 400k", "pricing threads convert"],
  past_flops: ["polished b-roll flops", "long explainers underperform"],
  target_platforms: ["tiktok"],
  writing_voice_sample:
    "Direct, opinionated, plain-spoken. Short sentences. No hype, no emoji, no growth-hack cliches.",
};

interface Block {
  props?: {
    hookLine?: string;
    mechanism?: string;
    rank?: number;
    band?: string;
    fraction?: string;
    scrollQuote?: string;
    /** Present ONLY when the model attributed this hook to a real retrieved source. */
    proof?: { handle?: string | null; multiplier?: number | null; views?: number | null } | null;
  };
}

async function arm(label: string, grounded: boolean): Promise<Block[]> {
  process.env.GROUNDING_HOOKS_ENABLED = grounded ? "true" : "false";
  const t0 = process.hrtime.bigint();
  const res = await runHooksPipeline({
    ask: ASK,
    platform: "tiktok",
    profileRow: PROFILE,
    audience: null,
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(
    `\n${"█".repeat(100)}\n  ${label}  ·  ${res.blocks.length} hooks  ·  ${Math.round(ms)}ms` +
      `${res.warnings.length ? `  ·  warnings: ${res.warnings.join(" | ")}` : ""}\n${"█".repeat(100)}`,
  );
  return res.blocks as Block[];
}

function show(blocks: Block[]): void {
  blocks.forEach((b, i) => {
    const p = b.props ?? {};
    const band = p.band ? `${p.band} ${p.fraction ?? ""}`.trim() : "—";
    console.log(`\n  ${i + 1}. [${band}]  "${p.hookLine ?? "(no hookLine)"}"`);
    if (p.mechanism) console.log(`      mechanism: ${String(p.mechanism).replace(/\s+/g, " ").slice(0, 140)}`);
    if (p.proof?.handle) {
      const m = p.proof.multiplier ? `${p.proof.multiplier}× · ` : "";
      console.log(`      ↳ adapted from @${p.proof.handle} (${m}${p.proof.views ?? "?"} views)`);
    } else {
      console.log(`      ↳ no source cited`);
    }
  });
}

async function main(): Promise<void> {
  console.log(`\nASK: "${ASK}"\nPROFILE: ${PROFILE.niche_primary} · voice held constant · platform tiktok`);
  console.log(`\nGrounding is the ONLY variable between the two arms.`);

  // UNGROUNDED FIRST — so the grounded arm cannot be flattered by a warm cache in the other's favour.
  const off = await arm("A — UNGROUNDED (GROUNDING_HOOKS_ENABLED=false)", false);
  show(off);

  const on = await arm("B — GROUNDED (GROUNDING_HOOKS_ENABLED=true, rank=structural)", true);
  show(on);

  const cited = on.filter((b) => b.props?.proof?.handle).length;
  console.log(`\n${"─".repeat(100)}`);
  console.log(`  grounded arm: ${cited}/${on.length} hooks cite a real source`);
  console.log(`  READ THEM. Is B actually better, or just better-decorated?`);
  console.log(`${"─".repeat(100)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
