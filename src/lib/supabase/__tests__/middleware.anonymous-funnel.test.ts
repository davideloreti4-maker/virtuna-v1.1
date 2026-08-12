/**
 * The anonymous funnel's middleware exemption (ONBOARDING-FUNNEL-DESIGN.md §0b).
 *
 * `/go` signs the visitor in anonymously and hands them the REAL `/home` shell. `/home` is a
 * PROTECTED_PREFIX, so every navigation into it passes the onboarding gate — which redirects
 * any authenticated user without a completed `creator_profiles` row to `/welcome`.
 *
 * An anonymous visitor can never satisfy that gate: no `creator_profiles` row is ever written
 * for them. Without the exemption the entire funnel dead-ends on the onboarding form it exists
 * to delete, and it dead-ends in a LOOP, since nothing they can do at /welcome clears it.
 *
 * The funnel spike measured API routes with an anonymous session (all 200) and never navigated
 * a page through middleware, so this gate was invisible until it was traced. These tests are
 * the record of it.
 *
 * The exemption must stay NARROW — a real signed-up user who has not onboarded must still be
 * routed to /welcome, so that case is asserted alongside it rather than assumed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ORIGIN = "https://app.numen.test";

// ── controllable Supabase SSR client mock ────────────────────────────────
// `mockUser` carries `is_anonymous` so both sides of the exemption are reachable.
// `mockProfile` is null by default — i.e. NOT onboarded, which is the state that arms the gate.
let mockUser: { id: string; is_anonymous?: boolean } | null = null;
let mockProfile: { onboarding_completed_at: string | null } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockProfile, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/referral/constants", () => ({
  REFERRAL_COOKIE_NAME: "numen_ref",
  REFERRAL_COOKIE_MAX_AGE: 60 * 60 * 24 * 30,
}));

// Imported AFTER the mocks are registered.
import { NextRequest } from "next/server";
import { updateSession } from "../middleware";

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, ORIGIN));
}

/** The redirect target, or null when the response is a pass-through. */
function redirectPath(res: { headers: Headers }): string | null {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  mockUser = null;
  mockProfile = null; // not onboarded — the gate is armed for every test below
});

describe("anonymous funnel — the /welcome gate (§0b)", () => {
  it("lets an anonymous visitor with no profile reach /home", () => {
    mockUser = { id: "anon-1", is_anonymous: true };
    return updateSession(requestFor("/home")).then((res) => {
      // No redirect at all — they land in the real shell.
      expect(redirectPath(res)).toBeNull();
    });
  });

  it("does NOT bounce an anonymous visitor to /welcome (the funnel would loop)", async () => {
    mockUser = { id: "anon-1", is_anonymous: true };
    const res = await updateSession(requestFor("/home"));
    expect(redirectPath(res)).not.toBe("/welcome");
  });

  it("still routes a REAL un-onboarded user to /welcome (the exemption stays narrow)", async () => {
    mockUser = { id: "user-1", is_anonymous: false };
    const res = await updateSession(requestFor("/home"));
    expect(redirectPath(res)).toBe("/welcome");
  });

  it("treats a user with no is_anonymous claim as a real user", async () => {
    // Older sessions predate the claim. Absent must mean "real", never "anonymous" — the
    // permissive reading would silently drop onboarding for every legacy signed-up user.
    mockUser = { id: "user-legacy" };
    const res = await updateSession(requestFor("/home"));
    expect(redirectPath(res)).toBe("/welcome");
  });

  it("exempts the anonymous visitor across the rest of the (app) group too", async () => {
    // The funnel's thread lands on /home, but the Simulate door and the rail reach sibling
    // protected surfaces. The gate is per-request, so the exemption has to hold for all of them.
    mockUser = { id: "anon-1", is_anonymous: true };
    for (const path of ["/analyze", "/audience", "/settings"]) {
      const res = await updateSession(requestFor(path));
      expect(redirectPath(res), `${path} should not bounce an anon visitor`).not.toBe("/welcome");
    }
  });

  it("keeps refusing an unauthenticated visitor — the exemption is not a hole", async () => {
    mockUser = null;
    const res = await updateSession(requestFor("/home"));
    expect(redirectPath(res)).toBe("/login");
  });

  it("still routes an ONBOARDED real user straight through", async () => {
    mockUser = { id: "user-1", is_anonymous: false };
    mockProfile = { onboarding_completed_at: "2026-01-01T00:00:00Z" };
    const res = await updateSession(requestFor("/home"));
    expect(redirectPath(res)).toBeNull();
  });
});
