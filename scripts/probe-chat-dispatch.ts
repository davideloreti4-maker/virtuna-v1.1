/**
 * probe-chat-dispatch.ts — does the chat agent DISPATCH a skill, or answer in prose?
 *
 * Drives the real agent loop with the real KC system prompt, the real assembled bundle and a real
 * profile row — the three things no unit test sees (`chat-agent-loop.test.ts` passes
 * `systemPrompt: "sys"`, and the route test mocks `assembleBundle` down to `input.ask`, which is why
 * 5000 green tests could not see either dispatch bug).
 *
 * COSTS NOTHING. `deps.billing` is deliberately OMITTED, so every billable skill FAILS CLOSED: the
 * model's tool call is recorded and the paid engine never runs. What is measured is the model's
 * DECISION, which is the thing under test — not the pack it would have produced.
 *
 * It replays a REAL persisted thread rather than a synthetic one. That distinction is load-bearing:
 * a hand-written two-turn transcript carrying the same poisoned sentence dispatched 3/3 and proved
 * nothing, while the actual thread reproduced the bug immediately. If you are chasing a
 * conversation-shaped defect, replay the conversation that failed.
 *
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
 *     scripts/probe-chat-dispatch.ts
 *
 * Env knobs: PROBE_THREAD (thread id) · PROBE_ASK (the ask to cut the history at)
 *            PROBE_GROUNDING=false (unbind the corpus tool; live default is ON)
 *            PROBE_DRY=true (print the reconstructed anchor and exit — no model calls)
 */

import { runChatAgentStream, type ChatAgentPriorTurn } from "@/lib/tools/chat-agent-loop";
import { openChatPriorTurns } from "@/lib/threads/chat-prior-turns";
import type { HydratedMessage } from "@/lib/threads/messages";
import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";
import { assembleBundle } from "@/lib/kc/assembler";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { createServiceClient } from "@/lib/supabase/service";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/** The thread whose later turns stopped dispatching (handoff §4), and the ask that failed in it. */
const THREAD_ID = process.env.PROBE_THREAD ?? "f5bdbadb-5cd2-496b-9598-7ef331cd7003";
const ASK = process.env.PROBE_ASK ?? "give me hooks for my student budgeting app that stops food delivery overspending";
const GROUNDING = process.env.PROBE_GROUNDING !== "false";
const SEEDS = [7, 101, 4242];

/**
 * The target ask plus its siblings. A fix that only makes the model dispatch MORE is not a fix — the
 * no-dispatch rows are what tell you the change bought precision rather than eagerness.
 */
const SWEEP: Array<{ ask: string; expect: "dispatch" | "no-dispatch" | "observe" }> = [
  { ask: ASK, expect: "dispatch" },
  { ask: "Give me a few more hook options.", expect: "dispatch" },
  { ask: "Which is strongest?", expect: "no-dispatch" },
  { ask: "why do my videos flop after the first 3 seconds?", expect: "no-dispatch" },
  { ask: "Punch them up", expect: "observe" },
];

async function load(): Promise<{ profileRow: ProfileRow | null; messages: HydratedMessage[] }> {
  const supabase = createServiceClient();
  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = users?.users?.find((u) => u.email === process.env.E2E_USER_EMAIL);
  if (!user) throw new Error(`no auth user for E2E_USER_EMAIL=${process.env.E2E_USER_EMAIL}`);
  const { data: profile } = await supabase.from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const { data: rows } = await supabase
    .from("messages")
    .select("id, thread_id, role, body, created_at")
    .eq("thread_id", THREAD_ID)
    .order("created_at", { ascending: true });

  const messages = (rows ?? []).map((r) => {
    const raw = (r as { body: unknown }).body;
    return {
      id: (r as { id: string }).id,
      thread_id: THREAD_ID,
      role: (r as { role: string }).role as HydratedMessage["role"],
      created_at: (r as { created_at: string }).created_at,
      blocks: (Array.isArray(raw) ? raw : ((raw as { blocks?: unknown[] })?.blocks ?? [])) as HydratedMessage["blocks"],
    };
  });
  return { profileRow: (profile as unknown as ProfileRow | null) ?? null, messages };
}

