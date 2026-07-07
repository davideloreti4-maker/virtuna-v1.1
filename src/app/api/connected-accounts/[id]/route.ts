/**
 * /api/connected-accounts/[id] — manage a single connected account.
 *
 *   DELETE  — disconnect the account. FK cascade drops its snapshots/posts; audiences
 *             calibrated from it keep their frozen personas (source_account_id → NULL).
 *             If it was the primary and others remain, the oldest is promoted.
 *   PATCH   — { is_primary: true } makes it the user's primary (default analytics view).
 *
 * Auth-first; the repo helpers re-pin every statement to the session user_id, so RLS +
 * the ownership filter both guarantee a user only touches their own accounts.
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  deleteConnectedAccount,
  setPrimaryAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";

const PatchSchema = z.object({ is_primary: z.literal(true) });

async function authAndId(
  ctx: { params: Promise<{ id: string }> },
): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; id: string }
  | { ok: false; res: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return { ok: false, res: Response.json({ error: "invalid_id" }, { status: 400 }) };
  }
  return { ok: true, supabase, userId: user.id, id };
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await authAndId(ctx);
  if (!gate.ok) return gate.res;
  const ok = await deleteConnectedAccount(gate.supabase, gate.userId, gate.id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(null, { status: 204 });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await authAndId(ctx);
  if (!gate.ok) return gate.res;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!PatchSchema.safeParse(body).success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const ok = await setPrimaryAccount(gate.supabase, gate.userId, gate.id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
