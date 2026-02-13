import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/deals/:id
 *
 * Returns a single deal detail by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: deal, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !deal) {
      return Response.json({ error: "Deal not found" }, { status: 404 });
    }

    return Response.json(deal);
  } catch (error) {
    console.error("[deals/id] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
