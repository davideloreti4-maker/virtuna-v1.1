/**
 * /api/tracked-accounts — typed watchlist CRUD (Phase 11 Plan 03, EXPLORE-05 / D-08).
 *
 * The flat, typed watchlist PRODUCER half: the Explore "+ Track account" button
 * (built in 11-05) POSTs here; P12's Library surface consumes GET. Auth-first idiom
 * (mirrors /api/saved):
 *  - getUser() gates every method; 401 when unauthenticated.
 *  - csrfGuard on the mutating methods (POST/DELETE) — Content-Type 415 + cross-origin
 *    403 (WR-01), mirroring the skill/scrape routes.
 *  - user_id is ALWAYS derived from the session inside tracked-accounts-repo (CR-01) —
 *    the request body NEVER supplies user_id.
 *  - POST is zod-validated by the repo (createTrackedAccount); re-tracking is an
 *    idempotent upsert (no dup rows, no error on the UNIQUE constraint).
 *
 * FLAT by construction (D-08): no folders, no tags. P12 EXTENDS (Library), never reworks.
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import {
  listTrackedAccounts,
  createTrackedAccount,
  deleteTrackedAccount,
} from "@/lib/tracked-accounts/tracked-accounts-repo";

/**
 * GET /api/tracked-accounts
 *
 * Returns the authenticated user's tracked accounts, newest first. This is the read
 * P12's Library surface consumes; P11 only needs it to exist.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await listTrackedAccounts(supabase);
    return Response.json({ accounts });
  } catch (error) {
    console.error("[tracked-accounts] GET error:", error);
    return Response.json(
      { error: "Failed to fetch tracked accounts" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tracked-accounts
 *
 * Body: { platform, handle, source_video_id? }
 * user_id is derived from the session (never accepted from input). The body is
 * zod-validated inside tracked-accounts-repo (createTrackedAccount), and the write
 * is an idempotent upsert on UNIQUE(user_id, platform, handle).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CSRF guard — Content-Type 415 + cross-origin 403 (WR-01).
    const guard = csrfGuard(request);
    if (guard) return guard;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    // repo validates the shape (zod) + derives user_id from the session (CR-01).
    const account = await createTrackedAccount(supabase, body);
    return Response.json({ account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // zod validation failures surface as 400 (client error), not 500.
    if (message.startsWith("invalid tracked account input")) {
      return Response.json({ error: message }, { status: 400 });
    }
    // a missing session inside the repo surfaces as 401.
    if (message === "unauthenticated") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[tracked-accounts] POST error:", error);
    return Response.json({ error: "Failed to track account" }, { status: 500 });
  }
}

/**
 * DELETE /api/tracked-accounts?id=xxx
 *
 * Removes a tracked account by id. RLS scopes deletion to the owner.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CSRF guard — Content-Type 415 + cross-origin 403 (WR-01).
    const guard = csrfGuard(request);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "id query param is required" },
        { status: 400 },
      );
    }

    await deleteTrackedAccount(supabase, id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[tracked-accounts] DELETE error:", error);
    return Response.json(
      { error: "Failed to remove tracked account" },
      { status: 500 },
    );
  }
}
