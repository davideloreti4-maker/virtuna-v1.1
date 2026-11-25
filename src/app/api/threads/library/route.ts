/**
 * GET /api/threads/library — one page of the caller's chats, for the Library.
 *
 * `?cursor=` the `next` of the page before (opaque), `?q=` a search of the titles. Answers a
 * `LibraryPage` (`src/lib/library/library-page.ts`): per chat its id, title, time, pin and summary,
 * and never the stored data behind them. 404 with the flag off and for a funnel visitor (simulation
 * numbers never reach a /go session, `verdict-seal.ts`); 401 signed out; 400 a malformed cursor; 500
 * a database error, whose text goes to the server log only (the repository is public).
 *
 * Separate from `/api/threads/list` on purpose: that short list feeds the sidebar, Home and ⌘K.
 * Read-only and a GET: no csrfGuard (it 415s every request without a JSON body).
 */

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { decodeLibraryCursor, readLibraryPage } from "@/lib/library/library-page";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(request: Request): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (isSealedVisitor(user)) return notFound();

  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor") || null;
  if (cursor !== null && !decodeLibraryCursor(cursor)) {
    return Response.json({ error: "Bad cursor" }, { status: 400 });
  }

  try {
    return Response.json(await readLibraryPage(user.id, { cursor, q: params.get("q") }));
  } catch (err) {
    console.error("[threads/library] page read failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
