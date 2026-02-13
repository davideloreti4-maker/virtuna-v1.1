import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/trending/:videoId
 *
 * Returns a single video detail by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = createServiceClient();

    const { data: video, error } = await supabase
      .from("scraped_videos")
      .select("*")
      .eq("id", videoId)
      .is("archived_at", null)
      .single();

    if (error || !video) {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }

    return Response.json(video);
  } catch (error) {
    console.error("[trending/videoId] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