/** Everything the thread held the moment the failing ask was typed — the route loads BEFORE it persists. */
function historyBeforeAsk(messages: HydratedMessage[]): HydratedMessage[] {
  const idx = messages.findIndex((m) =>
    m.blocks.some((b) => b.type === "markdown" && String((b.props as { text?: string })?.text ?? "").trim() === ASK),
  );
  if (idx < 0) throw new Error(`ask not found in thread ${THREAD_ID}: "${ASK}"`);
  return messages.slice(0, idx);
}

async function runOne(priorTurns: ChatAgentPriorTurn[], seed: number, profileRow: ProfileRow | null, rawAsk: string) {
  const ask = assembleBundle({ ask: rawAsk, platform: "tiktok", mode: "chat", modeLabel: "copilot" }, profileRow);
  let text = "";
  const res = await runChatAgentStream(
    {
      ask,
      systemPrompt: KC_CHAT_SYSTEM_PROMPT,
      priorTurns,
      grounding: GROUNDING,
      context: { platform: "tiktok", profileRow },
      onToken: (d) => {
        text += d;
      },
      onBlock: () => {},
    },
    { skills: SKILL_TOOLS, seed, maxRounds: 2 },
  );
  return {
    dispatched: res.toolCalls.some((c) => c.name.startsWith("generate_") || c.name === "write_script"),
    calls: res.toolCalls.map((c) => `${c.name}${c.note ? `(${c.note})` : ""}`).join(", ") || "-",
    text: text.replace(/\s+/g, " ").trim().slice(0, 140),
  };
}

async function main() {
  const { profileRow, messages } = await load();
  const history = historyBeforeAsk(messages);
  const withRuns = openChatPriorTurns(history);
  // The SHIPPED-before-the-fix anchor: the same turns with their tool runs stripped back to prose.
  const stripped: ChatAgentPriorTurn[] = withRuns.map(({ role, text }) => ({ role, text }));

  console.log(`thread ${THREAD_ID} — ${history.length} msgs before the ask → ${withRuns.length} prior turns`);
  for (const t of withRuns) {
    const mark = t.toolRuns?.length ? ` <<${t.toolRuns.map((r) => `${r.name}×${r.cards}`).join(",")}>>` : "";
    console.log(`   [${t.role}]${mark} ${t.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }
  console.log(`\ngrounding: ${GROUNDING}   seeds: ${SEEDS.join(", ")}`);
  // Cheap check that the thread loads and the anchor reconstructs, without spending a model call.
  if (process.env.PROBE_DRY === "true") {
    console.log(`DRY RUN — ${withRuns.filter((t) => t.toolRuns?.length).length} turn(s) carry runs. Exiting.`);
    return;
  }
  console.log("");

  const variants = [
    { key: "shipped", turns: stripped },
    { key: "fix    ", turns: withRuns },
  ];
  const table = ["| ask | expect | prose-only | runs replayed |", "|---|---|---|---|"];
  for (const item of SWEEP) {
    const counts: Record<string, number> = {};
    console.log(`== "${item.ask}"  (expect ${item.expect})`);
    for (const v of variants) {
      let hits = 0;
      for (const seed of SEEDS) {
        const r = await runOne(v.turns, seed, profileRow, item.ask);
        if (r.dispatched) hits++;
        console.log(`   ${v.key} seed ${String(seed).padStart(4)} ${r.dispatched ? "DISPATCH" : "none    "}  [${r.calls}]`);
        console.log(`                    "${r.text}"`);
      }
      counts[v.key.trim()] = hits;
    }
    table.push(`| ${item.ask.slice(0, 46)} | ${item.expect} | ${counts.shipped}/${SEEDS.length} | ${counts.fix}/${SEEDS.length} |`);
    console.log("");
  }
  // NB the DashScope `seed` is not fully deterministic — read these as rates, not fingerprints.
  console.log(table.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
