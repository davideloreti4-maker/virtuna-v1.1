import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/deals/:id/apply
 *
 * Apply to a deal. Creates a deal_enrollment for the authenticated user.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse optional application note
    let applicationNote: string | null = null;
    try {
      const body = await request.json();
      applicationNote = body.application_note ?? null;
    } catch {
      // No body is fine
    }

    // Verify deal exists and is active
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, status")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return Response.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.status !== "active") {
      return Response.json(
        { error: "Deal is no longer accepting applications" },
        { status: 400 }
      );
    }

    // Check for existing enrollment
    const { data: existing } = await supabase
      .from("deal_enrollments")
      .select("id, status")
      .eq("deal_id", dealId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return Response.json(
        { error: "Already applied to this deal", enrollment: existing },
        { status: 409 }
      );
    }

    // Create enrollment
    const { data: enrollment, error: enrollError } = await supabase
      .from("deal_enrollments")
      .insert({
        deal_id: dealId,
        user_id: user.id,
        status: "applied",
        application_note: applicationNote,
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (enrollError) {
      console.error("[deals/apply] Insert error:", enrollError);
      return Response.json(
        { error: "Failed to submit application" },
        { status: 500 }
      );
    }

    return Response.json(enrollment, { status: 201 });
  } catch (error) {
    console.error("[deals/apply] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
