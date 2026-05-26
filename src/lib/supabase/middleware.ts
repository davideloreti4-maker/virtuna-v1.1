import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral/constants";

/**
 * Protected route prefixes — any path starting with these requires auth.
 * Covers all (app) route group pages.
 */
const PROTECTED_PREFIXES = [
  "/analyze",        // D-25 — /dashboard sunset
  "/brand-deals",
  "/settings",
  "/welcome",
  "/referrals",
  "/trending",
  "/competitors",
];

/**
 * Public paths that skip auth checks entirely.
 * Includes marketing pages, auth flow, API routes, and static assets.
 */
const PUBLIC_PATHS = [
  "/",
  "/coming-soon",
  "/showcase",
  "/login",
  "/signup",
  "/auth/callback",
];

function isPublicPath(pathname: string): boolean {
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // API routes are always public (auth handled per-route)
  if (pathname.startsWith("/api/")) return true;
  return false;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Phase 2 D-25 — /dashboard is sunset. Redirect to /analyze.
  // Must run BEFORE Supabase client creation so the redirect fires regardless of auth state.
  // Subpaths drop (no /dashboard/* surfaces survive; Workspace milestone hasn't shipped).
  // Use same-origin clone to prevent open redirect (V5 input validation — RESEARCH §Security).
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/analyze";
    return NextResponse.redirect(url, 307);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Extract referral code early (cookie is set AFTER getUser to survive Supabase setAll re-creation)
  const referralCode = request.nextUrl.searchParams.get("ref");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Set referral cookie AFTER getUser() — Supabase's setAll may have re-created
  // supabaseResponse via NextResponse.next(), so we set on the final response object.
  // "First click wins": only set if user doesn't already have a referral cookie.
  if (referralCode && !request.cookies.get(REFERRAL_COOKIE_NAME)) {
    supabaseResponse.cookies.set({
      name: REFERRAL_COOKIE_NAME,
      value: referralCode,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax", // CRITICAL: NOT "strict" — must survive OAuth redirect
      maxAge: REFERRAL_COOKIE_MAX_AGE,
    });
  }

  // Skip auth checks for public paths
  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users from protected routes to /login with deep link
  if (!user && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the deep link so user returns after auth
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to /analyze
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/analyze", request.url));
  }

  // Redirect authenticated users without onboarding to /welcome
  if (user && pathname !== "/welcome" && isProtectedPath(pathname)) {
    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fail open on DB error — don't lock users out of the app during outages
    if (profileError) {
      return supabaseResponse;
    }

    if (!profile || !profile.onboarding_completed_at) {
      return NextResponse.redirect(new URL("/welcome", request.url));
    }
  }

  return supabaseResponse;
}
