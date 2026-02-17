import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * PATCH /api/settings/account/password
 * Change the user's password.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (error) {
      console.error("[password] Change error:", error);
      return Response.json(
        { error: error.message || "Failed to update password" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[password] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
