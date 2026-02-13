import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral/constants";

const PROTECTED_ROUTES = ["/dashboard", "/settings", "/brand-deals", "/welcome", "/referrals"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Detect ?ref=CODE and set referral cookie (before auth check)
  const referralCode = request.nextUrl.searchParams.get("ref");
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

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Redirect unauthenticated users from protected routes to landing page
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
