import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

/**
 * PATCH /api/team/members/[id]
 * Update a team member's role (owner/admin only).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    // Verify caller is owner/admin of the same team
    const { data: callerMembership } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const callerTeamId = callerMembership?.team_id;
    const callerRole = callerMembership?.role;

    if (!callerTeamId || !["owner", "admin"].includes(callerRole || "")) {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify target member is in same team and not the owner
    const { data: targetMember } = await supabase
      .from("team_members")
      .select("team_id, role, user_id")
      .eq("id", memberId)
      .single();

    if (!targetMember) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.team_id !== callerTeamId) {
      return Response.json({ error: "Member not in your team" }, { status: 403 });
    }

    if (targetMember.role === "owner") {
      return Response.json({ error: "Cannot change the owner's role" }, { status: 403 });
    }

    // Update role
    const { error: updateError } = await supabase
      .from("team_members")
      .update({ role: parsed.data.role })
      .eq("id", memberId);

    if (updateError) {
      console.error("[team/members] Update error:", updateError);
      return Response.json({ error: "Failed to update role" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[team/members] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/team/members/[id]
 * Remove a team member (owner/admin only, cannot remove owner).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is owner/admin
    const { data: callerMembership } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const callerTeamId = callerMembership?.team_id;
    const callerRole = callerMembership?.role;

    if (!callerTeamId || !["owner", "admin"].includes(callerRole || "")) {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify target member
    const { data: targetMember } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("id", memberId)
      .single();

    if (!targetMember) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.team_id !== callerTeamId) {
      return Response.json({ error: "Member not in your team" }, { status: 403 });
    }

    if (targetMember.role === "owner") {
      return Response.json({ error: "Cannot remove the team owner" }, { status: 403 });
    }

    // Soft-remove: set status to 'removed'
    const { error: removeError } = await supabase
      .from("team_members")
      .update({ status: "removed" })
      .eq("id", memberId);

    if (removeError) {
      console.error("[team/members] Remove error:", removeError);
      return Response.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[team/members] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
