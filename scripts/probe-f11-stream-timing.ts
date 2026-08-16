/**
 * probe-f11-stream-timing.ts — F-11 "nothing streams", measured instead of asserted.
 *
 * THE ROW, as written 2026-08-09: "~5.5s of a bare 'Thinking…', then ~14s of a static checklist,
 * then five cards appear at once. Compare Perplexity: tokens immediately." Re-measured 08-09 as
 * "send → 2s nothing → 7s bare Thinking → 9.1s static checklist → 23.2s everything at once
 * (321→4,625 chars in ONE paint)."
 *
 * WHY THE ROW IS AMBIGUOUS, and what this actually decides. "Nothing streams" can mean three
 * different defects and they have three different fixes:
 *
 *   a. the TRANSPORT is not wired — no per-token frames exist
 *   b. the transport is wired but the model emits nothing for seconds (DEAD AIR before token 1)
 *   c. tokens exist but arrive bunched, so the text still lands as one paint (CADENCE)
 *
 * (a) is already answerable from code and is FALSE: `route.ts` sends `event: token` per delta and
 * `use-chat-stream.ts:295` accumulates it with a `setStreamingText` per token — wired since
 * `216df989` (2026-06-21), two months BEFORE the audit. It is also proven live from the opposite
 * direction: PR #523 exists because leaked reasoning STREAMED to the creator in real time. Text
 * that streams cannot also not-stream.
 *
 * So this probe measures (b) and (c), which code cannot answer.
 *
 * COSTS NOTHING. `deps.billing` is deliberately OMITTED, so every billable skill FAILS CLOSED —
 * the model's tool call is recorded and the paid engine never runs (same recipe as
 * probe-chat-dispatch.ts). That is not a limitation here: the dead air the row complains about
 * happens BEFORE any generator spins up, so it is fully in scope. What this probe CANNOT see is
 * the card-arrival burst — blocks never materialise without billing. That half needs a paid run
 * and is reported as UNMEASURED rather than guessed at.
 *
 * ⚠️ Sampled N times per shape, never once. `temperature: 0` + a fixed seed is NOT reproducible on
 * DashScope — a single run cannot clear or fail a gate, so every number below is a distribution.
 *
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
 *     scripts/probe-f11-stream-timing.ts
 *
 * Env knobs: PROBE_N (samples per shape, default 3) · PROBE_GROUNDING=false (unbind the corpus tool)
 */

import { runChatAgentStream } from "@/lib/tools/chat-agent-loop";
import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";
import { assembleBundle } from "@/lib/kc/assembler";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { createServiceClient } from "@/lib/supabase/service";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

const N = Number(process.env.PROBE_N ?? 3);
const GROUNDING = process.env.PROBE_GROUNDING !== "false";
/**
 * `composing` is `!!input.composedCards` (:955) and it drives FOUR things at once — most
 * importantly `enable_thinking: composing` (:1154), but also max_tokens, max_rounds and the
 * tool-use directive. So this knob is NOT a clean single-variable isolation of thinking; it is the
 * shipped toggle, which is the thing a decision would actually flip. Default ON, mirroring the
 * route (`COMPOSED_CARDS !== "false"`).
 */
const COMPOSING = process.env.PROBE_COMPOSING !== "false";

/**
 * Two shapes, because F-11 was measured on a SKILL turn and the fix for each is different.
 * A prose turn's dead air is pure model latency; a skill turn's also contains the dispatch
 * decision, which is the part the audit saw as "a bare Thinking…".
 */
const SHAPES: Array<{ key: string; ask: string; note: string }> = [
  {
    key: "prose",
    ask: "why do most morning routines fail",
    note: "no dispatch expected — pure streaming latency",
  },
  {
    key: "skill",
    ask: "give me 5 hooks for a video about student budgeting",
    note: "dispatch expected — the shape F-11 was measured on",
  },
];

interface Sample {
  shape: string;
  firstTokenMs: number | null;
  lastTokenMs: number | null;
  tokenCount: number;
  chars: number;
  /** Largest silent gap BETWEEN consecutive tokens — the "one paint" tell if it dominates. */
  maxGapMs: number;
  /** Share of total characters that arrived in the single largest burst. 1.0 == one paint. */
  biggestBurstShare: number;
  dispatchMs: number | null;
  blockCount: number;
  totalMs: number;
  /**
   * Every tool the model actually called. Without this the "skill" shape is uninterpretable: a
   * dispatch that never happened and a dispatch that happened-then-failed-closed both show
   * `dispatch —, blocks 0`, and they mean opposite things about F-11.
   */
  calls: string;
}

async function loadProfile(): Promise<ProfileRow | null> {
  const supabase = createServiceClient();
  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = users?.users?.find((u) => u.email === process.env.E2E_USER_EMAIL);
  if (!user) throw new Error(`no auth user for E2E_USER_EMAIL=${process.env.E2E_USER_EMAIL}`);
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (profile as unknown as ProfileRow | null) ?? null;
}

