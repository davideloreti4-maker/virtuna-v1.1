import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount, type DeleteOutcome } from "@/lib/account/delete-account";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createLogger } from "@/lib/logger";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchWhopMembership } from "@/lib/whop/membership";

/**
 * POST /api/settings/account/delete — body { confirm: "DELETE" } as application/json (anything else 415). Deletes the caller's account: refused
 * while a Whop plan renews or a ledger row exists; files first, then the user (rows cascade).
 * The steps live in `deleteAccount`. Spec: docs/superpowers/specs/2026-11-26-settings-design.md, 3.2.
 */

const Body = z.object({ confirm: z.literal("DELETE") });

type Refusal = Extract<DeleteOutcome, { ok: false }>["reason"];
const STATUS: Record<Refusal, number> = {
  plan_renews: 409,
  ledger: 409,
  whop_unreachable: 503,
  files_failed: 500,
  delete_failed: 500,
};

const log = createLogger({ module: "api/settings/account/delete" });

/** The Content-Type's media type, lower case, without parameters such as charset. */
function mediaTypeOf(request: Request): string {
  return (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!NEW_LOOK_ENABLED) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSealedVisitor(user)) return NextResponse.json({ error: "visitor" }, { status: 403 });

  // JSON only: a cross-site form can send text/plain or a form encoding, never application/json without a
  // preflight. Checked before the body is read.
  if (mediaTypeOf(request) !== "application/json") return NextResponse.json({ error: "content_type" }, { status: 415 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "confirm" }, { status: 400 });

  let outcome: DeleteOutcome;
  try {
    outcome = await deleteAccount(user.id, {
      service: createServiceClient(),
      fetchMembership: (id) => fetchWhopMembership(id),
      log: (event, fields) => log.info(event, fields),
    });
  } catch (err) {
    // Not expected (Supabase answers errors, it does not throw them); never a bare 500 without a reason.
    log.error("delete: crashed", { error: err instanceof Error ? err.name : "unknown" });
    outcome = { ok: false, reason: "delete_failed" };
  }

  if (outcome.ok) return NextResponse.json({ deleted: true });
  const body = outcome.reason === "plan_renews" ? { error: outcome.reason, renewsAt: outcome.renewsAt } : { error: outcome.reason };
  return NextResponse.json(body, { status: STATUS[outcome.reason] });
}
