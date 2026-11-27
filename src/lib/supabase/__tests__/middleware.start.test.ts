/**
 * /start under the new look (plan 01-start-and-profile, Task 6): public for a signed-out visitor; a signed-in
 * account without onboarding is sent there instead of /welcome, and /welcome itself leads there. Anonymous
 * sessions stay exempt. With the flag off everything is as before. Same stand-ins as middleware.you.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://app.numen.test";
let mockUser: { id: string; is_anonymous?: boolean } | null = null;
let onboardedAt: string | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed_at: onboardedAt }, error: null }) }) }) }),
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
const where = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
};

afterEach(() => {
  mockUser = null;
  onboardedAt = null;
  vi.doUnmock("@/lib/flags/new-look");
});

describe("middleware: /start, flag on", () => {
  it("signed out: /start is open", async () => {
    expect(where(await (await load(true))("/start?step=niche"))).toBeNull();
  });

  it("signed in without onboarding: /start is open, and the app sends them there", async () => {
    mockUser = { id: "user-1" };
    const visit = await load(true);
    expect(where(await visit("/start"))).toBeNull();
    expect(where(await visit("/home"))?.pathname).toBe("/start");
    expect(where(await visit("/audience/new"))?.pathname).toBe("/start");
  });

  it("signed in and onboarded: the app is open", async () => {
    mockUser = { id: "user-1" };
    onboardedAt = "2026-11-26T10:00:00Z";
    expect(where(await (await load(true))("/home"))).toBeNull();
  });

  it("an anonymous session is not sent to /start", async () => {
    mockUser = { id: "anon-1", is_anonymous: true };
    expect(where(await (await load(true))("/home"))).toBeNull();
  });

  it("/welcome leads to /start, signed in or out, with its query", async () => {
    const visit = await load(true);
    const out = where(await visit("/welcome?from=login"))!;
    expect(out.pathname).toBe("/start");
    expect(out.searchParams.get("from")).toBe("login");
    mockUser = { id: "user-1" };
    expect(where(await visit("/welcome"))?.pathname).toBe("/start");
  });
});

describe("middleware: /start, flag off (as before)", () => {
  it("signed out: /start asks to log in, with the deep link", async () => {
    const out = where(await (await load(false))("/start"))!;
    expect(out.pathname).toBe("/login");
    expect(out.searchParams.get("next")).toBe("/start");
  });

  it("signed in without onboarding: /welcome, and /welcome itself is open", async () => {
    mockUser = { id: "user-1" };
    const visit = await load(false);
    expect(where(await visit("/home"))?.pathname).toBe("/welcome");
    expect(where(await visit("/welcome"))).toBeNull();
  });
});
