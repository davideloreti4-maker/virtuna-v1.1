/**
 * /api/threads/[id] — Thread update + delete route.
 *
 * PATCH  — update thread fields. Currently only supports active_audience_id (D-04).
 * DELETE — remove a chat thread from the sidebar (archive; see DELETE handler).
 *
 * Security:
 *  - Auth-first (T-07 pattern)
 *  - RLS-scoped via session client — only the thread owner can update
 *  - active_audience_id: null = General default; otherwise a real audience-row UUID.
 *    The column is `uuid`, so virtual sentinels ('general'/'preset-*') CANNOT persist
 *    here — they are rejected with a clean 400 (previously they reached Postgres and
 *    surfaced as a 500). General is represented by null; virtual presets stay session-
 *    local on the client until materialized into a real row.
 */

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { archiveThread, renameThread, setThreadPinned } from "@/lib/threads/threads";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { TablesUpdate } from "@/types/database.types";

const PatchSchema = z.object({
  // null = General default; otherwise must be a real audience UUID (the column is uuid).
  // A non-UUID string (e.g. a "preset-*" virtual sentinel) fails here → 400, never 500.
  active_audience_id: z.string().uuid().nullable().optional(),
  // Rename. An explicit title OVERWRITES whatever the write-once derivation chose —
  // the user saying what a thread is beats anything we inferred. An empty string
  // clears it back to null, which re-opens automatic derivation ("reset to auto").
  // Length is capped here as well as in cleanThreadTitle so an oversized body is a
  // 400 rather than a silent truncation.
  title: z.string().max(200).nullable().optional(),
  // Pin / unpin. Stored as a timestamp (see setThreadPinned) but expressed as a
  // boolean at the boundary — callers should not have to mint a clock value.
  pinned: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  if (!threadId) {
    return Response.json({ error: "Thread id required" }, { status: 400 });
  }

  // Parse body
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  // Rename and pin go through the threads repo rather than the generic update
  // below: both need normalisation the raw column write does not do (a rename is
  // cleaned so it cannot smuggle in a filename; a pin is a boolean at this
  // boundary but a timestamp in the column).
  if ("title" in parsed.data) {
    const ok = await renameThread(user.id, threadId, parsed.data.title);
    if (!ok) return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  if (typeof parsed.data.pinned === "boolean") {
    const ok = await setThreadPinned(user.id, threadId, parsed.data.pinned);
    if (!ok) return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const updatePayload: TablesUpdate<"threads"> = {};
  if ("active_audience_id" in parsed.data) {
    updatePayload.active_audience_id = parsed.data.active_audience_id ?? null;
  }

  // Title/pin already applied above — nothing left for the generic path.
  if (Object.keys(updatePayload).length === 0 && ("title" in parsed.data || "pinned" in parsed.data)) {
    return Response.json({ ok: true });
  }

  if (Object.keys(updatePayload).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  // Update — RLS enforces ownership via session client
  const { data, error } = await supabase
    .from("threads")
    .update(updatePayload)
    .eq("id", threadId)
    .eq("user_id", user.id) // belt-and-suspenders ownership check
    .select("id, active_audience_id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ thread: data });
}

/**
 * DELETE /api/threads/[id] — remove a chat thread from the sidebar.
 *
 * Implemented as an ARCHIVE (type "open" → "archived"), not a hard delete: the
 * conversation + its messages are preserved (no cascade) and simply drop out of
 * the open-threads list. Reversible at the data layer.
 *
 * Security:
 *   - Auth enforced before any write (CR-01); user_id from session only.
 *   - CSRF guard (cross-origin Origin 403; a bodyless DELETE is exempt from the
 *     Content-Type check by design — see csrf-guard.ts).
 *   - archiveThread is ownership-scoped by user_id and restricted to open threads.
 *
 * Response:
 *   200 { threadId } · 404 if not an owned open thread · 401 · 403 via csrfGuard
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guard = csrfGuard(request);
  if (guard) return guard;

  const { id: threadId } = await params;
  if (!threadId) {
    return Response.json({ error: "Thread id required" }, { status: 400 });
  }

  // archiveThread THROWS on a DB error, and this route had no catch — so the one
  // failure it did not anticipate (the `threads_type_check` drift that rejected
  // 'archived', F-021) surfaced as an unhandled 500 with no usable body. A 404 is
  // the honest answer for "not an owned open thread"; anything else is ours, and
  // the client needs to be able to say so.
  try {
    const ok = await archiveThread(user.id, threadId);
    if (!ok) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to archive thread" },
      { status: 500 },
    );
  }

  return Response.json({ threadId });
}
