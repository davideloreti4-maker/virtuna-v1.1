/**
 * POST /api/dev/mock/seed — DEV ONLY (404 in production).
 *
 * Populates the authenticated user's open thread with the hand-authored skill fixtures
 * (a "preloaded populated chat") so the composer / audience / thread rendering can be
 * iterated on WITHOUT spending Qwen tokens. Idempotent: clears the open thread's messages
 * first, then inserts SEED_MESSAGES via the real insertMessage write path (D-14 validation),
 * so the demo renders through the exact production renderers.
 *
 * Seeds into the CURRENT open thread (createOpenThreadLazy) rather than a new one, so the
 * thread id the client is already pointed at stays stable — the client just reloads.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { ACTIVE_THREAD_COOKIE } from "@/lib/threads/active-thread-cookie";
import { isDevMockAllowed } from "@/lib/dev/dev-mock";
import { SEED_MESSAGES } from "@/lib/tools/mock/fixtures";

export async function POST(): Promise<Response> {
  if (!isDevMockAllowed()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Current open thread (create lazily if the account has none yet).
  const thread = await createOpenThreadLazy(user.id);

  // Clear existing messages so re-seeding never stacks duplicates (service role — the
  // dev route already proved ownership via the session above).
  const service = createServiceClient();
  await service.from("messages").delete().eq("thread_id", thread.id);

  // Insert the fixture messages in render order (validated per-block by insertMessage).
  let inserted = 0;
  for (const msg of SEED_MESSAGES) {
    await insertMessage(thread.id, msg.role, msg.blocks);
    inserted += 1;
  }

  // Point the active-thread pointer at the seeded thread so getOpenThread resolves it on
  // the client's next load (otherwise a blank NEW_THREAD_SENTINEL pointer hides the seed).
  // Not httpOnly by design — the server always re-verifies ownership before trusting it.
  const store = await cookies();
  store.set(ACTIVE_THREAD_COOKIE, thread.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
  });

  return Response.json({ threadId: thread.id, messages: inserted });
}
