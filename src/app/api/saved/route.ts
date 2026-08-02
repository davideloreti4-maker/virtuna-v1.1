/**
 * /api/saved — typed Saved shelf CRUD (Phase 10 Plan 04, SAVE-01/02).
 *
 * The flat, typed Saved shelf (D-07): GET lists, POST saves a typed snapshot,
 * DELETE removes a shelf item. Auth-first idiom (mirrors /api/bookmarks):
 *  - getUser() gates every method; 401 when unauthenticated.
 *  - user_id is ALWAYS derived from the session inside shelf-repo (CR-01) — the
 *    request body NEVER supplies user_id (T-10-09 mitigation).
 *  - POST body is zod-validated by shelf-repo (item_type enum = T-10-10).
 *  - snapshot is the block's own props, so the shelf renders the same typed
 *    renderer without a re-fetch.
 *
 * FLAT by construction: `?type=` is a flat client filter, NOT a folder concept.
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import {
  listSavedItems,
  createSavedItem,
  deleteSavedItem,
  setSavedItemsProject,
  type SavedItemType,
} from "@/lib/shelf/shelf-repo";
import { touchProject } from "@/lib/shelf/projects-repo";

// `remix` added / `format` dropped 2026-08-02 — see the SavedItemType docblock in shelf-repo.
const ITEM_TYPES: readonly SavedItemType[] = [
  "read",
  "idea",
  "hook",
  "script",
  "outlier",
  "remix",
];

function isItemType(value: string | null): value is SavedItemType {
  return value !== null && (ITEM_TYPES as readonly string[]).includes(value);
}

/**
 * GET /api/saved[?type=hook]
 *
 * Returns the authenticated user's saved items, newest first. Optional `?type=`
 * is a flat filter (one item_type), not a folder.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const type = isItemType(typeParam) ? typeParam : undefined;

    const items = await listSavedItems(supabase, type);
    return Response.json({ items });
  } catch (error) {
    console.error("[saved] GET error:", error);
    return Response.json({ error: "Failed to fetch saved items" }, { status: 500 });
  }
}

/**
 * POST /api/saved
 *
 * Body: { item_type, ref_id?, thread_id?, title?, snapshot }
 * user_id is derived from the session (never accepted from input). The body is
 * zod-validated inside shelf-repo (createSavedItem).
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    // shelf-repo validates the shape (zod) + derives user_id from the session.
    const item = await createSavedItem(supabase, body);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // zod validation failures surface as 400 (client error), not 500.
    if (message.startsWith("invalid saved item input")) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[saved] POST error:", error);
    return Response.json({ error: "Failed to save item" }, { status: 500 });
  }
}

/**
 * PATCH /api/saved — file items into a project, or unfile them.
 *
 * Body: { ids: string[], project_id: string | null }  (null unfiles)
 *
 * Bulk by design: this is what the shelf's selection mode drives, so "file all my hooks" is one
 * request rather than one per row. projects-repo verifies the target project belongs to the
 * caller before writing; RLS scopes the update itself.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = csrfGuard(request);
    if (guard) return guard;

    const body = (await request.json().catch(() => null)) as
      | { ids?: unknown; project_id?: unknown }
      | null;

    if (!body || !Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string")) {
      return Response.json({ error: "ids must be an array of strings" }, { status: 400 });
    }
    if (body.project_id !== null && typeof body.project_id !== "string") {
      return Response.json({ error: "project_id must be a string or null" }, { status: 400 });
    }

    const projectId = body.project_id as string | null;
    const updated = await setSavedItemsProject(supabase, body.ids as string[], projectId);

    // Filing activity is what "updated 2 days ago" reports, so touch the destination. Best
    // effort inside the repo: the filing already landed and must not be reported as failed.
    if (projectId && updated > 0) await touchProject(supabase, projectId);

    return Response.json({ updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.startsWith("invalid saved item input")) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[saved] PATCH error:", error);
    return Response.json({ error: "Failed to file saved items" }, { status: 500 });
  }
}

/**
 * DELETE /api/saved?id=xxx
 *
 * Removes a shelf item by id. RLS scopes deletion to the owner — this only takes
 * the item off the shelf; it never deletes the original thread output.
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id query param is required" }, { status: 400 });
    }

    await deleteSavedItem(supabase, id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[saved] DELETE error:", error);
    return Response.json({ error: "Failed to remove saved item" }, { status: 500 });
  }
}
