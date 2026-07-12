/**
 * POST /api/threads/user-turn — persist the creator's question into the open thread.
 *
 * Every generative skill persists its ASSISTANT output (cards / markdown) into the
 * open thread, but only `chat` used to persist the USER's turn. So re-opening an
 * ideas/hooks/script/remix/explore/general thread lost the question that produced
 * the cards — the top "you asked" bubble vanished (issue 3, "the user's message is
 * missing"). This route persists that turn for the non-chat skills, client-driven
 * on send (chat still persists its own turn server-side to keep its refine anchor).
 *
 * The turn is stored exactly like chat's user turn — a `role:"user"` message with a
 * single `markdown` block — so loadMessages round-trips it and the composer restores
 * it as `lastUserTurn` on rehydration (role-aware; never mixed into assistant cards).
 *
 * Security (mirrors the tool routes):
 *   - auth.getUser() 401 before any write; user_id from session only (CR-01).
 *   - csrfGuard 415/403.
 *   - createOpenThreadLazy resolves the SAME thread the skill will append to (the
 *     active-thread pointer cookie), so the user turn and its cards share a thread.
 *   - insertMessage re-validates the block at the write boundary (D-14).
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { csrfGuard } from "@/lib/http/csrf-guard";

/** Turn-text cap (chars) — mirrors the tool routes' MAX_MESSAGE_LENGTH. */
const MAX_TURN_LENGTH = 2000;

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

  let body: { text?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Malformed body → validated below.
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length === 0) {
    // Nothing to persist (e.g. Auto-mode empty ask) — a no-op success, not an error.
    return Response.json({ ok: true, persisted: false });
  }
  if (text.length > MAX_TURN_LENGTH) {
    return Response.json({ error: "text too long" }, { status: 400 });
  }

  const openThread = await createOpenThreadLazy(user.id);
  await insertMessage(openThread.id, "user", [{ type: "markdown", props: { text } }]);

  // The creator's own words are the best sidebar label — set it write-once
  // (no-op when the thread is already titled; best-effort by design).
  await setThreadTitleIfEmpty(user.id, openThread.id, text);

  return Response.json({ ok: true, persisted: true, threadId: openThread.id });
}
