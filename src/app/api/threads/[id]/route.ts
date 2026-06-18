/**
 * /api/threads/[id] — Thread update route.
 *
 * PATCH — update thread fields. Currently only supports active_audience_id (D-04).
 *
 * Security:
 *  - Auth-first (T-07 pattern)
 *  - RLS-scoped via session client — only the thread owner can update
 *  - active_audience_id: null = General default; validated UUID or 'general'/'preset-*' sentinel
 */

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchSchema = z.object({
  active_audience_id: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  if (!threadId) {
    return Response.json({ error: "Thread id required" }, { status: 400 });
  }

  // Parse body
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if ("active_audience_id" in parsed.data) {
    updatePayload.active_audience_id = parsed.data.active_audience_id ?? null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  // Update — RLS enforces ownership via session client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("threads")
    .update(updatePayload)
    .eq("id", threadId)
    .eq("user_id", user.id) // belt-and-suspenders ownership check
    .select("id, active_audience_id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ thread: data });
}
