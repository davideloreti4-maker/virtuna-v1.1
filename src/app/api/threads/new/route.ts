/**
 * POST /api/threads/new — open a fresh chat thread ("New Thread" sidebar action).
 *
 * Inserts a new open thread for the user. Because updated_at defaults to now(),
 * it becomes the newest → ACTIVE thread, so the next composer load + every tool
 * route appends to this blank thread instead of the previous conversation.
 *
 * Security:
 *   - Auth enforced before any write (CR-01); user_id from session only.
 *   - CSRF guard (Content-Type 415 + cross-origin 403), mirrors the chat route.
 *
 * Response:
 *   200 { threadId: string }
 *   401 { error: "Unauthorized" } · 4xx via csrfGuard
 */

import { createClient } from "@/lib/supabase/server";
import { createNewThread } from "@/lib/threads/threads";
import { csrfGuard } from "@/lib/http/csrf-guard";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guard = csrfGuard(request);
  if (guard) return guard;

  const thread = await createNewThread(user.id);
  return Response.json({ threadId: thread.id });
}
