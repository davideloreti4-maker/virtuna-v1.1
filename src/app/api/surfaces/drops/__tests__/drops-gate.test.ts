/**
 * The drops routes' gate (owner 2026-11-26: "enable it always"): live under v8 OR the new look,
 * 404 with both off. The flags are read from the real env at import, so each case stubs the env and
 * imports the real flag modules and routes fresh. Supabase is the I/O boundary: a signed-out client,
 * so a route that passes the gate answers 401 before it reads or spends anything.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

const post = (path: string) =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: path.endsWith("/remix") ? JSON.stringify({ contentId: "c-1" }) : undefined,
  });

async function routesWith(env: { v8: boolean; newLook: boolean }) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_V8", env.v8 ? "true" : "");
  vi.stubEnv("NEXT_PUBLIC_NEW_LOOK", env.newLook ? "true" : "");
  const flag = await import("@/lib/flags/remix-drops");
  const drops = await import("../route");
  const remix = await import("../remix/route");
  return { enabled: flag.REMIX_DROPS_ENABLED, drops: drops.POST, remix: remix.POST };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the drops routes' gate", () => {
  it.each([
    { v8: false, newLook: true, why: "the new look alone (prod)" },
    { v8: true, newLook: false, why: "v8 alone" },
    { v8: true, newLook: true, why: "both" },
  ])("open with $why: past the gate to the auth check (401 signed out)", async (env) => {
    const { enabled, drops, remix } = await routesWith(env);
    expect(enabled).toBe(true);
    expect((await drops(post("/api/surfaces/drops"))).status).toBe(401);
    expect((await remix(post("/api/surfaces/drops/remix"))).status).toBe(401);
  });

  it("closed with both off: 404, so the legacy look has no new route and no spend", async () => {
    const { enabled, drops, remix } = await routesWith({ v8: false, newLook: false });
    expect(enabled).toBe(false);
    expect((await drops(post("/api/surfaces/drops"))).status).toBe(404);
    expect((await remix(post("/api/surfaces/drops/remix"))).status).toBe(404);
  });
});
