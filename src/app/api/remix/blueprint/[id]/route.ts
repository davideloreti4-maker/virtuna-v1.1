/**
 * GET /api/remix/blueprint/[id] — the beat script for a remix card.
 *
 * The card carries only `blueprintId` + `blueprintVariant`; the script is fetched. Inlining it on
 * the block would duplicate state that phase 5's revise_remix rewrites, and the copy frozen in the
 * thread message would drift from the row with nothing to detect it.
 *
 * THREE outcomes, and the third is deliberately not folded into the second:
 *   200 — the row, reduced to `script` + `blueprint`
 *   404 — `getBlueprint` returned null, i.e. no such row FOR THIS USER
 *   500 — `getBlueprint` threw
 *
 * Task 4 made the repo throw on every fault except PGRST116 so that an unapplied migration is
 * LOUD: this table is applied by hand, so an unapplied one is a live possibility on any deploy,
 * and PostgREST answers an unknown table with PGRST205. Catching that back into a 404 would give
 * `RemixBeats` its silent no-render path and print a remix card with no shoot sheet and no error
 * anywhere in the stack — the feature would look unbuilt rather than broken. `null` means 404,
 * and only that.
 */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { getBlueprint } from "@/lib/remix/blueprint-repo";
import { signAnalysisFrames } from "@/lib/engine/filmstrip/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** nanoid(12) shape, matching analysis ids and the block schema's own `blueprintId` regex. */
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/u;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const log = createLogger({ module: "api.remix.blueprint" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ID_RE.test(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }

  let row;
  try {
    // Ownership is enforced INSIDE the query (id AND user_id), not by RLS — the service client
    // bypasses RLS entirely. A valid id belonging to someone else comes back null, i.e. a 404.
    row = await getBlueprint(createServiceClient(), id, user.id);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "api.remix.blueprint" } });
    log.error("blueprint read failed", {
      blueprintId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Blueprint read failed" }, { status: 500 });
  }

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  // PHASE 3 — the beat frames, RE-SIGNED on every read.
  //
  // `uploadFrameAndGetSignedUrl` mints a 30-day URL at write time and that URL is deliberately not
  // persisted anywhere: a card rendered on day 31 would carry a dead <img>, and a card shared in a
  // thread would carry a live credential. `signAnalysisFrames` lists the prefix and signs fresh —
  // its first argument is a path prefix, not an analyses FK, so a `blueprintId` is a valid key.
  //
  // Ownership is already settled above: `getBlueprint` matched id AND user_id, so reaching this
  // line means this user owns this prefix. The service client below inherits that scoping and
  // never widens it.
  //
  // Degrades to `{}` on any storage fault — the sheet then renders exactly the phase-1 text rows,
  // which is a complete product. A frame list is an enhancement and is never worth a 500.
  let frames: Record<number, string> = {};
  try {
    frames = await signAnalysisFrames(id);
  } catch (err) {
    log.warn("beat frames could not be signed — serving the text sheet", {
      blueprintId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Only the fields the sheet renders. The row also carries `user_id` and `thread_id`, which no
  // client needs and neither should cross the wire.
  return Response.json({ script: row.script, blueprint: row.blueprint, frames });
}
