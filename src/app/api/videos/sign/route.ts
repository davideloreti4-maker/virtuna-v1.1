import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "videos.sign" });

/**
 * GET /api/videos/sign?path=<storage_path>
 *
 * Returns a short-lived signed URL for a video in the private `videos` bucket.
 * Authorization: the authenticated user must own the path (paths are stored
 * under `<userId>/...`). The actual signing happens with the service client
 * because the bucket policy doesn't allow row-level signed URLs from anon JWTs.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Path convention: `<userId>/<nanoid>.<ext>` — refuse if it doesn't match.
  const ownerId = path.split("/")[0];
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from("videos")
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data?.signedUrl) {
    const message = error?.message ?? "sign failed";
    // Storage returns "Object not found" (status 400 from the API) when the
    // path was deleted by retention or never uploaded. Surface that as 404
    // so the client can render a "video no longer available" state instead
    // of a generic player error.
    const isMissing = /not.found|object.*not.*exist/i.test(message);
    log[isMissing ? "info" : "warn"]("createSignedUrl_failed", {
      path,
      user_id: user.id,
      error: message,
    });
    return NextResponse.json(
      { error: isMissing ? "video_missing" : message },
      { status: isMissing ? 404 : 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
