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

/**
 * CR-01 — Open-redirect guard for the client-supplied `next` param.
 *
 * `new URL(next, origin)` does NOT pin the host: a protocol-relative
 * (`//evil.com`), backslash (`/\evil.com`), or absolute (`https://evil.com`)
 * value overrides the origin entirely, so the post-login redirect would
 * escape to an arbitrary host. We only accept a root-relative same-origin
 * path: exactly one leading `/`, no `//`, no backslashes, and (defense in
 * depth) a resolved URL whose origin still matches. Anything else falls
 * back to /start.
 */
export function safeNext(raw: string | null, origin: string): string {
  if (!raw) return "/start";
  // Must be root-relative: single leading slash, no protocol-relative "//",
  // no backslash (browsers treat "\" as "/" in URLs, so "/\evil.com" escapes).
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/start";
  }
  // Defense-in-depth: confirm the resolved URL stays on origin.
  try {
    const resolved = new URL(raw, origin);
    if (resolved.origin !== origin) return "/start";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/start";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const origin = request.nextUrl.origin;
  // Default authed landing is the briefing at /start (MVP launch cut, 2026-07-15 —
  // the briefing IS home; /home is the New Thread composer reached from it).
  // `next` is user-supplied, so it MUST pass safeNext() (CR-01): only a
  // same-origin root-relative path survives; protocol-relative/absolute/
  // backslash values fall back to /start. Do NOT trust `new URL(next, origin)`
  // alone — it does not enforce same-origin.
  const next = safeNext(searchParams.get("next"), origin);

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Sign-in was cancelled or failed. Please try again.")}`, origin)
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
      new URL(`/login?error=${encodeURIComponent("Unable to complete sign-in. Please try again.")}`, origin)
    );
  }

  // Detect first-time users and redirect to onboarding.
  // `next` is already safeNext()-validated (same-origin path); `/welcome` is a
  // server-controlled literal — so `new URL(redirectTo, origin)` below is safe.
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
