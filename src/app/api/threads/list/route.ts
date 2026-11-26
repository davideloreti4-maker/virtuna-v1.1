/**
 * GET /api/threads/list — list the user's open chat threads (sidebar history).
 *
 * Returns open threads newest-first (active = first). Titles are the PERSISTED
 * threads.title written at send time (write-once: typed ask > skill subject —
 * see setThreadTitleIfEmpty callers). Legacy/untitled threads fall back to a
 * role/block-aware derivation over their earliest messages: the first USER
 * text wins, else the first block-type headline (hook-card → hookLine,
 * idea-card → title, …). Derived titles are READ-REPAIRED back onto the row so
 * the message scan shrinks to nothing over time. No message bodies leak beyond
 * the short title snippet.
 *
 * (The old derivation — "first text-ish prop in the earliest message" — titled
 * every hooks Auto thread from the model follow-up, which opens near-identically:
 * "Hook #1 wins by…" × N. Hooks Auto runs persist no user turn, so the follow-up
 * was always the first match.)
 *
 * Security:
 *   - Auth enforced before any DB read (CR-01); user_id from session only.
 *   - Service client reads are scoped by user_id explicitly (bypasses RLS).
 *
 * Response:
 *   200 { threads: [{ id, title, updated_at, created_at }] }
 *   401 { error: "Unauthorized" }
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { listOpenThreads, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { deriveTitleFromBlocks, videoNameTitle } from "@/lib/threads/title";

/** Normalise a persisted message body to its blocks array (bare or { blocks } wrapper). */
function unwrapBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: unknown[] }).blocks;
  }
  return [];
}

export async function GET(_request: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await listOpenThreads(user.id);
  if (threads.length === 0) {
    return Response.json({ threads: [] });
  }

  // ── Fallback derivation — UNTITLED threads only (legacy / Auto runs) ────────
  // One scan of their earliest messages (ASC, first occurrence wins per bucket):
  // a user turn's text beats any assistant-derived headline, regardless of order.
  const untitled = threads.filter((t) => !t.title);
  const derivedByThread = new Map<string, string>();
  /** Shown only, never persisted (see `fileTitle` below). */
  const shownFileTitle = new Map<string, string>();

  if (untitled.length > 0) {
    const service = createServiceClient();
    const { data: msgRows } = await service
      .from("messages")
      .select("thread_id, role, body")
      .in("thread_id", untitled.map((t) => t.id))
      .order("created_at", { ascending: true })
      .limit(500);

    const userTitle = new Map<string, string>();
    const blockTitle = new Map<string, string>();
    // A simulation chat's only user turn is often the dropped file's name, which the derive refuses
    // (a file name is not a general title). Its video's name (no extension) is SHOWN for it, so the
    // drawer does not list it as "New chat"; it is not read-repaired, so a typed ask can still claim
    // the write-once slot (a simulation's card names the chat at the server, test-card.ts).
    const fileTitle = new Map<string, string>();
    for (const row of msgRows ?? []) {
      const { thread_id: tid, role } = row as { thread_id: string; role: string };
      const blocks = unwrapBody((row as { body: unknown }).body);
      if (role === "user" && !fileTitle.has(tid)) {
        const first = blocks[0] as { props?: { text?: unknown } } | undefined;
        const name = videoNameTitle(first?.props?.text);
        if (name) fileTitle.set(tid, name);
      }
      const bucket = role === "user" ? userTitle : blockTitle;
      if (bucket.has(tid)) continue; // first (earliest) message per bucket wins
      const title = deriveTitleFromBlocks(blocks);
      if (title) bucket.set(tid, title);
    }

    for (const t of untitled) {
      const derived = userTitle.get(t.id) ?? blockTitle.get(t.id);
      if (derived) derivedByThread.set(t.id, derived);
      else if (fileTitle.has(t.id)) shownFileTitle.set(t.id, fileTitle.get(t.id)!);
    }

    // Read-repair: persist what we derived (write-once guard keeps this safe
    // against a concurrent send). Future loads skip the scan for these threads.
    await Promise.all(
      [...derivedByThread].map(([tid, title]) => setThreadTitleIfEmpty(user.id, tid, title)),
    );
  }

  return Response.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title ?? derivedByThread.get(t.id) ?? shownFileTitle.get(t.id) ?? null,
      updated_at: t.updated_at,
      created_at: t.created_at,
      pinned_at: t.pinned_at ?? null,
    })),
  });
}
