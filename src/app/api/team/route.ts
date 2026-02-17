import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/team
 * Returns the current user's team and members.
 * If no team exists, creates one automatically.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user's team via team_members
    const { data: membership } = await supabase
      .from("team_members" as never)
      .select("team_id, role")
      .eq("user_id", user.id)
      .in("status", ["active", "invited"])
      .limit(1)
      .maybeSingle();

    let teamId = (membership as Record<string, unknown>)?.team_id as string | undefined;

    // Auto-create team if none exists
    if (!teamId) {
      const { data: newTeam, error: createError } = await supabase
        .from("teams" as never)
        .insert({ owner_id: user.id, name: "My Team" } as never)
        .select("id")
        .single();

      if (createError || !newTeam) {
        console.error("[team] Create error:", createError);
        return Response.json({ error: "Failed to create team" }, { status: 500 });
      }

      teamId = (newTeam as Record<string, unknown>).id as string;

      // Add owner as active member
      await supabase
        .from("team_members" as never)
        .insert({
          team_id: teamId,
          user_id: user.id,
          role: "owner",
          status: "active",
          joined_at: new Date().toISOString(),
        } as never);
    }

    // Fetch team details
    const { data: team } = await supabase
      .from("teams" as never)
      .select("*")
      .eq("id", teamId)
      .single();

    // Fetch members
    const { data: members } = await supabase
      .from("team_members" as never)
      .select("*")
      .eq("team_id", teamId)
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: true });

    return Response.json({
      team,
      members: members || [],
      currentUserId: user.id,
    });
  } catch (error) {
    console.error("[team] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
