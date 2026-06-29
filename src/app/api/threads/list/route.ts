/**
 * GET /api/threads/list — list the user's open chat threads (sidebar history).
 *
 * Returns open threads newest-first (active = first), each with a derived title
 * computed from its earliest text-bearing block. No message bodies leak beyond
 * the short title snippet.
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
import { listOpenThreads } from "@/lib/threads/threads";

const TITLE_MAX = 48;

/** Normalise a persisted message body to its blocks array (bare or { blocks } wrapper). */
function unwrapBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: unknown[] }).blocks;
  }
  return [];
}

/** Pull the first human-readable string out of a blocks array, for a thread title. */
function extractTitle(blocks: unknown[]): string | null {
  for (const block of blocks) {
    const props = (block as { props?: Record<string, unknown> } | null)?.props;
    if (!props) continue;
    const candidate =
      props.text ?? props.ask ?? props.seed ?? props.prompt ?? props.title ?? props.query;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, TITLE_MAX);
    }
  }
  return null;
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

  // Derive titles in one query: earliest message per thread (ordered ASC, first
  // occurrence wins). Scoped to the user's listed thread ids only.
  const ids = threads.map((t) => t.id);
  const service = createServiceClient();
  const { data: msgRows } = await service
    .from("messages")
    .select("thread_id, body, created_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: true })
    .limit(500);

  const titleByThread = new Map<string, string>();
  for (const row of msgRows ?? []) {
    const tid = (row as { thread_id: string }).thread_id;
    if (titleByThread.has(tid)) continue; // first (earliest) message wins
    const title = extractTitle(unwrapBody((row as { body: unknown }).body));
    if (title) titleByThread.set(tid, title);
  }

  return Response.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: titleByThread.get(t.id) ?? null,
      updated_at: t.updated_at,
      created_at: t.created_at,
    })),
  });
}
