import { createClient } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral/code-generator";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has a code
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: existing.code });
  }

  // Generate new code with collision retry
  const maxAttempts = 5;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const code = generateReferralCode();

    const { error } = await supabase.from("referral_codes").insert({
      user_id: user.id,
      code,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      return NextResponse.json({ code });
    }

    // Unique constraint violation — retry with a new code
    if (error.code === "23505") {
      continue;
    }

    // Other error
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { error: "Failed to generate unique code" },
    { status: 500 }
  );
}
