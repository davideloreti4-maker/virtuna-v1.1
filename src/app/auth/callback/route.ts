import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral/constants";

/**
 * OAuth PKCE code exchange handler.
 *
 * Supabase redirects here after OAuth (Google) sign-in.
 * Exchanges the authorization code for a session, processes
 * referral cookies, and redirects to the intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const origin = request.nextUrl.origin;

  // Handle OAuth error responses from Supabase
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (errorParam) {
    const message = errorDescription || errorParam;
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin)
    );
  }

  // Create Supabase client with cookie handling for Route Handler
  // We collect cookies to set on the final response (created after profile check)
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
          });
        },
      },
    }
  );

  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin)
    );
  }

  // Detect first-time users and redirect to onboarding
  let redirectTo = next;
  if (data.user) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("onboarding_completed_at")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.onboarding_completed_at) {
      redirectTo = "/welcome";
    }
  }

  // Create response with determined redirect destination
  const response = NextResponse.redirect(new URL(redirectTo, origin));

  // Apply pending auth cookies to the response
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }

  // Process referral cookie if present
  if (data.user) {
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

      // Re-set referral cookie after OAuth (ensures persistence)
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
  }

  return response;
}
