import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/avatar
 * Multipart upload to Supabase Storage `avatars` bucket.
 * Returns the public URL.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return Response.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;

    // Upload to avatars bucket (upsert to overwrite existing)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("[avatar] Upload error:", uploadError);
      return Response.json({ error: "Failed to upload avatar" }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Update user_settings with avatar URL
    await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, avatar_url: publicUrl },
        { onConflict: "user_id" }
      );

    return Response.json({ url: publicUrl });
  } catch (error) {
    console.error("[avatar] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