async function runOne(shape: { key: string; ask: string }, seed: number, profileRow: ProfileRow | null): Promise<Sample> {
  const ask = assembleBundle(
    { ask: shape.ask, platform: "tiktok", mode: "chat", modeLabel: "copilot" },
    profileRow,
  );

  const stamps: number[] = [];
  const sizes: number[] = [];
  let dispatchAt: number | null = null;
  let blockCount = 0;
  let chars = 0;

  const t0 = Date.now();
  const res = await runChatAgentStream(
    {
      ask,
      systemPrompt: KC_CHAT_SYSTEM_PROMPT,
      priorTurns: [],
      grounding: GROUNDING,
      // Mirror the ROUTE, which reads COMPOSED_CARDS !== "false" — default ON. A probe that leaves
      // this off is measuring a request the product does not send.
      composedCards: COMPOSING,
      context: { platform: "tiktok", profileRow },
      onToken: (d) => {
        stamps.push(Date.now() - t0);
        sizes.push(d.length);
        chars += d.length;
      },
      onBlock: () => {
        blockCount++;
      },
      onDispatch: () => {
        if (dispatchAt === null) dispatchAt = Date.now() - t0;
      },
    },
    { skills: SKILL_TOOLS, seed, maxRounds: 2 },
  );
  const totalMs = Date.now() - t0;

  // Cadence. A stream that "does not stream" shows up as ONE gap that dominates the wall clock and
  // one burst carrying nearly all the characters.
  let maxGap = 0;
  let burstIdx = 0;
  for (let i = 1; i < stamps.length; i++) {
    const gap = stamps[i] - stamps[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      burstIdx = i;
    }
  }
  // Characters delivered from the largest gap onward — i.e. after the longest silence.
  const afterBurst = sizes.slice(burstIdx).reduce((a, b) => a + b, 0);

  return {
    shape: shape.key,
    firstTokenMs: stamps.length ? stamps[0] : null,
    lastTokenMs: stamps.length ? stamps[stamps.length - 1] : null,
    tokenCount: stamps.length,
    chars,
    maxGapMs: maxGap,
    biggestBurstShare: chars > 0 ? afterBurst / chars : 0,
    dispatchMs: dispatchAt,
    blockCount,
    totalMs,
    calls: res.toolCalls.map((c) => `${c.name}${c.ran ? "" : "!"}${c.note ? `(${c.note})` : ""}`).join(", ") || "-",
  };
}

const med = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const fmt = (ms: number) => (Number.isNaN(ms) ? "  —  " : `${(ms / 1000).toFixed(2)}s`);

async function main() {
  const profileRow = await loadProfile();
  console.log(`F-11 stream timing — N=${N} per shape · grounding: ${GROUNDING} · composing/enable_thinking: ${COMPOSING} · billing OMITTED (free)`);
  console.log(`profile row: ${profileRow ? "present" : "NULL"}   prompt: KC_CHAT_SYSTEM_PROMPT (${KC_CHAT_SYSTEM_PROMPT.length} chars)\n`);

  const all: Sample[] = [];
  for (const shape of SHAPES) {
    console.log(`== ${shape.key}: "${shape.ask}"`);
    console.log(`   (${shape.note})`);
    for (let i = 0; i < N; i++) {
      const s = await runOne(shape, 7 + i * 97, profileRow);
      all.push(s);
      console.log(
        `   run ${i + 1}  first-token ${fmt(s.firstTokenMs ?? NaN).padStart(6)}` +
          `  tokens ${String(s.tokenCount).padStart(5)}` +
          `  chars ${String(s.chars).padStart(6)}` +
          `  max-gap ${fmt(s.maxGapMs).padStart(6)}` +
          `  post-gap-share ${(s.biggestBurstShare * 100).toFixed(0).padStart(3)}%` +
          `  dispatch ${s.dispatchMs === null ? "  —  " : fmt(s.dispatchMs)}` +
          `  blocks ${s.blockCount}` +
          `  total ${fmt(s.totalMs)}` +
          `  calls [${s.calls}]`,
      );
    }
    console.log("");
  }

  console.log("| shape | median first token | median tokens | median max gap | median post-gap share | median total |");
  console.log("|---|---|---|---|---|---|");
  for (const shape of SHAPES) {
    const rows = all.filter((r) => r.shape === shape.key);
    console.log(
      `| ${shape.key} | ${fmt(med(rows.map((r) => r.firstTokenMs ?? NaN)))} | ` +
        `${med(rows.map((r) => r.tokenCount))} | ${fmt(med(rows.map((r) => r.maxGapMs)))} | ` +
        `${(med(rows.map((r) => r.biggestBurstShare)) * 100).toFixed(0)}% | ` +
        `${fmt(med(rows.map((r) => r.totalMs)))} |`,
    );
  }

  console.log(`
READING THIS:
  • first token      = the DEAD AIR the row calls "a bare Thinking…". This is the number that
                       decides F-11b. The audit measured ~5.5s (and ~7s on re-walk).
  • median tokens    = how many separate frames the client got. >1 means the transport streams;
                       the row's literal claim "nothing streams" is about (a) and is already false.
  • max gap          = the longest silence BETWEEN tokens. If this is close to the total, the text
                       effectively arrives in one paint even though frames exist — that is F-11c.
  • post-gap share   = fraction of all characters arriving AFTER that longest silence. ~100% would
                       be the "321 → 4,625 chars in ONE paint" the re-walk described.
                       🔴 THIS METRIC IS ONLY MEANINGFUL IF max-gap IS LARGE. When every gap is
                       sub-second there is no "burst" to be on the far side of, and the number just
                       reports where the noise happened to peak — it swung 1%→100% across four runs
                       of the SAME shape. Read max-gap first; if it is small, ignore this column.
                       Kept rather than deleted so the next reader does not re-derive it.
  ⚠️ blocks are 0 by construction here (billing omitted) and onDispatch NEVER fires — the loop
     returns at chat-agent-loop.ts:1513 when there is no billing seam, and onDispatch is at :1552.
     That is a PROBE ARTIFACT, not a product defect. Read the 'calls' column instead: a skill the
     model committed to shows as generate_hooks!(no billing seam).
  ⚠️ The CARD-arrival burst is NOT measured by this probe and must not be reported as fixed or
     broken on its strength. That half needs a paid run.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
