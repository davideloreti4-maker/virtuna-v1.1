/**
 * POST /api/threads/[id]/activate — re-open a past chat thread.
 *
 * Touches the thread's updated_at so it becomes the newest → ACTIVE open thread.
 * The composer then loads it on next mount/refetch and every tool route appends
 * to it, so the conversation resumes where it left off.
 *
 * Security:
 *   - Auth enforced before any write (CR-01); user_id from session only.
 *   - CSRF guard (Content-Type 415 + cross-origin 403).
 *   - touchThread is ownership-scoped by user_id and restricted to open threads.
 *
 * Response:
 *   200 { threadId } · 404 if not an owned open thread · 401 · 4xx via csrfGuard
 */

import { createClient } from "@/lib/supabase/server";
import { touchThread } from "@/lib/threads/threads";
import { csrfGuard } from "@/lib/http/csrf-guard";

export async function POST(
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

  const ok = await touchThread(user.id, threadId);
  if (!ok) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ threadId });
}
