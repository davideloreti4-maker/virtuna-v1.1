/**
 * /edit is a signed-in page under the new look (plan 2026-11-24-editor-screens-a, Task 15): signed out, the middleware sends the
 * visitor to log in with the deep link kept. With the flag off the prefixes are as before (the page does not exist). Same
 * stand-ins as middleware.you.test.ts.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
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

describe("middleware: /edit", () => {
  it("flag on, signed out: to /login with the deep link", async () => {
    const res = await (await load(true))("/edit/e1");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/edit/e1");
  });

  it("flag on, signed in: through; flag off: as before", async () => {
    mockUser = { id: "user-1" };
    expect((await (await load(true))("/edit/e1")).headers.get("location")).toBeNull();
    mockUser = null;
    expect((await (await load(false))("/edit/e1")).headers.get("location")).toBeNull();
  });

  it("never sees the kit's own files, which live under /edit too and stay public", async () => {
    // The film's typefaces are served from `public/edit/` (`EditPlayer kit="/edit"`). The proxy hands the middleware no path
    // that ends like a static file, so none of them is ever sent to log in; a page of the editor is.
    const { config } = await import("@/proxy");
    const handed = new RegExp(`^${config.matcher[0]}$`);
    const kit = readdirSync(join(process.cwd(), "public/edit"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${entry.parentPath}/${entry.name}`.slice(join(process.cwd(), "public").length));
    expect(kit).toContain("/edit/fonts/inter/Inter.ttf");
    expect(kit.filter((path) => handed.test(path))).toEqual([]);
    expect(handed.test("/edit/e1")).toBe(true);
  });

  it("flag on, You and a path that only starts like it are as before", async () => {
    const visit = await load(true);
    expect(new URL((await visit("/you")).headers.get("location")!).pathname).toBe("/login");
    expect((await visit("/editorial")).headers.get("location")).toBeNull();
  });
});
