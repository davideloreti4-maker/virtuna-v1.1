/**
 * Middleware landing-redirect behavior (SHELL-06 / D-23).
 *
 * The authed landing lives in `updateSession` (src/lib/supabase/middleware.ts).
 * This suite asserts the load-bearing facts of the authed-landing repoint:
 *   1. An authed user hitting /login or /signup is redirected to /start (the briefing home).
 *   2. An unauthenticated user hitting /home is redirected to /login
 *      (/home is a PROTECTED_PREFIX — defense-in-depth on top of the (app) layout gate).
 *   3. Every redirect Location is same-origin (same host as the request) — no open redirect (V5).
 *
 * London-style: @supabase/ssr's createServerClient is mocked so getUser()
 * (authed vs unauthenticated) is controllable; the .from() chain is stubbed so
 * the authed onboarding lookup never throws. next/server is real — a genuine
 * NextRequest is constructed and the NextResponse redirect Location is asserted.
 *
 * The authed landing is the briefing at /start (MVP launch cut, 2026-07-15); the
 * middleware redirect + auth callback repoint here. /home stays a protected composer route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ORIGIN = "https://app.numen.test";

// ── controllable Supabase SSR client mock ────────────────────────────────
// getUser() returns an authed user or null depending on `mockUser`.
// .from(...).select(...).eq(...).maybeSingle() resolves to a profile with
// onboarding completed, so the authed-on-protected /welcome branch is inert.
let mockUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { onboarding_completed_at: "2026-01-01T00:00:00Z" },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

// Referral constants are a thin import; keep them real-shaped but isolated.
vi.mock("@/lib/referral/constants", () => ({
  REFERRAL_COOKIE_NAME: "numen_ref",
  REFERRAL_COOKIE_MAX_AGE: 60 * 60 * 24 * 30,
}));

// Imported AFTER the mocks are registered.
import { NextRequest } from "next/server";
import { updateSession } from "../middleware";

/** Build a NextRequest for the given same-origin path. */
function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, ORIGIN));
}

/** Pull the redirect target as a URL from a NextResponse, or fail loudly. */
function redirectUrl(res: { headers: Headers; status: number }): URL {
  const location = res.headers.get("location");
  expect(location, "expected a redirect Location header").toBeTruthy();
  return new URL(location!);
}

beforeEach(() => {
  mockUser = null;
});

describe("middleware authed landing (D-23 / SHELL-06)", () => {
  it("redirects an authed user off /login to /start (the briefing home)", async () => {
    mockUser = { id: "user-1" };
    const res = await updateSession(requestFor("/login"));
    const url = redirectUrl(res);
    expect(url.pathname).toBe("/start");
    expect(url.pathname).not.toBe("/analyze");
  });

  it("redirects an authed user off /signup to /start (the briefing home)", async () => {
    mockUser = { id: "user-1" };
    const res = await updateSession(requestFor("/signup"));
    const url = redirectUrl(res);
    expect(url.pathname).toBe("/start");
    expect(url.pathname).not.toBe("/analyze");
  });

  it("redirects an unauthenticated user hitting /home to /login (/home is protected)", async () => {
    mockUser = null;
    const res = await updateSession(requestFor("/home"));
    const url = redirectUrl(res);
    expect(url.pathname).toBe("/login");
    // deep link preserved so the user returns to /home after auth
    expect(url.searchParams.get("next")).toBe("/home");
  });

  it("keeps every landing redirect same-origin (no open redirect — V5)", async () => {
    // authed -> /start redirect host
    mockUser = { id: "user-1" };
    const authed = redirectUrl(await updateSession(requestFor("/login")));
    expect(authed.host).toBe(new URL(ORIGIN).host);

    // unauthenticated -> /login redirect host
    mockUser = null;
    const guarded = redirectUrl(await updateSession(requestFor("/home")));
    expect(guarded.host).toBe(new URL(ORIGIN).host);
  });
});
