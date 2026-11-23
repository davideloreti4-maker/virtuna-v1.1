/**
 * GET /api/threads/[id]/seals/[key] — one text simulation's result, for its page
 * `/simulation/hook/[threadId]/[key]` (thread answers step 2, spec §4).
 *
 * The key is `sealHashOf(text)` (the same function every link uses); the seal is found by hashing each
 * text seal of the thread. Answers `{ text, at, population, open }`; 401 signed out; 404 for everything else
 * the page must not show (flag off, a funnel visitor, a malformed id or key, a thread that is not the
 * caller's, an unknown key, a video seal, a seal with no population number). Any status: an archived
 * thread's result stays its creator's. A database error is a 500 whose text goes to the server log only.
 *
 * Read-only and a GET: no csrfGuard (it 415s every request without a JSON body).
 */

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";
import { isSealHash, sealHashOf } from "@/lib/thread-next/seal-hash";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { readSimSeals } from "@/lib/threads/sim-seals";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Text seals never cross the wire to a /go visitor (verdict-seal.ts).
  if (isSealedVisitor(user)) return notFound();

  const { id, key } = await params;
  // A non-uuid id would be a 22P02 from Postgres, not a 404.
  if (!UUID.test(id) || !isSealHash(key)) return notFound();

  const { data: row, error } = await supabase
    .from("threads")
    .select("id, type, sim_seals")
    .eq("id", id)
    .eq("user_id", user.id) // ownership, belt and braces with RLS
    .maybeSingle();
  if (error) {
    // The repository is public: the database's text goes to the log, never on the wire.
    console.error("[threads/seals] thread read failed:", error.message);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
  if (!row) return notFound();

  for (const [text, seal] of Object.entries(readSimSeals(row))) {
    if (seal.video || stopNumberOf(seal) === null) continue;
    if ((await sealHashOf(text)) === key) {
      // `open`: "Script this one" runs in the open thread only (the active-thread cookie steers to open threads).
      return Response.json({ text, at: seal.at, population: seal.population, open: row.type === "open" });
    }
  }
  return notFound();
}
