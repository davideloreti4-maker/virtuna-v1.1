/**
 * /api/projects — Library project list + create (lane/library-rework, 2026-08-02).
 *
 * Auth-first idiom, mirroring /api/saved exactly:
 *  - getUser() gates every method; 401 when unauthenticated.
 *  - user_id is ALWAYS derived from the session inside projects-repo (CR-01) — the request
 *    body NEVER supplies it.
 *  - csrfGuard on the mutating method (Content-Type 415 + cross-origin 403).
 *
 * Returns projects only, with NO item counts: the shelf already holds every saved row from
 * GET /api/saved and derives counts from it. Two servers of the same number is how the
 * project row and the picker start disagreeing.
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import {
  listProjects,
  createProject,
  DuplicateProjectNameError,
} from "@/lib/shelf/projects-repo";

/** GET /api/projects — the caller's projects, most recently touched first. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await listProjects(supabase);
    return Response.json({ projects });
  } catch (error) {
    console.error("[projects] GET error:", error);
    return Response.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

/**
 * POST /api/projects — create a project.
 *
 * Body: { name }
 * 409 on a duplicate name (the unique index is case- and whitespace-insensitive), because
 * "Launch video" and "launch video " are the same folder to a human.
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

    const guard = csrfGuard(request);
    if (guard) return guard;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const project = await createProject(supabase, body as { name: string });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateProjectNameError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "unknown";
    if (message.startsWith("invalid project input")) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[projects] POST error:", error);
    return Response.json({ error: "Failed to create project" }, { status: 500 });
  }
}
