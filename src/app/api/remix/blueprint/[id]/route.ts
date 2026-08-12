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

  // Only the two fields the sheet renders. The row also carries `user_id` and `thread_id`, which
  // no client needs and neither should cross the wire.
  return Response.json({ script: row.script, blueprint: row.blueprint });
}
