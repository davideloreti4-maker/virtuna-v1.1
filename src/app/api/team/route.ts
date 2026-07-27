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

    // Find user's team via team_members.
    //
    // The error is READ, not discarded: this select returned `42P17 infinite recursion` for
    // every user for months (the team_members policies asked "which teams am I in?" with a
    // subquery on team_members — fixed in 20260727150000). Dropping it on the floor is what
    // made that look like "no team yet" and sent every request down the auto-create path.
    const { data: membership, error: membershipError } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .in("status", ["active", "invited"])
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      // Never fall through to auto-create on a READ failure — that mints a fresh team on
      // every request instead of finding the one that is already there.
      console.error("[team] Membership read failed:", membershipError);
      return Response.json({ error: "Failed to load team" }, { status: 500 });
    }

    let teamId = membership?.team_id;

    // Auto-create team if none exists
    if (!teamId) {
      const { data: newTeam, error: createError } = await supabase
        .from("teams")
        .insert({ owner_id: user.id, name: "My Team" })
        .select("id")
        .single();

      if (createError || !newTeam) {
        console.error("[team] Create error:", createError);
        return Response.json({ error: "Failed to create team" }, { status: 500 });
      }

      teamId = newTeam.id;

      // Add owner as active member. This insert is what makes the team FINDABLE next time —
      // the lookup above goes through team_members, not `teams.owner_id`. Silently swallowing
      // a failure here leaves an orphan team behind and creates another one on the next
      // request, forever. (Until 20260727150000 the INSERT policy made this impossible by
      // construction: it required an active owner/admin membership in the very team the row
      // would create.)
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: teamId,
          user_id: user.id,
          role: "owner",
          status: "active",
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error("[team] Owner membership insert failed:", memberError);
        return Response.json({ error: "Failed to create team" }, { status: 500 });
      }
    }

    // Fetch team details
    const { data: team } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    // Fetch members
    const { data: members } = await supabase
      .from("team_members")
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
