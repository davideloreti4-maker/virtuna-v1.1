/**
 * GET /api/surfaces/outlier-picks and the paid drops routes, under each flag. The flags are read from
 * the real env at import, so each case stubs the env and imports the real modules fresh. Supabase is
 * the I/O boundary: the session client and the corpus table are stand-ins.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

let signedIn = true;
let corpusRows: unknown[] = [];
const corpusQueries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "u-1" } : null } }) },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query = { table, filters: [] as Array<[string, unknown]> };
      corpusQueries.push(query);
      const chain = {
        select: () => chain,
        eq: (col: string, v: unknown) => (query.filters.push([col, v]), chain),
        in: (col: string, v: unknown) => (query.filters.push([col, v]), Promise.resolve({ data: corpusRows, error: null })),
      };
      return chain;
    },
  }),
}));

async function load(env: { v8: boolean; newLook: boolean }) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_V8", env.v8 ? "true" : "");
  vi.stubEnv("NEXT_PUBLIC_NEW_LOOK", env.newLook ? "true" : "");
  return {
    picks: (await import("../route")).GET,
    drops: (await import("../../drops/route")).POST,
    remix: (await import("../../drops/remix/route")).POST,
  };
}

const post = (path: string) =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ contentId: "c-1" }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  signedIn = true;
  corpusRows = [];
  corpusQueries.length = 0;
});

const READY = {
  id: "row-1",
  platform: "tiktok",
  platform_video_id: "1",
  video_url: "https://www.tiktok.com/@a/video/1",
  cover_url: "https://x.supabase.co/storage/v1/object/public/covers/1.jpg",
  creator_handle: "a",
  views: 880_000,
  outlier_multiplier: 4.2,
  spoken_hook: "Stop meal prepping on Sundays",
  hook_template: null,
  hook_archetype: "contrarian",
};

describe("GET /api/surfaces/outlier-picks", () => {
  it("with the new look: today's picks from the TikTok rows the corpus serves, cacheable for an hour", async () => {
    corpusRows = [READY];
    const { picks } = await load({ v8: false, newLook: true });
    const res = await picks();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await res.json()).toEqual({
      picks: [
        {
          contentId: "row-1",
          hook: "Stop meal prepping on Sundays",
          coverUrl: READY.cover_url,
          videoUrl: READY.video_url,
          views: "880K",
          multiplier: 4.2,
          handle: "a",
        },
      ],
    });
    expect(corpusQueries).toEqual([
      { table: "outlier_teardowns", filters: [["platform", "tiktok"], ["status", ["extracted", "watched"]]] },
    ]);
  });

  it("signed out: 401, and the table is never read", async () => {
    signedIn = false;
    const { picks } = await load({ v8: false, newLook: true });
    expect((await picks()).status).toBe(401);
    expect(corpusQueries).toHaveLength(0);
  });

  it("without the new look: 404 (the legacy look gains no route)", async () => {
    const { picks } = await load({ v8: true, newLook: false });
    expect((await picks()).status).toBe(404);
  });
});

describe("the paid drops routes stay v8-only", () => {
  it("the new look alone (prod): both 404, so nothing can spend", async () => {
    const { drops, remix } = await load({ v8: false, newLook: true });
    expect((await drops(post("/api/surfaces/drops"))).status).toBe(404);
    expect((await remix(post("/api/surfaces/drops/remix"))).status).toBe(404);
  });

  it("with v8: past the gate (401 signed out)", async () => {
    signedIn = false;
    const { drops, remix } = await load({ v8: true, newLook: true });
    expect((await drops(post("/api/surfaces/drops"))).status).toBe(401);
    expect((await remix(post("/api/surfaces/drops/remix"))).status).toBe(401);
  });
});
