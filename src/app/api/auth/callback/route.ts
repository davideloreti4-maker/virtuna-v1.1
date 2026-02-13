import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral/constants";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Retrieve referral cookie set in middleware
      const cookieHeader = request.headers.get("cookie");
      const referralCode = cookieHeader
        ?.split(";")
        .find((c) => c.trim().startsWith(`${REFERRAL_COOKIE_NAME}=`))
        ?.split("=")[1]
        ?.trim();

      if (referralCode) {
        // Look up referrer from referral_codes table
        const { data: codeData } = await supabase
          .from("referral_codes")
          .select("user_id")
          .eq("code", referralCode)
          .maybeSingle();

        if (codeData) {
          // Log referral click (UNIQUE constraint handles deduplication)
          await supabase.from("referral_clicks").insert({
            referral_code: referralCode,
            referrer_user_id: codeData.user_id,
            referred_user_id: data.user.id,
            clicked_at: new Date().toISOString(),
          });
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`);

      // Re-set referral cookie after OAuth (ensures persistence)
      if (referralCode) {
        response.cookies.set({
          name: REFERRAL_COOKIE_NAME,
          value: referralCode,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "lax",
          maxAge: REFERRAL_COOKIE_MAX_AGE,
        });
      }

      return response;
    }
  }

  // Auth code exchange failed — redirect to landing page
  return NextResponse.redirect(`${origin}/`);
}
