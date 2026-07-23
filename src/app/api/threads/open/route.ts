/**
 * GET /api/threads/open — read-back the user's open thread persisted messages.
 *
 * This closes the P3-deferred open-thread REHYDRATION debt (D-14/THREAD-07):
 *   03-04-SUMMARY §"Deferred to Phase 4": "the composer hardcodes persistedBlocks={[]}
 *   and there is no client read-back on mount. Phase 4 (Hooks) shares the same open
 *   thread + persistence, so wire the open-thread message load there."
 *
 * Security mitigations (T-04-10/T-04-11):
 *   - Auth enforced before any DB read (T-04-10 / CR-01)
 *   - Session user_id only — never from request body (CR-01)
 *   - loadMessages re-validates each block via validateBlock on rehydration (T-04-11 / D-14)
 *   - Invalid blocks degrade to the unsupported sentinel (never dropped)
 *
 * Response shapes:
 *   200 { messages: [] }                    — auth OK but no open thread yet
 *   200 { threadId: string, messages: [...] } — open thread found; blocks re-validated
 *   401 { error: "Unauthorized" }           — no session
 */

import { createClient } from "@/lib/supabase/server";
import { getOpenThread } from "@/lib/threads/threads";
import { loadMessages } from "@/lib/threads/messages";
import { readSimSeals } from "@/lib/threads/sim-seals";

export async function GET(_request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-04-10 / CR-01) ─────────────────────────────────────
  // Auth before ANY DB read; user_id from session only (never from request body).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) Fetch the user's open thread ─────────────────────────────────────
  const openThread = await getOpenThread(user.id);

  if (!openThread) {
    // No open thread yet — the user has not generated any ideas or hooks.
    // Return empty array (not an error — normal cold-start state).
    return Response.json({ messages: [] });
  }

  // ── (3) Load + rehydrate messages (D-14 double-validation) ───────────────
  // loadMessages re-validates each block via validateBlock on rehydration.
  // Invalid blocks become UnsupportedBlock sentinels ({ type: "__unsupported__" }) —
  // they are NEVER dropped (T-04-11 / D-14).
  const messages = await loadMessages(openThread.id);

  // Ambient v2 Phase D: the thread's sealed-sim verdicts (trimmed stimulus → { pct, band }), so the
  // composer can re-seal the v2 Overview rows on rehydrate (the measured % survives a reload).
  const simSeals = readSimSeals(openThread);

  return Response.json({ threadId: openThread.id, messages, simSeals });
}
