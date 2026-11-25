/**
 * GET /api/you — what the You page needs that no existing request gives (plan 2026-11-24-you):
 * the caller's connected accounts, the primary one's followers and what Maven read
 * (`src/lib/you/you-read.ts`). 404 with the flag off; 401 signed out; 500 on a database error,
 * whose text goes to the server log only (the repository is public). A /go visitor (anonymous) is
 * answered from their own rows, as the profile routes answer them. Read-only GET: no csrfGuard.
 */
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";
import { readYouPage } from "@/lib/you/you-read";

export async function GET(): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return Response.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return Response.json(await readYouPage(supabase, user.id));
  } catch (err) {
    console.error("[you] page read failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
