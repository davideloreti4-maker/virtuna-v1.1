/**
 * probe-thread-anchor.ts — what does the chat agent ACTUALLY see of a thread's history?
 *
 * `openChatPriorTurns` is the whole of the agent's memory. It walks the persisted thread and keeps
 * `markdown` turns plus the three GENERATOR card types; anything else is skipped. This probe runs it
 * over REAL threads and prints, per thread, the blocks that exist versus the turns the model gets —
 * so a hole in the transcript is visible as a number rather than inferred from a reading of the code.
 *
 * FREE — reads Supabase and calls no model.
 *
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
 *     scripts/probe-thread-anchor.ts
 */

import { openChatPriorTurns, NON_RECORD_BLOCKS, RECORDED_BLOCKS } from "@/lib/threads/chat-prior-turns";
import type { HydratedMessage } from "@/lib/threads/messages";

const RECORDED = new Set(RECORDED_BLOCKS);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

/** The body is either a raw blocks array or a { kcGenVersion, blocks } provenance wrapper. */
function unwrap(body: unknown): Array<{ type: string; props: Record<string, unknown> }> {
  if (Array.isArray(body)) return body as Array<{ type: string; props: Record<string, unknown> }>;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: Array<{ type: string; props: Record<string, unknown> }> }).blocks;
  }
  return [];
}

async function main() {
  // The busiest open threads across the whole project — whichever accounts have actually used it.
  const threads = await (
    await fetch(`${SUPABASE_URL}/rest/v1/threads?type=eq.open&select=id,title,updated_at&order=updated_at.desc&limit=40`, { headers: H })
  ).json();

  const rows: Array<{ id: string; title: string; blocks: string[]; turns: number; runs: number; records: string[] }> = [];

  for (const t of threads as Array<{ id: string; title: string | null }>) {
    const msgs = (await (
      await fetch(`${SUPABASE_URL}/rest/v1/messages?thread_id=eq.${t.id}&select=id,role,created_at,body&order=created_at.asc`, { headers: H })
    ).json()) as Array<{ id: string; role: string; created_at: string; body: unknown }>;
    if (msgs.length === 0) continue;

    const hydrated: HydratedMessage[] = msgs.map((m) => ({
      id: m.id,
      thread_id: t.id,
      role: m.role as "user" | "assistant" | "tool",
      created_at: m.created_at,
      blocks: unwrap(m.body),
    })) as HydratedMessage[];

    const blocks = hydrated.flatMap((m) => m.blocks.map((b) => b.type));
    const turns = openChatPriorTurns(hydrated);
    rows.push({
      id: t.id,
      title: (t.title ?? "").slice(0, 40),
      blocks,
      turns: turns.length,
      runs: turns.reduce((n, x) => n + (x.toolRuns?.length ?? 0), 0),
      records: turns.flatMap((x) => x.skillRecords ?? []),
    });
  }

  const globalInvisible = new Map<string, number>();
  console.log("thread                                 msgs→turns  runs  recs  UNREPRESENTED block types");
  for (const r of rows.sort((a, b) => b.blocks.length - a.blocks.length).slice(0, 20)) {
    // Unrepresented = neither replayed as a turn/tool-run, nor recorded, nor knowingly excluded.
    const invisible = r.blocks.filter((b) => !(b in NON_RECORD_BLOCKS) && !RECORDED.has(b));
    for (const b of invisible) globalInvisible.set(b, (globalInvisible.get(b) ?? 0) + 1);
    console.log(
      `${r.id.slice(0, 8)} ${r.title.padEnd(30).slice(0, 30)} ${String(r.blocks.length).padStart(4)}→${String(r.turns).padStart(3)}  ` +
        `${String(r.runs).padStart(4)}  ${String(r.records.length).padStart(4)}  ${[...new Set(invisible)].join(", ") || "—"}`,
    );
  }

  console.log("\n── Block types with NO representation in the chat anchor ──");
  const all = [...globalInvisible.entries()].sort((a, b) => b[1] - a[1]);
  if (all.length === 0) console.log("  none — every persisted block is replayed, recorded, or knowingly excluded");
  for (const [type, n] of all) console.log(`  ${String(n).padStart(4)}  ${type}`);

  const sample = rows.flatMap((r) => r.records).slice(0, 12);
  if (sample.length > 0) {
    console.log("\n── Sample context records the model now receives ──");
    for (const s of sample) console.log(`  · ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
