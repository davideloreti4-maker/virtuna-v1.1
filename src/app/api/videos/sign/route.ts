import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
    return NextResponse.json({ error: error?.message ?? "sign failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
