/**
 * /api/projects/[id] — rename + delete one Library project (lane/library-rework, 2026-08-02).
 *
 * Auth-first, csrfGuard on both methods, RLS scoping the write to the owner. A project id the
 * caller does not own resolves to no row and answers 404 — the same answer as a nonexistent id,
 * so the route never confirms that someone else's project exists.
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import {
  renameProject,
  deleteProject,
  DuplicateProjectNameError,
} from "@/lib/shelf/projects-repo";

/** PATCH /api/projects/[id] — body { name }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Project id required" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const project = await renameProject(supabase, id, body.name);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    return Response.json({ project });
  } catch (error) {
    if (error instanceof DuplicateProjectNameError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "unknown";
    if (message.startsWith("invalid project input")) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[projects] PATCH error:", error);
    return Response.json({ error: "Failed to rename project" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 *
 * Deletes the FOLDER only. `saved_items.project_id` is ON DELETE SET NULL, so every item in it
 * is unfiled and reappears under Unfiled — deleting a project never deletes saved work.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Project id required" }, { status: 400 });
    }

    await deleteProject(supabase, id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[projects] DELETE error:", error);
    return Response.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
