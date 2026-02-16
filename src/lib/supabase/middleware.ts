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
  "/dashboard",
  "/brand-deals",
  "/settings",
  "/welcome",
  "/referrals",
  "/earnings",
  "/content-intelligence",
];

/**
 * Public paths that skip auth checks entirely.
 * Includes marketing pages, auth flow, API routes, and static assets.
 */
const PUBLIC_PATHS = [
  "/",
  "/coming-soon",
  "/showcase",
  "/primitives-showcase",
  "/viral-score-test",
  "/viral-results-showcase",
  "/viz-test",
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

  const pathname = request.nextUrl.pathname;

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

  // Redirect authenticated users away from auth pages to /dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
