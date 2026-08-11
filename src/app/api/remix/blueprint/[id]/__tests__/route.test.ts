/**
 * route.test.ts — GET /api/remix/blueprint/[id], the read side of the shoot sheet.
 *
 * The contract has THREE outcomes, and the whole point of this file is that the third one is not
 * folded back into the second:
 *   200 — the row, reduced to `script` + `blueprint`
 *   404 — `getBlueprint` returned null: no such row FOR THIS USER (ownership is enforced by the
 *         repo's `user_id` predicate, so someone else's id is a 404 and not a leak)
 *   500 — `getBlueprint` THREW. Task 4 made it throw on everything except PGRST116 precisely so an
 *         unapplied migration is loud. The brief called it bare, which is an unhandled rejection;
 *         catching it back into a 404 would restore the exact silence that deviation removed —
 *         a remix card with no shoot sheet and no error anywhere, looking unbuilt rather than
 *         broken.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => ({ tag: "service" })) }));
vi.mock("@/lib/remix/blueprint-repo", () => ({ getBlueprint: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getBlueprint } from "@/lib/remix/blueprint-repo";
import { GET } from "../route";
import type { BlueprintRow } from "@/lib/remix/blueprint-repo";
import { emptyBlueprint } from "@/lib/engine/remix/blueprint";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockGetBlueprint = getBlueprint as ReturnType<typeof vi.fn>;
const mockCapture = Sentry.captureException as unknown as ReturnType<typeof vi.fn>;

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "abc123def456";

function signedIn(userId: string | null = USER) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  });
}

const call = (id: string = ID) =>
  GET(new Request(`http://localhost/api/remix/blueprint/${id}`), {
    params: Promise.resolve({ id }),
  });

function makeRow(): BlueprintRow {
  return {
    id: ID,
    user_id: USER,
    thread_id: "00000000-0000-0000-0000-0000000000bb",
    source_video_id: "https://www.tiktok.com/@x/video/123",
    blueprint: emptyBlueprint(),
    script: [[{ index: 0, spoken: "a line", on_screen_text: "", shot: "waist-up" }]],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/remix/blueprint/[id]", () => {
  it("401s before touching the database when signed out", async () => {
    signedIn(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockGetBlueprint).not.toHaveBeenCalled();
  });

  it("400s on an id that is not the nanoid shape", async () => {
    signedIn();
    const res = await call("../../etc/passwd");
    expect(res.status).toBe(400);
    expect(mockGetBlueprint).not.toHaveBeenCalled();
  });

  it("scopes the read to the caller", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue(makeRow());
    await call();
    // The third argument is what stops a known id being a cross-user read — RLS does not apply,
    // both phase-1 call sites use the service client.
    expect(mockGetBlueprint).toHaveBeenCalledWith({ tag: "service" }, ID, USER);
  });

  it("returns the script and the blueprint, and nothing else off the row", async () => {
    signedIn();
    const row = makeRow();
    mockGetBlueprint.mockResolvedValue(row);

    const res = await call();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ script: row.script, blueprint: row.blueprint });
    expect(Object.keys(body).sort()).toEqual(["blueprint", "script"]);
  });

  it("404s when there is no such row for this user", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("500s and reports when the read THROWS — never 404", async () => {
    // The live shape of this is an unapplied migration: PostgREST answers PGRST205 for an unknown
    // table and getBlueprint throws. A 404 here would render as "this card has no sheet" forever.
    signedIn();
    mockGetBlueprint.mockRejectedValue(new Error("remix_blueprints read failed: relation does not exist"));

    const res = await call();
    expect(res.status).toBe(500);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});
