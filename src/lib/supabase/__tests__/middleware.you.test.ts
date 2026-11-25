/**
 * /you is a signed-in page under the new look (plan 2026-11-24-you): signed out, the middleware
 * sends the visitor to log in with the deep link kept. With the flag off the prefixes are as before
 * (the route does not exist). Same stand-ins as middleware.landing.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://app.numen.test";
let mockUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/referral/constants", () => ({ REFERRAL_COOKIE_NAME: "numen_ref", REFERRAL_COOKIE_MAX_AGE: 60 * 60 * 24 * 30 }));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const { NextRequest } = await import("next/server");
  const { updateSession } = await import("../middleware");
  return (path: string) => updateSession(new NextRequest(new URL(path, ORIGIN)));
}

afterEach(() => {
  mockUser = null;
  vi.doUnmock("@/lib/flags/new-look");
});

describe("middleware: /you", () => {
  it("flag on, signed out: to /login with the deep link", async () => {
    const res = await (await load(true))("/you");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/you");
  });

  it("flag on, signed in: through", async () => {
    mockUser = { id: "user-1" };
    const res = await (await load(true))("/you");
    expect(res.headers.get("location")).toBeNull();
  });

  it("flag off: not a protected path, as before", async () => {
    const res = await (await load(false))("/you");
    expect(res.headers.get("location")).toBeNull();
  });

  it("flag on, the other signed-in paths are as before", async () => {
    const visit = await load(true);
    for (const path of ["/home", "/library", "/settings"]) {
      expect(new URL((await visit(path)).headers.get("location")!).pathname).toBe("/login");
    }
    expect((await visit("/youtube-tips")).headers.get("location")).toBeNull();
  });
});
