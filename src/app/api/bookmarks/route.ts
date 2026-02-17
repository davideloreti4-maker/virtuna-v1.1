import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/bookmarks
 *
 * Returns all bookmarked video IDs for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_bookmarks" as never)
      .select("video_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[bookmarks] GET error:", error);
      return Response.json(
        { error: "Failed to fetch bookmarks" },
        { status: 500 }
      );
    }

    const videoIds = (data as { video_id: string }[]).map(
      (row) => row.video_id
    );
    return Response.json({ video_ids: videoIds });
  } catch (error) {
    console.error("[bookmarks] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/bookmarks
 *
 * Idempotent upsert: adds a bookmark for the authenticated user.
 * Body: { video_id: string }
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

    const body = await request.json();
    const videoId = body?.video_id;

    if (!videoId || typeof videoId !== "string") {
      return Response.json(
        { error: "video_id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_bookmarks" as never)
      .upsert(
        { user_id: user.id, video_id: videoId } as never,
        { onConflict: "user_id,video_id" }
      );

    if (error) {
      console.error("[bookmarks] POST error:", error);
      return Response.json(
        { error: "Failed to save bookmark" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[bookmarks] POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/bookmarks?video_id=xxx
 *
 * Removes a bookmark for the authenticated user.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("video_id");

    if (!videoId) {
      return Response.json(
        { error: "video_id query param is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_bookmarks" as never)
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", videoId);

    if (error) {
      console.error("[bookmarks] DELETE error:", error);
      return Response.json(
        { error: "Failed to delete bookmark" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[bookmarks] DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
