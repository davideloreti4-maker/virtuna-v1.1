import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/team/invite
 * Invite a new member to the team.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Find user's team and verify they're owner/admin
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const teamId = membership?.team_id;
    const role = membership?.role;

    if (!teamId || !["owner", "admin"].includes(role || "")) {
      return Response.json(
        { error: "Only team owners and admins can invite members" },
        { status: 403 }
      );
    }

    // Check if email is already a member
    const { data: existing } = await supabase
      .from("team_members")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("invited_email", parsed.data.email)
      .in("status", ["active", "invited"])
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: "This person is already on your team or has a pending invite" },
        { status: 409 }
      );
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        invited_email: parsed.data.email,
        role: "member",
        status: "invited",
      })
      .select("*")
      .single();

    if (inviteError) {
      console.error("[team/invite] Error:", inviteError);
      return Response.json({ error: "Failed to create invite" }, { status: 500 });
    }

    return Response.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("[team/invite] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
