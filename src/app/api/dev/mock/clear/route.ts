/**
 * POST /api/dev/mock/clear — DEV ONLY (404 in production).
 *
 * Empties the authenticated user's open thread (deletes its messages) so the sandbox can be
 * reset to a blank composer. Leaves the thread row itself intact (stable id for the client).
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenThread } from "@/lib/threads/threads";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { isDevMockAllowed } from "@/lib/dev/dev-mock";

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

  const thread = await getOpenThread(user.id);
  if (thread) {
    const service = createServiceClient();
    await service.from("messages").delete().eq("thread_id", thread.id);
  }

  // Reset the pointer to the blank new-thread state so the composer renders empty.
  const store = await cookies();
  store.set(ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL, {
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
  });

  return Response.json({ ok: true, threadId: thread?.id ?? null });
}
