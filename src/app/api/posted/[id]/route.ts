/**
 * DELETE /api/posted/[id] — removes the caller's posted link (plan 2026-11-24-after-posting, Task 2).
 *
 * The row is kept with `removed_at` set (ruling 5: removing a link never lowers the day's limit), through the
 * service client scoped to the caller (ruling 12). 204 removed · 404 not the caller's live link (another
 * person's, already removed, or an id that is not one) · 404 with the flag off and for a funnel visitor ·
 * 401 signed out · 403 another origin (`csrfGuard`; a bodyless DELETE needs no JSON type) · 500 `Server error`.
 */

import { removePost } from "@/lib/posted/posted-repo";
import { logFailure, notFound, postedGate, serverError } from "@/lib/posted/route-gate";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await postedGate(request, true);
  if ("answer" in gate) return gate.answer;

  const { id } = await params;
  try {
    const removed = await removePost(createServiceClient(), gate.userId, id, new Date());
    return removed ? new Response(null, { status: 204 }) : notFound();
  } catch (err) {
    logFailure("remove", err);
    return serverError();
  }
}
