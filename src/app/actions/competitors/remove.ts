"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  error?: string;
  success?: boolean;
};

export async function removeCompetitor(
  competitorId: string
): Promise<ActionResult> {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // 2. Validate competitorId
  if (!competitorId) {
    return { error: "Missing competitor ID" };
  }

  // 3. Delete junction row using auth client (RLS-enforced)
  const { error: deleteError } = await supabase
    .from("user_competitors")
    .delete()
    .eq("user_id", user.id)
    .eq("competitor_id", competitorId);

  // 4. Handle errors
  if (deleteError) {
    return { error: "Failed to remove competitor" };
  }

  // 5. Revalidate and return
  revalidatePath("/competitors");
  return { success: true };
}
